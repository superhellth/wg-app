import { z } from "zod";
import { uuid } from "./common.js";

/**
 * Coupled weekly rota (see docs/chore-rota-redesign.md). A task is just a name;
 * all tasks share the one WG rotation (on the `wg` singleton). Assignment is
 * calendar-locked — turns carry the authoritative position (`rotationIndex`) and
 * advance on completion, +1 per grace-week missed.
 */
export const createChoreSchema = z.object({
  name: z.string().min(1).max(120),
  /** first turn's assignee; must be in the WG rotation. defaults to rotation[0]. */
  firstAssigneeId: uuid.optional(),
});
export type CreateChore = z.infer<typeof createChoreSchema>;

/** PATCH body for a task — name only. The rotation is WG-wide, not per task. */
export const updateChoreSchema = z.object({
  name: z.string().min(1).max(120),
});
export type UpdateChore = z.infer<typeof updateChoreSchema>;

export const choreSchema = z.object({
  id: uuid,
  name: z.string(),
});
export type Chore = z.infer<typeof choreSchema>;

/**
 * One active turn (completedAt+skippedAt null) per task at a time.
 * `rotationIndex` is the authoritative position in the WG rotation and is
 * NEVER moved by a swap/away override — only `executorId` changes. `assigneeId`
 * is the nominal member = rotation[rotationIndex]; `executorId` (defaults to it)
 * is who actually does/did it (away-override or swap). `skippedAt` closes a turn
 * without completion (past-grace penalty span, or no one left). `graceNotifiedAt`
 * dedups the cron grace warning (fires once, Monday after the missed Sunday).
 */
export const choreTurnSchema = z.object({
  id: uuid,
  choreId: uuid,
  assigneeId: uuid,
  executorId: uuid.nullable(),
  rotationIndex: z.number().int().nonnegative(),
  dueAt: z.string().datetime({ offset: true }),
  completedAt: z.string().datetime({ offset: true }).nullable(),
  skippedAt: z.string().datetime({ offset: true }).nullable(),
  graceNotifiedAt: z.string().datetime({ offset: true }).nullable(),
});
export type ChoreTurn = z.infer<typeof choreTurnSchema>;

/** Swap: set who actually does the current turn (rotation position unchanged). */
export const swapTurnSchema = z.object({ executorId: uuid });
export type SwapTurn = z.infer<typeof swapTurnSchema>;
