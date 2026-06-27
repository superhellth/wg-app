import { registerDeviceSchema, unregisterDeviceSchema } from "@wg/shared";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { db, schema } from "../db/client.js";
import { parse } from "../lib/parse.js";

/** Push device registration. Upsert by endpoint; re-post to switch identity. */
export async function devicesRoutes(app: FastifyInstance) {
  app.post("/", async (req, reply) => {
    const body = parse(registerDeviceSchema, req.body);
    const [device] = await db
      .insert(schema.devices)
      .values({
        pushEndpoint: body.pushEndpoint,
        pushKeys: body.pushKeys,
        currentMemberId: body.memberId,
      })
      .onConflictDoUpdate({
        target: schema.devices.pushEndpoint,
        set: { pushKeys: body.pushKeys, currentMemberId: body.memberId },
      })
      .returning();
    return reply.status(201).send(device);
  });

  app.delete("/", async (req, reply) => {
    const body = parse(unregisterDeviceSchema, req.body);
    await db
      .delete(schema.devices)
      .where(eq(schema.devices.pushEndpoint, body.pushEndpoint));
    return reply.status(204).send();
  });
}
