import {
  createShoppingItemSchema,
  idParamSchema,
  shoppingQuerySchema,
} from "@wg/shared";
import { and, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { db, schema } from "../db/client.js";
import { logActivity } from "../lib/activity.js";
import { ConflictError, NotFoundError } from "../lib/errors.js";
import { parse } from "../lib/parse.js";
import { requireMember } from "../plugins/auth.js";

export async function shoppingRoutes(app: FastifyInstance) {
  // Active by default; ?history=true for bought items.
  app.get("/", async (req) => {
    const { history } = parse(shoppingQuerySchema, req.query);
    return db
      .select()
      .from(schema.shoppingItems)
      .where(
        history
          ? isNotNull(schema.shoppingItems.boughtAt)
          : isNull(schema.shoppingItems.boughtAt),
      )
      .orderBy(desc(schema.shoppingItems.createdAt));
  });

  app.post("/", async (req, reply) => {
    const actor = requireMember(req);
    const body = parse(createShoppingItemSchema, req.body);
    const name = body.name.trim();
    const item = await db.transaction(async (tx) => {
      // Active list names are unique (case-insensitive) — no buying the same
      // thing twice. Bought/history items don't count.
      const [dupe] = await tx
        .select({ id: schema.shoppingItems.id })
        .from(schema.shoppingItems)
        .where(
          and(
            isNull(schema.shoppingItems.boughtAt),
            sql`lower(${schema.shoppingItems.name}) = ${name.toLowerCase()}`,
          ),
        )
        .limit(1);
      if (dupe) throw new ConflictError("Artikel steht schon auf der Liste");

      const [it] = await tx
        .insert(schema.shoppingItems)
        .values({ name, addedByMemberId: actor.id })
        .returning();
      await logActivity(tx, {
        memberId: actor.id,
        kind: "shopping.added",
        data: { snapshot: it },
      });
      return it!;
    });
    return reply.status(201).send(item);
  });

  app.patch("/:id/bought", async (req) => {
    const actor = requireMember(req);
    const { id } = parse(idParamSchema, req.params);
    return db.transaction(async (tx) => {
      const [before] = await tx
        .select()
        .from(schema.shoppingItems)
        .where(eq(schema.shoppingItems.id, id));
      if (!before) throw new NotFoundError("item not found");
      const [after] = await tx
        .update(schema.shoppingItems)
        .set({ boughtAt: new Date() })
        .where(eq(schema.shoppingItems.id, id))
        .returning();
      await logActivity(tx, {
        memberId: actor.id,
        kind: "shopping.bought",
        data: { snapshot: after },
      });
      return after!;
    });
  });

  // Hard delete — for typos (distinct from the "bought" path).
  app.delete("/:id", async (req, reply) => {
    const { id } = parse(idParamSchema, req.params);
    await db.delete(schema.shoppingItems).where(eq(schema.shoppingItems.id, id));
    return reply.status(204).send();
  });
}
