import { INVITE_TTL_HOURS, inviteTokenParamSchema } from "@wg/shared";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { randomBytes } from "node:crypto";
import { db, schema } from "../db/client.js";
import { env } from "../env.js";
import { GoneError } from "../lib/errors.js";
import { parse } from "../lib/parse.js";
import { requireMember } from "../plugins/auth.js";

/** Protected: create an invite (opaque token, 24h, reusable). */
export async function invitesRoutes(app: FastifyInstance) {
  app.post("/", async (req, reply) => {
    const actor = requireMember(req);
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + INVITE_TTL_HOURS * 3600_000);
    const [invite] = await db
      .insert(schema.invites)
      .values({ token, expiresAt, createdByMemberId: actor.id })
      .returning();
    return reply.status(201).send({
      token: invite!.token,
      expiresAt: invite!.expiresAt,
    });
  });
}

/** Public: redeem an invite. The valid invite is the credential (no auth). */
export async function inviteRedeemRoutes(app: FastifyInstance) {
  app.post("/:token/redeem", async (req, reply) => {
    const { token } = parse(inviteTokenParamSchema, req.params);
    const [invite] = await db
      .select()
      .from(schema.invites)
      .where(eq(schema.invites.token, token));
    if (!invite) throw new GoneError("invite invalid");
    if (invite.expiresAt.getTime() < Date.now()) {
      throw new GoneError("invite expired");
    }
    // Reusable until expiry — no burn. Device picks its identity from the roster.
    return reply.send({ wgToken: env.WG_TOKEN_SECRET });
  });
}
