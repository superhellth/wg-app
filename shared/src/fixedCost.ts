import { z } from "zod";
import { cents, isoDate, uuid } from "./common.js";
import { billingCycle, type BillingCycle } from "./enums.js";

export { billingCycle };
export type { BillingCycle };

/**
 * Financial Overview board entry. Each cost auto-generates a matching
 * expense in the ledger on its billing cycle (see `nextDueAt`/`active`) —
 * payer = contractHolderId, split equally among active members.
 */
export const createFixedCostSchema = z.object({
  name: z.string().min(1).max(120),
  amount: cents.positive(),
  cycle: billingCycle,
  contractHolderId: uuid,
  /** When the next expense generation is due. */
  nextDueAt: isoDate,
  /** Paused costs are skipped by generation but still shown in the list. */
  active: z.boolean().default(true),
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
