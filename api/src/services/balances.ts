import type { Balances } from "@wg/shared";
import { db, schema } from "../db/client.js";

/**
 * Compute net balances on read (nothing materialized). Per member, in cents,
 * positive = is owed (creditor):
 *   balance = paid − owes + settlementsOut − settlementsIn
 * All members are included (archived too — open debts persist). Expenses and
 * settlements are hard-deleted, so every row counts.
 */
export async function computeBalances(): Promise<Balances> {
  const balances: Record<string, number> = {};
  const add = (id: string, delta: number) => {
    balances[id] = (balances[id] ?? 0) + delta;
  };

  const members = await db.select({ id: schema.members.id }).from(schema.members);
  for (const m of members) balances[m.id] = 0;

  const expenses = await db
    .select({ payerId: schema.expenses.payerId, amount: schema.expenses.amount })
    .from(schema.expenses);
  for (const e of expenses) add(e.payerId, e.amount); // paid

  const shares = await db
    .select({
      memberId: schema.expenseShares.memberId,
      amount: schema.expenseShares.amount,
    })
    .from(schema.expenseShares);
  for (const s of shares) add(s.memberId, -s.amount); // owes

  const settlements = await db
    .select({
      fromMemberId: schema.settlements.fromMemberId,
      toMemberId: schema.settlements.toMemberId,
      amount: schema.settlements.amount,
    })
    .from(schema.settlements);
  for (const st of settlements) {
    add(st.fromMemberId, st.amount); // settlement out (debtor pays)
    add(st.toMemberId, -st.amount); // settlement in (creditor received)
  }

  return balances;
}
