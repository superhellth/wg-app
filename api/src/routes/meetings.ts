import {
  createMeetingSchema,
  idParamSchema,
  resolvePollSchema,
  rsvpSchema,
  voteSchema,
} from "@wg/shared";
import { and, desc, eq, inArray } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { db, schema } from "../db/client.js";
import { logActivity } from "../lib/activity.js";
import { NotFoundError } from "../lib/errors.js";
import { parse } from "../lib/parse.js";
import { sendPushToAllMembers } from "../lib/push.js";
import { requireMember } from "../plugins/auth.js";

export async function meetingsRoutes(app: FastifyInstance) {
  app.get("/", async () =>
    db.select().from(schema.meetings).orderBy(desc(schema.meetings.createdAt)),
  );

  app.get("/:id", async (req) => {
    const { id } = parse(idParamSchema, req.params);
    const [meeting] = await db
      .select()
      .from(schema.meetings)
      .where(eq(schema.meetings.id, id));
    if (!meeting) throw new NotFoundError("meeting not found");
    const options = await db
      .select()
      .from(schema.meetingOptions)
      .where(eq(schema.meetingOptions.meetingId, id));
    const rsvps = await db
      .select()
      .from(schema.meetingRsvps)
      .where(eq(schema.meetingRsvps.meetingId, id));
    const optionIds = options.map((o) => o.id);
    const votes = optionIds.length
      ? await db
          .select()
          .from(schema.meetingVotes)
          .where(inArray(schema.meetingVotes.optionId, optionIds))
      : [];
    return { meeting, options, rsvps, votes };
  });

  app.post("/", async (req, reply) => {
    const actor = requireMember(req);
    const body = parse(createMeetingSchema, req.body);

    const created = await db.transaction(async (tx) => {
      const [meeting] = await tx
        .insert(schema.meetings)
        .values({
          title: body.title,
          mode: body.mode,
          startsAt: body.startsAt ? new Date(body.startsAt) : null,
          recurEveryDays: body.recurEveryDays ?? null,
          createdByMemberId: actor.id,
        })
        .returning();
      if (body.mode === "poll" && body.options) {
        await tx.insert(schema.meetingOptions).values(
          body.options.map((t) => ({
            meetingId: meeting!.id,
            optionTime: new Date(t),
          })),
        );
      }
      await logActivity(tx, {
        memberId: actor.id,
        kind: body.mode === "poll" ? "poll.created" : "meeting.created",
        data: { snapshot: meeting },
      });
      return meeting!;
    });

    // Invite push to everyone but the creator (fire-and-forget).
    void sendPushToAllMembers(
      {
        title: body.mode === "poll" ? "Neue Umfrage" : "Neues Treffen",
        body: created.title,
        url: "/meetings",
      },
      actor.id,
    );
    return reply.status(201).send(created);
  });

  // Hard-delete a meeting and everything attached (options, votes, rsvps).
  app.delete("/:id", async (req, reply) => {
    const actor = requireMember(req);
    const { id } = parse(idParamSchema, req.params);
    await db.transaction(async (tx) => {
      const [before] = await tx
        .select()
        .from(schema.meetings)
        .where(eq(schema.meetings.id, id));
      if (!before) throw new NotFoundError("meeting not found");

      const options = await tx
        .select({ id: schema.meetingOptions.id })
        .from(schema.meetingOptions)
        .where(eq(schema.meetingOptions.meetingId, id));
      if (options.length) {
        await tx.delete(schema.meetingVotes).where(
          inArray(
            schema.meetingVotes.optionId,
            options.map((o) => o.id),
          ),
        );
      }
      await tx.delete(schema.meetingOptions).where(eq(schema.meetingOptions.meetingId, id));
      await tx.delete(schema.meetingRsvps).where(eq(schema.meetingRsvps.meetingId, id));
      await tx.delete(schema.meetings).where(eq(schema.meetings.id, id));

      await logActivity(tx, {
        memberId: actor.id,
        kind: "meeting.deleted",
        data: { snapshot: before },
      });
    });
    return reply.status(204).send();
  });

  // Resolve a poll: pick the winning option → meeting becomes fixed.
  app.post("/:id/resolve", async (req) => {
    const actor = requireMember(req);
    const { id } = parse(idParamSchema, req.params);
    const { optionId } = parse(resolvePollSchema, req.body);
    return db.transaction(async (tx) => {
      const [opt] = await tx
        .select()
        .from(schema.meetingOptions)
        .where(
          and(
            eq(schema.meetingOptions.id, optionId),
            eq(schema.meetingOptions.meetingId, id),
          ),
        );
      if (!opt) throw new NotFoundError("option not found");
      const [after] = await tx
        .update(schema.meetings)
        .set({ startsAt: opt.optionTime })
        .where(eq(schema.meetings.id, id))
        .returning();
      await logActivity(tx, {
        memberId: actor.id,
        kind: "poll.resolved",
        data: { snapshot: after },
      });
      return after!;
    });
  });

  // Approval voting: add a vote for an option (idempotent).
  app.post("/:id/votes", async (req, reply) => {
    const actor = requireMember(req);
    const { id } = parse(idParamSchema, req.params);
    const { optionId } = parse(voteSchema, req.body);
    const [opt] = await db
      .select()
      .from(schema.meetingOptions)
      .where(
        and(
          eq(schema.meetingOptions.id, optionId),
          eq(schema.meetingOptions.meetingId, id),
        ),
      );
    if (!opt) throw new NotFoundError("option not found");
    const existing = await db
      .select()
      .from(schema.meetingVotes)
      .where(
        and(
          eq(schema.meetingVotes.optionId, optionId),
          eq(schema.meetingVotes.memberId, actor.id),
        ),
      );
    if (existing.length === 0) {
      await db
        .insert(schema.meetingVotes)
        .values({ optionId, memberId: actor.id });
    }
    return reply.status(204).send();
  });

  app.delete("/:id/votes", async (req, reply) => {
    const actor = requireMember(req);
    const { optionId } = parse(voteSchema, req.body);
    await db
      .delete(schema.meetingVotes)
      .where(
        and(
          eq(schema.meetingVotes.optionId, optionId),
          eq(schema.meetingVotes.memberId, actor.id),
        ),
      );
    return reply.status(204).send();
  });

  // Set/replace this member's RSVP.
  app.put("/:id/rsvp", async (req, reply) => {
    const actor = requireMember(req);
    const { id } = parse(idParamSchema, req.params);
    const { value } = parse(rsvpSchema, req.body);
    const existing = await db
      .select()
      .from(schema.meetingRsvps)
      .where(
        and(
          eq(schema.meetingRsvps.meetingId, id),
          eq(schema.meetingRsvps.memberId, actor.id),
        ),
      );
    if (existing.length) {
      await db
        .update(schema.meetingRsvps)
        .set({ value })
        .where(eq(schema.meetingRsvps.id, existing[0]!.id));
    } else {
      await db
        .insert(schema.meetingRsvps)
        .values({ meetingId: id, memberId: actor.id, value });
    }
    return reply.status(204).send();
  });
}
