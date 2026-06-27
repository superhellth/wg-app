import { z } from "zod";
import { cents, uuid } from "./common.js";
import { suggestedTransferSchema } from "./settlement.js";

/** Net balance per member id, in cents. Positive = is owed (creditor). */
export const balancesSchema = z.record(uuid, cents);
export type Balances = z.infer<typeof balancesSchema>;

/** Response of GET /api/balances — computed on read; archived members included. */
export const balancesResponseSchema = z.object({
  balances: balancesSchema,
  suggestedTransfers: z.array(suggestedTransferSchema),
});
export type BalancesResponse = z.infer<typeof balancesResponseSchema>;
