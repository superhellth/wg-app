import type { SuggestedTransfer } from "@wg/shared";

/**
 * Debt simplification: given each member's net balance (positive = is owed,
 * negative = owes), produce a minimal-ish set of transfers that zeroes everyone.
 * Greedy largest-creditor / largest-debtor matching. All amounts in cents.
 */
export function simplifyDebts(
  balances: Record<string, number>,
): SuggestedTransfer[] {
  const creditors: { id: string; amt: number }[] = [];
  const debtors: { id: string; amt: number }[] = [];

  for (const [id, bal] of Object.entries(balances)) {
    if (bal > 0) creditors.push({ id, amt: bal });
    else if (bal < 0) debtors.push({ id, amt: -bal });
  }

  creditors.sort((a, b) => b.amt - a.amt);
  debtors.sort((a, b) => b.amt - a.amt);

  const transfers: SuggestedTransfer[] = [];
  let ci = 0;
  let di = 0;

  while (ci < creditors.length && di < debtors.length) {
    const c = creditors[ci]!;
    const d = debtors[di]!;
    const pay = Math.min(c.amt, d.amt);
    if (pay > 0) {
      transfers.push({ fromMemberId: d.id, toMemberId: c.id, amount: pay });
    }
    c.amt -= pay;
    d.amt -= pay;
    if (c.amt === 0) ci++;
    if (d.amt === 0) di++;
  }

  return transfers;
}
