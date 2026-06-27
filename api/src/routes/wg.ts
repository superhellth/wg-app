import { createWgSchema } from "@wg/shared";
import type { FastifyInstance } from "fastify";
import { db, schema } from "../db/client.js";
import { env } from "../env.js";
import { ConflictError } from "../lib/errors.js";
import { parse } from "../lib/parse.js";

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
