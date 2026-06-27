import { z } from "zod";
import { cents, uuid } from "./common.js";
import { billingCycle, type BillingCycle } from "./enums.js";

export { billingCycle };
export type { BillingCycle };

/**
 * Financial Overview board entry. STANDALONE — not linked to the ledger.
 * Pure reference: who pays for what, how much. Always split equally among the
 * currently-active members; the per-person share is computed on read, never
 * stored, and there is no settlement math or balance tracking here.
 */
export const createFixedCostSchema = z.object({
  name: z.string().min(1).max(120),
  amount: cents.positive(),
  cycle: billingCycle,
  contractHolderId: uuid,
});
export type CreateFixedCost = z.infer<typeof createFixedCostSchema>;

export const updateFixedCostSchema = createFixedCostSchema;
export type UpdateFixedCost = z.infer<typeof updateFixedCostSchema>;

export const fixedCostSchema = createFixedCostSchema.extend({
  id: uuid,
});
export type FixedCost = z.infer<typeof fixedCostSchema>;

/** Read shape: the stored cost plus the computed equal share (cents). */
export const fixedCostViewSchema = fixedCostSchema.extend({
  perPersonShare: cents,
});
export type FixedCostView = z.infer<typeof fixedCostViewSchema>;
