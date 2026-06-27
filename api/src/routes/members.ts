import {
  createMemberSchema,
  idParamSchema,
  memberQuerySchema,
  updateMemberSchema,
} from "@wg/shared";
import { asc, eq, isNull } from "drizzle-orm";
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
  app.post("/", async (req, reply) => {
    const actor = requireMember(req);
    const body = parse(createMemberSchema, req.body);
    const member = await db.transaction(async (tx) => {
      const [m] = await tx
        .insert(schema.members)
        .values({ displayName: body.displayName })
        .returning();
      await logActivity(tx, {
        memberId: actor.id,
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
      // TODO(chores): auto-skip this member's open chore turns once the chore
      // service exists, so rotations don't stall on an archived member.
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
