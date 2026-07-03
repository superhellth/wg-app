import { z } from "zod";
import { uuid } from "./common.js";

/**
 * Activity feed vocabulary — single source of truth for `activity.kind`.
 * The feed is append-only and doubles as the audit trail for expenses and
 * settlements (there is no separate audit table). For `*.updated` the `data`
 * holds `{ before, after }` full-row snapshots; for `*.created`/`*.deleted` it
 * holds `{ snapshot }`. The client renders each row by `kind`.
 */
export const ACTIVITY_KINDS = [
  "member.added",
  "member.updated",
  "member.archived",
  "member.restored",
  "expense.created",
  "expense.updated",
  "expense.deleted",
  "settlement.created",
  "settlement.updated",
  "settlement.deleted",
  "shopping.added",
  "shopping.bought",
  "chore.created",
  "chore.updated",
  "chore.deleted",
  "chore.done",
  "chore.swapped",
  "chore.skipped",
  "chore.covered",
  "chore.reminded",
  "meeting.created",
  "meeting.updated",
  "meeting.deleted",
  "poll.created",
  "poll.resolved",
  "fixedcost.added",
  "fixedcost.updated",
  "fixedcost.deleted",
] as const;
export const activityKind = z.enum(ACTIVITY_KINDS);
export type ActivityKind = z.infer<typeof activityKind>;

export const activitySchema = z.object({
  id: uuid,
  memberId: uuid.nullable(), // null = system/cron action
  kind: activityKind,
  data: z.unknown(),
  createdAt: z.string().datetime({ offset: true }),
});
export type Activity = z.infer<typeof activitySchema>;

/** Cursor pagination query for GET /api/activity. */
export const activityQuerySchema = z.object({
  before: z.string().datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type ActivityQuery = z.infer<typeof activityQuerySchema>;
