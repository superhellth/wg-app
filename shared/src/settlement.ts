import { z } from "zod";
import { cents, uuid } from "./common.js";

/** Manual, trust-based, partial-allowed. No receiver confirmation. */
export const createSettlementSchema = z.object({
  fromMemberId: uuid,
  toMemberId: uuid,
  amount: cents.positive(),
});
export type CreateSettlement = z.infer<typeof createSettlementSchema>;

/** Editable (hard delete also allowed); changes logged to the activity feed. */
export const updateSettlementSchema = createSettlementSchema;
export type UpdateSettlement = z.infer<typeof updateSettlementSchema>;

export const settlementSchema = createSettlementSchema.extend({
  id: uuid,
  createdAt: z.string().datetime({ offset: true }),
});
export type Settlement = z.infer<typeof settlementSchema>;

/** A single suggested transfer from the debt-simplification algorithm. */
export const suggestedTransferSchema = z.object({
  fromMemberId: uuid,
  toMemberId: uuid,
  amount: cents.positive(),
});
export type SuggestedTransfer = z.infer<typeof suggestedTransferSchema>;
