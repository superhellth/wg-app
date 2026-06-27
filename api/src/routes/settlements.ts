import {
  createSettlementSchema,
  idParamSchema,
  updateSettlementSchema,
} from "@wg/shared";
import { desc, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { db, schema } from "../db/client.js";
import { logActivity } from "../lib/activity.js";
import { NotFoundError } from "../lib/errors.js";
import { parse } from "../lib/parse.js";
import { requireMember } from "../plugins/auth.js";

export async function settlementsRoutes(app: FastifyInstance) {
  app.get("/", async () =>
    db
      .select()
      .from(schema.settlements)
      .orderBy(desc(schema.settlements.createdAt)),
  );

  app.post("/", async (req, reply) => {
    const actor = requireMember(req);
    const body = parse(createSettlementSchema, req.body);
    const created = await db.transaction(async (tx) => {
      const [s] = await tx
        .insert(schema.settlements)
        .values({
          fromMemberId: body.fromMemberId,
          toMemberId: body.toMemberId,
          amount: body.amount,
        })
        .returning();
      await logActivity(tx, {
        memberId: actor.id,
        kind: "settlement.created",
        data: { snapshot: s },
      });
      return s!;
    });
    return reply.status(201).send(created);
  });

  app.patch("/:id", async (req) => {
    const actor = requireMember(req);
    const { id } = parse(idParamSchema, req.params);
    const body = parse(updateSettlementSchema, req.body);
    return db.transaction(async (tx) => {
      const [before] = await tx
        .select()
        .from(schema.settlements)
        .where(eq(schema.settlements.id, id));
      if (!before) throw new NotFoundError("settlement not found");
      const [after] = await tx
        .update(schema.settlements)
        .set({
          fromMemberId: body.fromMemberId,
          toMemberId: body.toMemberId,
          amount: body.amount,
        })
        .where(eq(schema.settlements.id, id))
        .returning();
      await logActivity(tx, {
        memberId: actor.id,
        kind: "settlement.updated",
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
        .from(schema.settlements)
        .where(eq(schema.settlements.id, id));
      if (!before) throw new NotFoundError("settlement not found");
      await tx.delete(schema.settlements).where(eq(schema.settlements.id, id));
      await logActivity(tx, {
        memberId: actor.id,
        kind: "settlement.deleted",
        data: { snapshot: before },
      });
    });
    return reply.status(204).send();
  });
}
