import {
  createChoreSchema,
  idParamSchema,
  swapTurnSchema,
  updateChoreSchema,
} from "@wg/shared";
import { and, eq, gt, isNull } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { db, schema } from "../db/client.js";
import { logActivity, type Tx } from "../lib/activity.js";
import { NotFoundError } from "../lib/errors.js";
import { parse } from "../lib/parse.js";
import { sendPushToMember } from "../lib/push.js";
import { choreDueDate, intervalDaysFor } from "../lib/time.js";
import { requireMember } from "../plugins/auth.js";

type ChoreRow = typeof schema.chores.$inferSelect;
type TurnRow = typeof schema.choreTurns.$inferSelect;

/** Find the single active (not completed, not skipped) turn for a chore. */
function activeTurnWhere(choreId: string) {
  return and(
    eq(schema.choreTurns.choreId, choreId),
    isNull(schema.choreTurns.completedAt),
    isNull(schema.choreTurns.skippedAt),
  );
}

/**
 * Create the next turn: walk the rotation from the current index, skipping
 * members who are away; if everyone is away, take the next index anyway.
 */
async function advance(
  tx: Tx,
  chore: ChoreRow,
  current: TurnRow,
  now: Date,
): Promise<TurnRow> {
  const rotation = chore.rotation;
  const awayRows = await tx
    .select({ id: schema.members.id })
    .from(schema.members)
    .where(gt(schema.members.awayUntil, now));
  const away = new Set(awayRows.map((r) => r.id));

  let idx = current.rotationIndex;
  for (let i = 0; i < rotation.length; i++) {
    idx = (idx + 1) % rotation.length;
    if (!away.has(rotation[idx]!)) break;
  }

  const days = intervalDaysFor(chore.frequency, chore.intervalDays);
  const [next] = await tx
    .insert(schema.choreTurns)
    .values({
      choreId: chore.id,
      assigneeId: rotation[idx]!,
      rotationIndex: idx,
      dueAt: choreDueDate(now, days),
    })
    .returning();
  return next!;
}

const turnStartedPush = (choreName: string) => ({
  title: "Neue Aufgabe",
  body: `Du bist dran: ${choreName}`,
  url: "/chores",
});

