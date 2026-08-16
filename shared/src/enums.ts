import { z } from "zod";

/**
 * Single source of truth for every enum. The const arrays are consumed by BOTH
 * the Zod schemas here and the Drizzle `pgEnum` definitions in api/src/db/schema.ts
 * (imported via @wg/shared), so the two can never drift.
 */

export const SPLIT_TYPES = ["equal", "exact", "shares", "percent"] as const;
export const splitType = z.enum(SPLIT_TYPES);
export type SplitType = z.infer<typeof splitType>;

export const BILLING_CYCLES = ["monthly", "quarterly", "yearly"] as const;
export const billingCycle = z.enum(BILLING_CYCLES);
export type BillingCycle = z.infer<typeof billingCycle>;
