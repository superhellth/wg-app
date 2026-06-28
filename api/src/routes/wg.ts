import { createWgSchema, resetWgSchema } from "@wg/shared";
import type { FastifyInstance } from "fastify";
import { db, schema } from "../db/client.js";
import { env } from "../env.js";
import { ConflictError, ForbiddenError } from "../lib/errors.js";
import { parse } from "../lib/parse.js";

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
