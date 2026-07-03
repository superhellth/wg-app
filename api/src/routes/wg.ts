import { createWgSchema, resetWgSchema, updateWgConfigSchema } from "@wg/shared";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { db, schema } from "../db/client.js";
import { env } from "../env.js";
import { logActivity } from "../lib/activity.js";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "../lib/errors.js";
import { parse } from "../lib/parse.js";
import { requireMember } from "../plugins/auth.js";

/** Hardcoded reset password (intentionally not a per-WG secret). */
const RESET_PASSWORD = "Utopie!";

/** Public, first-run only. Allowed when no WG exists yet (one-WG invariant). */
export async function wgRoutes(app: FastifyInstance) {
  app.post("/", async (req, reply) => {
    const body = parse(createWgSchema, req.body);
    const existing = await db.select({ id: schema.wg.id }).from(schema.wg).limit(1);
    if (existing.length > 0) throw new ConflictError("WG already exists");

    const [wg] = await db
      .insert(schema.wg)
      .values({ name: body.name })
      .returning();
    return reply.status(201).send({ wg, wgToken: env.WG_TOKEN_SECRET });
  });
}

/**
 * Protected WG chore config — the shared rotation + grace window. Rotation is
 * auto-maintained by the member routes (append on add, remove on archive); the
 * PATCH here only reorders it (a permutation of the current set) and/or sets the
 * grace window. See docs/chore-rota-redesign.md.
 */
export async function wgConfigRoutes(app: FastifyInstance) {
  app.get("/", async () => {
    const [wg] = await db
      .select({
        id: schema.wg.id,
        name: schema.wg.name,
        rotation: schema.wg.rotation,
        graceDays: schema.wg.graceDays,
      })
      .from(schema.wg)
      .limit(1);
    if (!wg) throw new NotFoundError("WG not found");
    return wg;
  });

  app.patch("/", async (req) => {
    const body = parse(updateWgConfigSchema, req.body);
    const actor = requireMember(req);
    return db.transaction(async (tx) => {
      const [before] = await tx.select().from(schema.wg).limit(1);
      if (!before) throw new NotFoundError("WG not found");

      const patch: Partial<typeof schema.wg.$inferInsert> = {};
      if (body.graceDays !== undefined) patch.graceDays = body.graceDays;
      if (body.rotation !== undefined) {
        // reorder only — must be a permutation of the current rotation
        const cur = [...before.rotation].sort();
        const next = [...body.rotation].sort();
        if (cur.length !== next.length || cur.some((v, i) => v !== next[i])) {
          throw new BadRequestError("Rotation darf nur umsortiert werden");
        }
        patch.rotation = body.rotation;
      }

      const [after] = await tx
        .update(schema.wg)
        .set(patch)
        .where(eq(schema.wg.id, before.id))
        .returning();
      await logActivity(tx, {
        memberId: actor.id,
        kind: "chore.updated",
        data: { before, after },
      });
      return {
        id: after!.id,
        name: after!.name,
        rotation: after!.rotation,
        graceDays: after!.graceDays,
      };
    });
  });
}

/**
 * Protected (WG token) + password-gated full reset. Deletes every row so the
 * app returns to its first-run state (no WG, no members). Children are removed
 * before parents to respect foreign keys; the whole wipe is one transaction.
 */
export async function wgResetRoutes(app: FastifyInstance) {
  app.post("/reset", async (req, reply) => {
    const { password } = parse(resetWgSchema, req.body);
    if (password !== RESET_PASSWORD) throw new ForbiddenError("Falsches Passwort");

    await db.transaction(async (tx) => {
      // children → parents (FK order)
      await tx.delete(schema.expenseShares);
      await tx.delete(schema.meetingVotes);
      await tx.delete(schema.meetingOptions);
      await tx.delete(schema.meetingRsvps);
      await tx.delete(schema.choreTurns);
      await tx.delete(schema.expenses);
      await tx.delete(schema.settlements);
      await tx.delete(schema.fixedCosts);
      await tx.delete(schema.shoppingItems);
      await tx.delete(schema.chores);
      await tx.delete(schema.meetings);
      await tx.delete(schema.devices);
      await tx.delete(schema.invites);
      await tx.delete(schema.activity);
      await tx.delete(schema.displayConfig);
      await tx.delete(schema.members);
      await tx.delete(schema.wg);
    });

    return reply.status(204).send();
  });
}
