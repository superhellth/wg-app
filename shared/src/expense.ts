import { z } from "zod";
import { cents, uuid } from "./common.js";
import { splitType, type SplitType } from "./enums.js";

export { splitType };
export type { SplitType };

/**
 * One participant's slice of an expense. Interpretation of `value` depends on
 * the parent expense's splitType:
 *  - equal:   value ignored (even split among participants)
 *  - exact:   value = cents this participant owes
 *  - shares:  value = number of shares (e.g. 2 for a couple)
 *  - percent: value = percentage points (sum must be 100)
 */
export const expenseShareSchema = z.object({
  memberId: uuid,
  value: z.number().nonnegative(),
});
export type ExpenseShare = z.infer<typeof expenseShareSchema>;

export const createExpenseSchema = z
  .object({
    payerId: uuid,
    amount: cents.positive(),
    description: z.string().min(1).max(200),
    category: z.string().max(40).optional(),
    splitType,
    shares: z.array(expenseShareSchema).min(1),
    /** convenience bridge: shopping items to mark bought when this is created */
    shoppingItemIds: z.array(uuid).optional(),
  })
  // Per-type rules — client and server reject identically.
  .superRefine((v, ctx) => {
    const ids = v.shares.map((s) => s.memberId);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "duplicate member in shares", path: ["shares"] });
    }
    if (v.splitType === "exact") {
      const sum = v.shares.reduce((a, s) => a + s.value, 0);
      if (sum !== v.amount) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `exact shares must sum to ${v.amount} cents`, path: ["shares"] });
      }
    }
    if (v.splitType === "percent") {
      const sum = v.shares.reduce((a, s) => a + s.value, 0);
      if (sum !== 100) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "percent shares must sum to 100", path: ["shares"] });
      }
    }
    if (v.splitType === "shares") {
      if (v.shares.some((s) => !Number.isInteger(s.value) || s.value <= 0)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "shares must be positive integers", path: ["shares"] });
      }
    }
  });
export type CreateExpense = z.infer<typeof createExpenseSchema>;

export const updateExpenseSchema = createExpenseSchema;
export type UpdateExpense = z.infer<typeof updateExpenseSchema>;

export const expenseSchema = z.object({
  id: uuid,
  payerId: uuid,
  amount: cents,
  description: z.string(),
  category: z.string().nullable(),
  splitType,
  createdAt: z.string().datetime({ offset: true }),
});
export type Expense = z.infer<typeof expenseSchema>;

/** A resolved per-member owed amount, in integer cents. */
export interface ResolvedShare {
  memberId: string;
  amount: number;
}

/**
 * Resolve a split into integer-cent owed amounts that sum EXACTLY to `amount`.
 * Pure — used by the client for live preview and by the server at write time
 * (single source of truth). Rounding for equal/shares/percent uses the
 * largest-remainder method: floor each share, then distribute the leftover
 * cents one-by-one to the largest fractional remainders (ties broken by input
 * order) so the total is always preserved.
 */
export function resolveShares(
  amount: number,
  type: SplitType,
  shares: ExpenseShare[],
): ResolvedShare[] {
  if (type === "exact") {
    return shares.map((s) => ({ memberId: s.memberId, amount: s.value }));
  }

  // weight per member: equal => 1 each; shares => value; percent => value
  const weights = shares.map((s) => (type === "equal" ? 1 : s.value));
  const totalWeight = weights.reduce((a, w) => a + w, 0);

  const exact = weights.map((w) => (amount * w) / totalWeight);
  const floored = exact.map((x) => Math.floor(x));
  let leftover = amount - floored.reduce((a, x) => a + x, 0);

  // hand out leftover cents to largest fractional remainders
  const order = exact
    .map((x, i) => ({ i, frac: x - Math.floor(x) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  const result = floored.slice();
  for (const { i } of order) {
    if (leftover <= 0) break;
    result[i]! += 1;
    leftover -= 1;
  }

  return shares.map((s, i) => ({ memberId: s.memberId, amount: result[i]! }));
}