export async function choresRoutes(app: FastifyInstance) {
  // List chores, each with its current active turn.
  app.get("/", async () => {
    const chores = await db.select().from(schema.chores);
    const turns = await db
      .select()
      .from(schema.choreTurns)
      .where(and(isNull(schema.choreTurns.completedAt), isNull(schema.choreTurns.skippedAt)));
    const byChore = new Map(turns.map((t) => [t.choreId, t]));
    return chores.map((c) => ({ ...c, currentTurn: byChore.get(c.id) ?? null }));
  });

  app.post("/", async (req, reply) => {
    const actor = requireMember(req);
    const body = parse(createChoreSchema, req.body);
    const firstAssignee = body.firstAssigneeId ?? body.rotation[0]!;
    const rotationIndex = body.rotation.indexOf(firstAssignee);
    const days = intervalDaysFor(body.frequency, body.intervalDays);

    const result = await db.transaction(async (tx) => {
      const [chore] = await tx
        .insert(schema.chores)
        .values({
          name: body.name,
          frequency: body.frequency,
          intervalDays: body.intervalDays ?? null,
          rotation: body.rotation,
        })
        .returning();
      const [turn] = await tx
        .insert(schema.choreTurns)
        .values({
          choreId: chore!.id,
          assigneeId: firstAssignee,
          rotationIndex,
          dueAt: choreDueDate(new Date(), days),
        })
        .returning();
      await logActivity(tx, {
        memberId: actor.id,
        kind: "chore.created",
        data: { snapshot: { chore, turn } },
      });
      return { chore: chore!, turn: turn! };
    });

    void sendPushToMember(firstAssignee, turnStartedPush(result.chore.name));
    return reply.status(201).send(result);
  });

  // Edit a chore definition (name/frequency/interval/rotation). Does not touch
  // turn completion; if the rotation changes, repair the active turn so its
  // rotationIndex stays in range and points at its assignee.
  app.patch("/:id", async (req) => {
    const actor = requireMember(req);
    const { id } = parse(idParamSchema, req.params);
    const body = parse(updateChoreSchema, req.body);

    return db.transaction(async (tx) => {
      const [before] = await tx
        .select()
        .from(schema.chores)
        .where(eq(schema.chores.id, id));
      if (!before) throw new NotFoundError("chore not found");

      const [after] = await tx
        .update(schema.chores)
        .set({
          name: body.name,
          frequency: body.frequency,
          intervalDays: body.intervalDays ?? null,
          rotation: body.rotation,
        })
        .where(eq(schema.chores.id, id))
        .returning();

      // Keep the open turn consistent with the new rotation.
      const [current] = await tx
        .select()
        .from(schema.choreTurns)
        .where(activeTurnWhere(id));
      if (current) {
        const idx = body.rotation.indexOf(current.assigneeId);
        const repaired =
          idx === -1
            ? { assigneeId: body.rotation[0]!, rotationIndex: 0 }
            : { assigneeId: current.assigneeId, rotationIndex: idx };
        if (
          repaired.assigneeId !== current.assigneeId ||
          repaired.rotationIndex !== current.rotationIndex
        ) {
          await tx
            .update(schema.choreTurns)
            .set(repaired)
            .where(eq(schema.choreTurns.id, current.id));
        }
      }

      await logActivity(tx, {
        memberId: actor.id,
        kind: "chore.updated",
        data: { before, after },
      });
      return after!;
    });
  });

  // Hard-delete a chore and all its turns (it's config, not a money record).
  app.delete("/:id", async (req, reply) => {
    const actor = requireMember(req);
    const { id } = parse(idParamSchema, req.params);
    await db.transaction(async (tx) => {
      const [before] = await tx
        .select()
        .from(schema.chores)
        .where(eq(schema.chores.id, id));
      if (!before) throw new NotFoundError("chore not found");

      await tx.delete(schema.choreTurns).where(eq(schema.choreTurns.choreId, id));
      await tx.delete(schema.chores).where(eq(schema.chores.id, id));

      await logActivity(tx, {
        memberId: actor.id,
        kind: "chore.deleted",
        data: { snapshot: before },
      });
    });
    return reply.status(204).send();
  });

  // Mark the current turn done → advance to the next assignee.
  app.post("/:id/done", async (req, reply) => {
    const actor = requireMember(req);
    const { id } = parse(idParamSchema, req.params);
    const now = new Date();

    const { chore, next } = await db.transaction(async (tx) => {
      const [chore] = await tx
        .select()
        .from(schema.chores)
        .where(eq(schema.chores.id, id));
      if (!chore) throw new NotFoundError("chore not found");
      const [current] = await tx
        .select()
        .from(schema.choreTurns)
        .where(activeTurnWhere(id));
      if (!current) throw new NotFoundError("no active turn");

      await tx
        .update(schema.choreTurns)
        .set({ completedAt: now })
        .where(eq(schema.choreTurns.id, current.id));
      const next = await advance(tx, chore, current, now);

      await logActivity(tx, {
        memberId: actor.id,
        kind: "chore.done",
        data: { snapshot: { choreId: id, completedTurnId: current.id, nextTurn: next } },
      });
      return { chore, next };
    });

    void sendPushToMember(next.assigneeId, turnStartedPush(chore.name));
    return reply.status(201).send(next);
  });

  // Skip the current turn (assignee away) → advance without completion.
  app.post("/:id/skip", async (req, reply) => {
    const actor = requireMember(req);
    const { id } = parse(idParamSchema, req.params);
    const now = new Date();

    const { chore, next } = await db.transaction(async (tx) => {
      const [chore] = await tx
        .select()
        .from(schema.chores)
        .where(eq(schema.chores.id, id));
      if (!chore) throw new NotFoundError("chore not found");
      const [current] = await tx
        .select()
        .from(schema.choreTurns)
        .where(activeTurnWhere(id));
      if (!current) throw new NotFoundError("no active turn");

      await tx
        .update(schema.choreTurns)
        .set({ skippedAt: now })
        .where(eq(schema.choreTurns.id, current.id));
      const next = await advance(tx, chore, current, now);

      await logActivity(tx, {
        memberId: actor.id,
        kind: "chore.skipped",
        data: { snapshot: { choreId: id, skippedTurnId: current.id, nextTurn: next } },
      });
      return { chore, next };
    });

    void sendPushToMember(next.assigneeId, turnStartedPush(chore.name));
    return reply.status(201).send(next);
  });

  // Swap: reassign the current turn (rotation position unchanged).
  app.patch("/:id/turn/assignee", async (req) => {
    const actor = requireMember(req);
    const { id } = parse(idParamSchema, req.params);
    const { assigneeId } = parse(swapTurnSchema, req.body);
    return db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(schema.choreTurns)
        .where(activeTurnWhere(id));
      if (!current) throw new NotFoundError("no active turn");
      const [after] = await tx
        .update(schema.choreTurns)
        .set({ assigneeId })
        .where(eq(schema.choreTurns.id, current.id))
        .returning();
      await logActivity(tx, {
        memberId: actor.id,
        kind: "chore.swapped",
        data: { before: current, after },
      });
      return after!;
    });
  });

  // Manual reminder: nudge the current assignee on demand.
  app.post("/:id/remind", async (req, reply) => {
    const actor = requireMember(req);
    const { id } = parse(idParamSchema, req.params);
    const current = await db.transaction(async (tx) => {
      const [chore] = await tx
        .select()
        .from(schema.chores)
        .where(eq(schema.chores.id, id));
      if (!chore) throw new NotFoundError("chore not found");
      const [turn] = await tx
        .select()
        .from(schema.choreTurns)
        .where(activeTurnWhere(id));
      if (!turn) throw new NotFoundError("no active turn");
      await logActivity(tx, {
        memberId: actor.id,
        kind: "chore.reminded",
        data: { choreId: id, assigneeId: turn.assigneeId },
      });
      return { chore, turn };
    });

    void sendPushToMember(current.turn.assigneeId, {
      title: "Erinnerung",
      body: `${current.chore.name} ist fällig`,
      url: "/chores",
    });
    return reply.status(204).send();
  });
}
