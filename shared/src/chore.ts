import { z } from "zod";
import { uuid } from "./common.js";
import { choreFrequency, type ChoreFrequency } from "./enums.js";

export { choreFrequency };
export type { ChoreFrequency };

/** Shared shape of a chore definition (no turn/assignment fields). */
const choreBaseShape = {
  name: z.string().min(1).max(120),
  frequency: choreFrequency,
  /** for "custom": interval length in days */
  intervalDays: z.number().int().positive().optional(),
  /** rotation order — member ids in turn order */
  rotation: z.array(uuid).min(1),
} as const;

export const createChoreSchema = z
  .object({
    ...choreBaseShape,
    /** first turn's assignee; must be in `rotation`. defaults to rotation[0]. */
    firstAssigneeId: uuid.optional(),
  })
  .superRefine((v, ctx) => {
    if (v.frequency === "custom" && v.intervalDays == null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "custom frequency requires intervalDays", path: ["intervalDays"] });
    }
    if (v.firstAssigneeId && !v.rotation.includes(v.firstAssigneeId)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "firstAssigneeId must be in rotation", path: ["firstAssigneeId"] });
    }
  });
export type CreateChore = z.infer<typeof createChoreSchema>;

/**
 * PATCH body for a chore definition — name/frequency/rotation only. The active
 * turn isn't reassigned here (the server repairs it if rotation changes); use
 * the swap endpoint to change who's currently up.
 */
export const updateChoreSchema = z
  .object(choreBaseShape)
  .superRefine((v, ctx) => {
    if (v.frequency === "custom" && v.intervalDays == null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "custom frequency requires intervalDays", path: ["intervalDays"] });
    }
  });
export type UpdateChore = z.infer<typeof updateChoreSchema>;

export const choreSchema = z.object({
  id: uuid,
  name: z.string(),
  frequency: choreFrequency,
  intervalDays: z.number().int().positive().nullable(),
  rotation: z.array(uuid),
});
export type Chore = z.infer<typeof choreSchema>;

/**
 * Turn advances only on completion. One active turn (completedAt null) per chore
 * at a time. `rotationIndex` is the authoritative position in the rotation —
 * a swap reassigns `assigneeId` without moving the index. `skippedAt` closes a
 * turn without completion (member away). `overdueNotifiedAt` dedups the cron
 * overdue push (fires once, 1 day after due).
 */
export const choreTurnSchema = z.object({
  id: uuid,
  choreId: uuid,
  assigneeId: uuid,
  rotationIndex: z.number().int().nonnegative(),
  dueAt: z.string().datetime({ offset: true }),
  completedAt: z.string().datetime({ offset: true }).nullable(),
  skippedAt: z.string().datetime({ offset: true }).nullable(),
  overdueNotifiedAt: z.string().datetime({ offset: true }).nullable(),
});
export type ChoreTurn = z.infer<typeof choreTurnSchema>;

/** Swap the current turn to another member (rotation position unchanged). */
export const swapTurnSchema = z.object({ assigneeId: uuid });
export type SwapTurn = z.infer<typeof swapTurnSchema>;
