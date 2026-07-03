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
      // append to the shared chore rotation (enters when the cycle reaches them)
      const [wgRow] = await tx.select().from(schema.wg).limit(1);
      if (wgRow && !wgRow.rotation.includes(m!.id)) {
        await tx
          .update(schema.wg)
          .set({ rotation: [...wgRow.rotation, m!.id] })
          .where(eq(schema.wg.id, wgRow.id));
      }
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

      // Drop the archived member from the shared rotation and repair every open
      // turn, so the coupled rota doesn't stall on someone who's gone.
      const [wgRow] = await tx.select().from(schema.wg).limit(1);
      if (wgRow && wgRow.rotation.includes(id)) {
        const rotation = wgRow.rotation.filter((mid) => mid !== id);
        await tx
          .update(schema.wg)
          .set({ rotation })
          .where(eq(schema.wg.id, wgRow.id));

        const openTurns = await tx
          .select()
          .from(schema.choreTurns)
          .where(
            and(
              isNull(schema.choreTurns.completedAt),
              isNull(schema.choreTurns.skippedAt),
            ),
          );
        for (const turn of openTurns) {
          if (rotation.length === 0) {
            // no one left — close the open turn
            await tx
              .update(schema.choreTurns)
              .set({ skippedAt: new Date() })
              .where(eq(schema.choreTurns.id, turn.id));
            continue;
          }
          const idx = rotation.indexOf(turn.assigneeId);
          const assigneeId = idx === -1 ? rotation[0]! : turn.assigneeId;
          const rotationIndex = idx === -1 ? 0 : idx;
          // drop an executor override that pointed at the archived member
          const executorId =
            turn.executorId && !rotation.includes(turn.executorId)
              ? null
              : turn.executorId;
          if (
            assigneeId !== turn.assigneeId ||
            rotationIndex !== turn.rotationIndex ||
            executorId !== turn.executorId
          ) {
            await tx
              .update(schema.choreTurns)
              .set({ assigneeId, rotationIndex, executorId })
              .where(eq(schema.choreTurns.id, turn.id));
          }
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
      // re-enter the shared rotation (appended to the end)
      const [wgRow] = await tx.select().from(schema.wg).limit(1);
      if (wgRow && !wgRow.rotation.includes(id)) {
        await tx
          .update(schema.wg)
          .set({ rotation: [...wgRow.rotation, id] })
          .where(eq(schema.wg.id, wgRow.id));
      }
      await logActivity(tx, {
        memberId: actor.id,
        kind: "member.restored",
        data: { before, after },
      });
      return after!;
    });
  });
}
