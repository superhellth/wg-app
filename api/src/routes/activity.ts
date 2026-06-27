import { activityQuerySchema } from "@wg/shared";
import { desc, lt } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { db, schema } from "../db/client.js";
import { parse } from "../lib/parse.js";

export async function activityRoutes(app: FastifyInstance) {
  // Newest first, cursor pagination on (createdAt, id). Read-only.
  app.get("/", async (req) => {
    const { before, limit } = parse(activityQuerySchema, req.query);

    const where = before
      ? lt(schema.activity.createdAt, new Date(before))
      : undefined;

    return db
      .select()
      .from(schema.activity)
      .where(where)
      .orderBy(desc(schema.activity.createdAt), desc(schema.activity.id))
      .limit(limit);
  });
}
