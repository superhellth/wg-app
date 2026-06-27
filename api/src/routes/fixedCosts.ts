import {
  createFixedCostSchema,
  idParamSchema,
  updateFixedCostSchema,
} from "@wg/shared";
import { eq, isNull } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { db, schema } from "../db/client.js";
import { logActivity } from "../lib/activity.js";
import { NotFoundError } from "../lib/errors.js";
import { parse } from "../lib/parse.js";
import { requireMember } from "../plugins/auth.js";

async function activeMemberCount(): Promise<number> {
  const rows = await db
    .select({ id: schema.members.id })
    .from(schema.members)
    .where(isNull(schema.members.archivedAt));
  return rows.length;
}

export async function fixedCostsRoutes(app: FastifyInstance) {
  // Per-person share computed on read: equal among active members.
  app.get("/", async () => {
    const n = (await activeMemberCount()) || 1;
    const costs = await db.select().from(schema.fixedCosts);
    return costs.map((c) => ({ ...c, perPersonShare: Math.round(c.amount / n) }));
  });

  app.post("/", async (req, reply) => {
    const actor = requireMember(req);
    const body = parse(createFixedCostSchema, req.body);
    const created = await db.transaction(async (tx) => {
      const [c] = await tx
        .insert(schema.fixedCosts)
        .values({
          name: body.name,
          amount: body.amount,
          cycle: body.cycle,
          contractHolderId: body.contractHolderId,
        })
        .returning();
      await logActivity(tx, {
        memberId: actor.id,
        kind: "fixedcost.added",
        data: { snapshot: c },
      });
      return c!;
    });
    return reply.status(201).send(created);
  });

  app.patch("/:id", async (req) => {
    const actor = requireMember(req);
    const { id } = parse(idParamSchema, req.params);
    const body = parse(updateFixedCostSchema, req.body);
    return db.transaction(async (tx) => {
      const [before] = await tx
        .select()
        .from(schema.fixedCosts)
        .where(eq(schema.fixedCosts.id, id));
      if (!before) throw new NotFoundError("fixed cost not found");
      const [after] = await tx
        .update(schema.fixedCosts)
        .set({
          name: body.name,
          amount: body.amount,
          cycle: body.cycle,
          contractHolderId: body.contractHolderId,
        })
        .where(eq(schema.fixedCosts.id, id))
        .returning();
      await logActivity(tx, {
        memberId: actor.id,
        kind: "fixedcost.updated",
        data: { before, after },
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
        .from(schema.fixedCosts)
        .where(eq(schema.fixedCosts.id, id));
      if (!before) throw new NotFoundError("fixed cost not found");
      await tx.delete(schema.fixedCosts).where(eq(schema.fixedCosts.id, id));
      await logActivity(tx, {
        memberId: actor.id,
        kind: "fixedcost.deleted",
        data: { snapshot: before },
      });
    });
    return reply.status(204).send();
  });
}
