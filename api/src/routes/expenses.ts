import {
  createExpenseSchema,
  type ExpenseShare,
  idParamSchema,
  resolveShares,
  type SplitType,
  updateExpenseSchema,
} from "@wg/shared";
import { desc, eq, inArray } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { db, schema } from "../db/client.js";
import { logActivity } from "../lib/activity.js";
import { NotFoundError } from "../lib/errors.js";
import { parse } from "../lib/parse.js";
import { requireMember } from "../plugins/auth.js";

/**
 * Map memberId → the raw split input we persist for faithful edit prefill.
 * `equal` carries no per-member input, so nothing is stored.
 */
function shareInput(type: SplitType, shares: ExpenseShare[]): Map<string, number> {
  const m = new Map<string, number>();
  if (type === "equal") return m;
  for (const s of shares) m.set(s.memberId, s.value);
  return m;
}

export async function expensesRoutes(app: FastifyInstance) {
  app.get("/", async () =>
    db.select().from(schema.expenses).orderBy(desc(schema.expenses.createdAt)),
  );

  app.get("/:id", async (req) => {
    const { id } = parse(idParamSchema, req.params);
    const [expense] = await db
      .select()
      .from(schema.expenses)
      .where(eq(schema.expenses.id, id));
    if (!expense) throw new NotFoundError("expense not found");
    const shares = await db
      .select()
      .from(schema.expenseShares)
      .where(eq(schema.expenseShares.expenseId, id));
    return { ...expense, shares };
  });

  app.post("/", async (req, reply) => {
    const actor = requireMember(req);
    const body = parse(createExpenseSchema, req.body);
    const resolved = resolveShares(body.amount, body.splitType, body.shares);
    const rawInput = shareInput(body.splitType, body.shares);

    const created = await db.transaction(async (tx) => {
      const [expense] = await tx
        .insert(schema.expenses)
        .values({
          payerId: body.payerId,
          amount: body.amount,
          description: body.description,
          category: body.category ?? null,
          splitType: body.splitType,
        })
        .returning();
      await tx.insert(schema.expenseShares).values(
        resolved.map((r) => ({
          expenseId: expense!.id,
          memberId: r.memberId,
          amount: r.amount,
          inputValue: rawInput.get(r.memberId) ?? null,
        })),
      );

      // Atomic shopping bridge: mark selected items bought.
      if (body.shoppingItemIds?.length) {
        const items = await tx
          .update(schema.shoppingItems)
          .set({ boughtAt: new Date() })
          .where(inArray(schema.shoppingItems.id, body.shoppingItemIds))
          .returning();
        await logActivity(tx, {
          memberId: actor.id,
          kind: "shopping.bought",
          data: { snapshot: items },
        });
      }

      await logActivity(tx, {
        memberId: actor.id,
        kind: "expense.created",
        data: { snapshot: { ...expense, shares: resolved } },
      });
      return expense!;
    });
    return reply.status(201).send(created);
  });

  app.patch("/:id", async (req) => {
    const actor = requireMember(req);
    const { id } = parse(idParamSchema, req.params);
    const body = parse(updateExpenseSchema, req.body);
    const resolved = resolveShares(body.amount, body.splitType, body.shares);
    const rawInput = shareInput(body.splitType, body.shares);

    return db.transaction(async (tx) => {
      const [before] = await tx
        .select()
        .from(schema.expenses)
        .where(eq(schema.expenses.id, id));
      if (!before) throw new NotFoundError("expense not found");
      const beforeShares = await tx
        .select()
        .from(schema.expenseShares)
        .where(eq(schema.expenseShares.expenseId, id));

      const [after] = await tx
        .update(schema.expenses)
        .set({
          payerId: body.payerId,
          amount: body.amount,
          description: body.description,
          category: body.category ?? null,
          splitType: body.splitType,
        })
        .where(eq(schema.expenses.id, id))
        .returning();
      await tx
        .delete(schema.expenseShares)
        .where(eq(schema.expenseShares.expenseId, id));
      await tx.insert(schema.expenseShares).values(
        resolved.map((r) => ({
          expenseId: id,
          memberId: r.memberId,
          amount: r.amount,
          inputValue: rawInput.get(r.memberId) ?? null,
        })),
      );

      await logActivity(tx, {
        memberId: actor.id,
        kind: "expense.updated",
        data: {
          before: { ...before, shares: beforeShares },
          after: { ...after, shares: resolved },
        },
      });
      return after!;
    });
  });

  app.delete("/:id", async (req, reply) => {
    const actor = requireMember(req);
    const { id } = parse(idParamSchema, req.params);
    await db.transaction(async (tx) => {
      const [before] = await tx
        .select()
        .from(schema.expenses)
        .where(eq(schema.expenses.id, id));
      if (!before) throw new NotFoundError("expense not found");
      const shares = await tx
        .select()
        .from(schema.expenseShares)
        .where(eq(schema.expenseShares.expenseId, id));

      await tx
        .delete(schema.expenseShares)
        .where(eq(schema.expenseShares.expenseId, id));
      await tx.delete(schema.expenses).where(eq(schema.expenses.id, id));

      await logActivity(tx, {
        memberId: actor.id,
        kind: "expense.deleted",
        data: { snapshot: { ...before, shares } },
      });
    });
    return reply.status(204).send();
  });
}
