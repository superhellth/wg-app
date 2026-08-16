import { createMeetingSchema, idParamSchema, updateMeetingSchema } from "@wg/shared";
import { desc, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { db, schema } from "../db/client.js";
import { logActivity } from "../lib/activity.js";
import { NotFoundError } from "../lib/errors.js";
import { parse } from "../lib/parse.js";
import { sendPushToAllMembers } from "../lib/push.js";
import { requireMember } from "../plugins/auth.js";

export async function meetingsRoutes(app: FastifyInstance) {
  app.get("/", async () => {
    return db.select().from(schema.meetings).orderBy(desc(schema.meetings.createdAt));
  });

  app.get("/:id", async (req) => {
    const { id } = parse(idParamSchema, req.params);
    const [meeting] = await db.select().from(schema.meetings).where(eq(schema.meetings.id, id));
    if (!meeting) throw new NotFoundError("meeting not found");
    return meeting;
  });

  app.post("/", async (req, reply) => {
    const actor = requireMember(req);
    const body = parse(createMeetingSchema, req.body);

    const created = await db.transaction(async (tx) => {
      const [meeting] = await tx
        .insert(schema.meetings)
        .values({
          title: body.title,
          startsAt: new Date(body.startsAt),
          createdByMemberId: actor.id,
        })
        .returning();
      await logActivity(tx, {
        memberId: actor.id,
        kind: "meeting.created",
        data: { snapshot: meeting },
      });
      return meeting!;
    });

    // Invite push to everyone but the creator (fire-and-forget).
    void sendPushToAllMembers(
      { title: "Neuer Termin", body: created.title, url: "/meetings" },
      actor.id,
    );
    return reply.status(201).send(created);
  });

  app.put("/:id", async (req) => {
    const actor = requireMember(req);
    const { id } = parse(idParamSchema, req.params);
    const body = parse(updateMeetingSchema, req.body);
    return db.transaction(async (tx) => {
      const [before] = await tx.select().from(schema.meetings).where(eq(schema.meetings.id, id));
      if (!before) throw new NotFoundError("meeting not found");

      const [after] = await tx
        .update(schema.meetings)
        .set({ title: body.title, startsAt: new Date(body.startsAt) })
        .where(eq(schema.meetings.id, id))
        .returning();
      await logActivity(tx, {
        memberId: actor.id,
        kind: "meeting.updated",
        data: { before, after },
      });
      return after!;
    });
  });

  app.delete("/:id", async (req, reply) => {
    const actor = requireMember(req);
    const { id } = parse(idParamSchema, req.params);
    await db.transaction(async (tx) => {
      const [before] = await tx.select().from(schema.meetings).where(eq(schema.meetings.id, id));
      if (!before) throw new NotFoundError("meeting not found");

      await tx.delete(schema.meetings).where(eq(schema.meetings.id, id));

      await logActivity(tx, {
        memberId: actor.id,
        kind: "meeting.deleted",
        data: { snapshot: before },
      });
    });
    return reply.status(204).send();
  });
}
