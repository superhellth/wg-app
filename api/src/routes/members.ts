import {
  createMemberSchema,
  idParamSchema,
  memberQuerySchema,
  updateMemberSchema,
} from "@wg/shared";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { db, schema } from "../db/client.js";
import { logActivity } from "../lib/activity.js";
import { NotFoundError } from "../lib/errors.js";
import { parse } from "../lib/parse.js";
import { requireMember } from "../plugins/auth.js";

export async function membersRoutes(app: FastifyInstance) {
  // List members — active by default; ?includeArchived=true for ledger/feed views.
  app.get("/", async (req) => {
    const { includeArchived } = parse(memberQuerySchema, req.query);
    return db
      .select()
      .from(schema.members)
      .where(includeArchived ? undefined : isNull(schema.members.archivedAt))
      .orderBy(asc(schema.members.createdAt)); // stable order → stable member colors
  });

  // Add a member to the roster.
  // Bootstrap: the very first member (empty roster) has no acting member yet —
  // allow it without X-Member-Id and self-attribute the activity. Any later add
  // requires a valid acting member.
  app.post("/", async (req, reply) => {
    const body = parse(createMemberSchema, req.body);
    const member = await db.transaction(async (tx) => {
      const [row] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.members);
      const isBootstrap = (row?.count ?? 0) === 0;
      const actor = isBootstrap ? null : requireMember(req);

      const [m] = await tx
        .insert(schema.members)
        .values({ displayName: body.displayName })
        .returning();
      await logActivity(tx, {
        memberId: actor?.id ?? m!.id,
        kind: "member.added",
        data: { snapshot: m },
      });
      return m!;
    });
    return reply.status(201).send(member);
  });

  // Edit a member (displayName and/or awayUntil).
  app.patch("/:id", async (req) => {
    const actor = requireMember(req);
    const { id } = parse(idParamSchema, req.params);
    const body = parse(updateMemberSchema, req.body);
    return db.transaction(async (tx) => {
      const [before] = await tx
        .select()
        .from(schema.members)
        .where(eq(schema.members.id, id));
      if (!before) throw new NotFoundError("member not found");

      const patch: Partial<typeof schema.members.$inferInsert> = {};
      if (body.displayName !== undefined) patch.displayName = body.displayName;
      if (body.awayUntil !== undefined) {
        patch.awayUntil = body.awayUntil ? new Date(body.awayUntil) : null;
      }

      const [after] = await tx
        .update(schema.members)
        .set(patch)
        .where(eq(schema.members.id, id))
        .returning();
      await logActivity(tx, {
        memberId: actor.id,
        kind: "member.updated",
        data: { before, after },
      });
      return after!;
    });
  });

  // Archive (soft-remove). Debts persist; member drops from active lists.
  app.patch("/:id/archive", async (req) => {
    const actor = requireMember(req);
    const { id } = parse(idParamSchema, req.params);
    return db.transaction(async (tx) => {
      const [before] = await tx
        .select()
        .from(schema.members)
        .where(eq(schema.members.id, id));
      if (!before) throw new NotFoundError("member not found");

      const [after] = await tx
        .update(schema.members)
        .set({ archivedAt: new Date() })
        .where(eq(schema.members.id, id))
        .returning();

      // Drop the archived member from every chore rotation and repair any open
      // turn, so rotations don't stall on someone who's gone.
      const allChores = await tx.select().from(schema.chores);
      for (const chore of allChores) {
        if (!chore.rotation.includes(id)) continue;
        const rotation = chore.rotation.filter((mid) => mid !== id);
        await tx
          .update(schema.chores)
          .set({ rotation })
          .where(eq(schema.chores.id, chore.id));

        const [turn] = await tx
          .select()
          .from(schema.choreTurns)
          .where(
            and(
              eq(schema.choreTurns.choreId, chore.id),
              isNull(schema.choreTurns.completedAt),
              isNull(schema.choreTurns.skippedAt),
            ),
          );
        if (!turn) continue;
        if (rotation.length === 0) {
          // no one left to do this chore — close the open turn
          await tx
            .update(schema.choreTurns)
            .set({ skippedAt: new Date() })
            .where(eq(schema.choreTurns.id, turn.id));
          continue;
        }
        const idx = rotation.indexOf(turn.assigneeId);
        const repaired =
          idx === -1
            ? { assigneeId: rotation[0]!, rotationIndex: 0 }
            : { assigneeId: turn.assigneeId, rotationIndex: idx };
        if (
          repaired.assigneeId !== turn.assigneeId ||
          repaired.rotationIndex !== turn.rotationIndex
        ) {
          await tx
            .update(schema.choreTurns)
            .set(repaired)
            .where(eq(schema.choreTurns.id, turn.id));
        }
      }

      await logActivity(tx, {
        memberId: actor.id,
        kind: "member.archived",
        data: { before, after },
      });
      return after!;
    });
  });

  // Restore (undo an archive).
  app.patch("/:id/restore", async (req) => {
    const actor = requireMember(req);
    const { id } = parse(idParamSchema, req.params);
    return db.transaction(async (tx) => {
      const [before] = await tx
        .select()
        .from(schema.members)
        .where(eq(schema.members.id, id));
      if (!before) throw new NotFoundError("member not found");

      const [after] = await tx
        .update(schema.members)
        .set({ archivedAt: null })
        .where(eq(schema.members.id, id))
        .returning();
      await logActivity(tx, {
        memberId: actor.id,
        kind: "member.restored",
        data: { before, after },
      });
      return after!;
    });
  });
}
