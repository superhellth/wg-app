import { resolveShares } from "@wg/shared";
import { and, eq, isNull, lte } from "drizzle-orm";
import { db, schema } from "../db/client.js";
import { logActivity } from "../lib/activity.js";
import { nextCycleDate } from "../lib/time.js";

/**
 * Fixed-cost auto-generation — run daily. Every active fixed cost whose
 * `nextDueAt` has passed gets a matching expense inserted (payer = contract
 * holder, equal split among currently-active members), logged to the
 * activity feed as a system action (memberId: null, reusing the
 * `expense.created` kind), then `nextDueAt` is advanced by one cycle.
 *
 * Catch-up: if the worker was down across multiple cycle boundaries, only
 * ONE expense is generated for the whole gap — `nextDueAt` keeps advancing
 * (in-memory, before the single DB write) until it's back in the future.
 */
export async function runFixedCostGeneration(now = new Date()): Promise<void> {
  const due = await db
    .select()
    .from(schema.fixedCosts)
    .where(and(eq(schema.fixedCosts.active, true), lte(schema.fixedCosts.nextDueAt, now)));

  if (due.length === 0) return;

  const activeMembers = await db
    .select({ id: schema.members.id })
    .from(schema.members)
    .where(isNull(schema.members.archivedAt));

  if (activeMembers.length === 0) {
    console.error("[worker] fixedcost-generation: no active members, skipping this tick");
    return;
  }

  for (const cost of due) {
    let nextDueAt = cost.nextDueAt;
    do {
      nextDueAt = nextCycleDate(nextDueAt, cost.cycle);
    } while (nextDueAt.getTime() <= now.getTime());

    const shares = activeMembers.map((m) => ({ memberId: m.id, value: 1 }));
    const resolved = resolveShares(cost.amount, "equal", shares);

    await db.transaction(async (tx) => {
      const [expense] = await tx
        .insert(schema.expenses)
        .values({
          payerId: cost.contractHolderId,
          amount: cost.amount,
          description: cost.name,
          category: "Fixkosten",
          splitType: "equal",
        })
        .returning();
      await tx.insert(schema.expenseShares).values(
        resolved.map((r) => ({
          expenseId: expense!.id,
          memberId: r.memberId,
          amount: r.amount,
          inputValue: null,
        })),
      );
      await logActivity(tx, {
        memberId: null,
        kind: "expense.created",
        data: { snapshot: { ...expense, shares: resolved } },
      });
      await tx
        .update(schema.fixedCosts)
        .set({ nextDueAt })
        .where(eq(schema.fixedCosts.id, cost.id));
    });
  }

  console.log(`[worker] fixedcost-generation created ${due.length} expense(s)`);
}
