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
import { BadRequestError, NotFoundError } from "../lib/errors.js";
import { parse } from "../lib/parse.js";
import { sendPushToMember } from "../lib/push.js";
import { advanceSteps, firstChoreDue, nextChoreDue } from "../lib/time.js";
import { requireMember } from "../plugins/auth.js";

type ChoreRow = typeof schema.chores.$inferSelect;
type TurnRow = typeof schema.choreTurns.$inferSelect;

interface WgConfig {
  rotation: string[];
  graceDays: number;
}

/** Find the single active (not completed, not skipped) turn for a chore. */
function activeTurnWhere(choreId: string) {
  return and(
    eq(schema.choreTurns.choreId, choreId),
    isNull(schema.choreTurns.completedAt),
    isNull(schema.choreTurns.skippedAt),
  );
}

/** The one WG row's shared chore config (rotation + grace window). */
async function loadWgConfig(tx: Tx): Promise<WgConfig> {
  const [row] = await tx
    .select({ rotation: schema.wg.rotation, graceDays: schema.wg.graceDays })
    .from(schema.wg)
    .limit(1);
  return { rotation: row?.rotation ?? [], graceDays: row?.graceDays ?? 2 };
}

/** Member ids currently away (awayUntil in the future). */
async function awaySet(tx: Tx, now: Date): Promise<Set<string>> {
  const rows = await tx
    .select({ id: schema.members.id })
    .from(schema.members)
    .where(gt(schema.members.awayUntil, now));
  return new Set(rows.map((r) => r.id));
}

/**
 * Away-override: if the nominal member at `index` is away, walk forward to the
 * next present member and return them as the executor (rotation position stays
 * put). Returns null when the nominal member is present, or everyone is away
 * (fallback: the nominal member keeps it).
 */
function resolveExecutor(
  rotation: string[],
  index: number,
  away: Set<string>,
): string | null {
  const n = rotation.length;
  if (!away.has(rotation[index]!)) return null;
  for (let i = 1; i < n; i++) {
    const cand = rotation[(index + i) % n]!;
    if (!away.has(cand)) return cand;
  }
  return null; // everyone away
}

/** Who actually does a turn: the explicit executor, else the nominal assignee. */
const doerOf = (t: { assigneeId: string; executorId: string | null }) =>
  t.executorId ?? t.assigneeId;

const turnStartedPush = (choreName: string) => ({
  title: "Neue Aufgabe",
  body: `Du bist dran: ${choreName}`,
  url: "/chores",
});

/**
 * Advance the open turn on completion. Computes how many rotation steps the
 * completion jumps (1 normal; +1 per grace-week missed), materializes ONE
 * summary skipped row for the skipped span, and opens the next turn (with an
 * away-override on the landing member). Returns null if the rotation is empty.
 */
