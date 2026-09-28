import {
  createShoppingItemSchema,
  idParamSchema,
  shoppingQuerySchema,
} from "@wg/shared";
import { and, desc, eq, isNotNull, isNull, sql, type SQL } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { db, schema } from "../db/client.js";
import { logActivity } from "../lib/activity.js";
import { ConflictError, NotFoundError } from "../lib/errors.js";
import { parse } from "../lib/parse.js";
import { requireMember } from "../plugins/auth.js";

const t = schema.shoppingItems;

/** Owner filter: null owner = WG list, else that member's list. */
const ownerIs = (ownerId: string | null): SQL =>
  ownerId === null ? isNull(t.ownerMemberId) : eq(t.ownerMemberId, ownerId);

/** Personal items of other members look like they don't exist. */
function assertVisible(item: { ownerMemberId: string | null } | undefined, actorId: string) {
  if (!item || (item.ownerMemberId !== null && item.ownerMemberId !== actorId)) {
    throw new NotFoundError("item not found");
  }
}

export async function shoppingRoutes(app: FastifyInstance) {
  // Active by default; ?history=true for bought items. ?scope=personal → own list.
  app.get("/", async (req) => {
    const actor = requireMember(req);
    const { history, scope } = parse(shoppingQuerySchema, req.query);
    return db
      .select()
      .from(t)
      .where(
        and(
          ownerIs(scope === "personal" ? actor.id : null),
          history ? isNotNull(t.boughtAt) : isNull(t.boughtAt),
        ),
      )
      .orderBy(desc(t.createdAt));
  });

  app.post("/", async (req, reply) => {
    const actor = requireMember(req);
    const body = parse(createShoppingItemSchema, req.body);
    const name = body.name.trim();
    const ownerId = body.personal ? actor.id : null;
    const item = await db.transaction(async (tx) => {
      // Active names are unique (case-insensitive) per owner. Bought items don't count.
      const [dupe] = await tx
        .select({ id: t.id })
        .from(t)
        .where(
          and(
            isNull(t.boughtAt),
            ownerIs(ownerId),
            sql`lower(${t.name}) = ${name.toLowerCase()}`,
          ),
        )
        .limit(1);
      if (dupe) throw new ConflictError("Artikel steht schon auf der Liste");

      const [it] = await tx
        .insert(t)
        .values({ name, addedByMemberId: actor.id, ownerMemberId: ownerId })
        .returning();
      if (ownerId === null) {
        await logActivity(tx, {
          memberId: actor.id,
          kind: "shopping.added",
          data: { snapshot: it },
        });
      }
      return it!;
    });
    return reply.status(201).send(item);
  });

  app.patch("/:id/bought", async (req) => {
    const actor = requireMember(req);
    const { id } = parse(idParamSchema, req.params);
    return db.transaction(async (tx) => {
      const [before] = await tx.select().from(t).where(eq(t.id, id));
      assertVisible(before, actor.id);
      const [after] = await tx
        .update(t)
        .set({ boughtAt: new Date() })
        .where(eq(t.id, id))
        .returning();
      if (before!.ownerMemberId === null) {
        await logActivity(tx, {
          memberId: actor.id,
          kind: "shopping.bought",
          data: { snapshot: after },
        });
      }
      return after!;
    });
  });

  // Hard delete — for typos (distinct from the "bought" path). No activity row.
  app.delete("/:id", async (req, reply) => {
    const actor = requireMember(req);
    const { id } = parse(idParamSchema, req.params);
    const [item] = await db.select().from(t).where(eq(t.id, id));
    assertVisible(item, actor.id);
    await db.delete(t).where(eq(t.id, id));
    return reply.status(204).send();
  });
}
