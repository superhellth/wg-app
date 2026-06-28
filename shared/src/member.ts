import { z } from "zod";
import { queryBool, uuid } from "./common.js";

export const memberSchema = z.object({
  id: uuid,
  displayName: z.string().min(1).max(60),
  archivedAt: z.string().datetime({ offset: true }).nullable(),
  /** if set and in the future, member is auto-skipped in all chore rotations */
  awayUntil: z.string().datetime({ offset: true }).nullable(),
});
export type Member = z.infer<typeof memberSchema>;

export const createMemberSchema = z.object({
  displayName: z.string().min(1).max(60),
});
export type CreateMember = z.infer<typeof createMemberSchema>;

export const updateMemberSchema = z
  .object({
    displayName: z.string().min(1).max(60).optional(),
    awayUntil: z.string().datetime({ offset: true }).nullable().optional(),
  })
  .refine((v) => v.displayName !== undefined || v.awayUntil !== undefined, {
    message: "nothing to update",
  });
export type UpdateMember = z.infer<typeof updateMemberSchema>;

/** Query for GET /api/members. */
export const memberQuerySchema = z.object({
  includeArchived: queryBool.default(false),
});
export type MemberQuery = z.infer<typeof memberQuerySchema>;