async function openNextTurn(
  tx: Tx,
  chore: ChoreRow,
  current: TurnRow,
  now: Date,
  config: WgConfig,
): Promise<{ next: TurnRow; skipped: string[] } | null> {
  const { rotation, graceDays } = config;
  const n = rotation.length;
  if (n === 0) return null;

  const steps = advanceSteps(current.dueAt, graceDays, now);

  // Skipped span (past-grace penalty): steps − 1 members, one summary row.
  const skipped: string[] = [];
  for (let j = 1; j < steps; j++) {
    skipped.push(rotation[(current.rotationIndex + j) % n]!);
  }
  if (skipped.length > 0) {
    const firstIdx = (current.rotationIndex + 1) % n;
    await tx.insert(schema.choreTurns).values({
      choreId: chore.id,
      assigneeId: rotation[firstIdx]!,
      rotationIndex: firstIdx,
      dueAt: nextChoreDue(current.dueAt, 1),
      skippedAt: now,
    });
  }

  const nextIndex = (current.rotationIndex + steps) % n;
  const away = await awaySet(tx, now);
  const [next] = await tx
    .insert(schema.choreTurns)
    .values({
      choreId: chore.id,
      assigneeId: rotation[nextIndex]!,
      executorId: resolveExecutor(rotation, nextIndex, away),
      rotationIndex: nextIndex,
      dueAt: nextChoreDue(current.dueAt, steps),
    })
    .returning();
  return { next: next!, skipped };
}

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
    const now = new Date();

    const result = await db.transaction(async (tx) => {
      const config = await loadWgConfig(tx);
      if (config.rotation.length === 0) {
        throw new BadRequestError("Rotation ist leer — erst Mitglieder anlegen");
      }
      const firstAssignee = body.firstAssigneeId ?? config.rotation[0]!;
      const rotationIndex = config.rotation.indexOf(firstAssignee);
      if (rotationIndex === -1) {
        throw new BadRequestError("Erste:r dran ist nicht in der Rotation");
      }

      const [chore] = await tx
        .insert(schema.chores)
        .values({ name: body.name })
        .returning();

      const away = await awaySet(tx, now);
      const [turn] = await tx
        .insert(schema.choreTurns)
        .values({
          choreId: chore!.id,
          assigneeId: firstAssignee,
          executorId: resolveExecutor(config.rotation, rotationIndex, away),
          rotationIndex,
          dueAt: firstChoreDue(now),
        })
        .returning();
      await logActivity(tx, {
        memberId: actor.id,
        kind: "chore.created",
        data: { snapshot: { chore, turn } },
      });
      return { chore: chore!, turn: turn! };
    });

    void sendPushToMember(doerOf(result.turn), turnStartedPush(result.chore.name));
    return reply.status(201).send(result);
  });

  // Edit a task — name only (rotation is WG-wide).
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
        .set({ name: body.name })
        .where(eq(schema.chores.id, id))
        .returning();
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

  // Mark the current turn done → advance (skipping past-grace / away as needed).
  app.post("/:id/done", async (req, reply) => {
    const actor = requireMember(req);
    const { id } = parse(idParamSchema, req.params);
    const now = new Date();

    const { chore, result } = await db.transaction(async (tx) => {
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

      const config = await loadWgConfig(tx);
      const result = await openNextTurn(tx, chore, current, now, config);

      await logActivity(tx, {
        memberId: actor.id,
        kind: "chore.done",
        data: {
          snapshot: {
            choreId: id,
            completedTurnId: current.id,
            completedBy: doerOf(current),
            late: now.getTime() > current.dueAt.getTime(),
            nextTurn: result?.next ?? null,
          },
        },
      });
      if (result && result.skipped.length > 0) {
        await logActivity(tx, {
          memberId: actor.id,
          kind: "chore.skipped",
          data: { snapshot: { choreId: id, skippedMembers: result.skipped } },
        });
      }
      return { chore, result };
    });

    if (result) {
      void sendPushToMember(doerOf(result.next), turnStartedPush(chore.name));
    }
    return reply.status(201).send(result?.next ?? null);
  });

  // Swap: set who actually does the current turn (rotation position unchanged).
  app.patch("/:id/turn/assignee", async (req) => {
    const actor = requireMember(req);
    const { id } = parse(idParamSchema, req.params);
    const { executorId } = parse(swapTurnSchema, req.body);
    const after = await db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(schema.choreTurns)
        .where(activeTurnWhere(id));
      if (!current) throw new NotFoundError("no active turn");
      // executor == nominal assignee ⇒ clear the override
      const value = executorId === current.assigneeId ? null : executorId;
      const [after] = await tx
        .update(schema.choreTurns)
        .set({ executorId: value })
        .where(eq(schema.choreTurns.id, current.id))
        .returning();
      await logActivity(tx, {
        memberId: actor.id,
        kind: "chore.covered",
        data: { before: current, after },
      });
      return after!;
    });
    void sendPushToMember(doerOf(after), {
      title: "Aufgabe übernommen",
      body: "Du machst diese Runde",
      url: "/chores",
    });
    return after;
  });

  // Manual reminder: nudge whoever's up on demand.
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
        data: { choreId: id, assigneeId: doerOf(turn) },
      });
      return { chore, turn };
    });

    void sendPushToMember(doerOf(current.turn), {
      title: "Erinnerung",
      body: `${current.chore.name} ist fällig`,
      url: "/chores",
    });
    return reply.status(204).send();
  });
}
