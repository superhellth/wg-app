import { z } from "zod";

/** Invite tokens are opaque random, DB-backed, reusable until expiry. */
export const INVITE_TTL_HOURS = 24;

/**
 * Response of POST /api/invites (authed). No request body — the actor comes
 * from the X-Member-Id header and the 24h expiry is server-set.
 */
export const inviteSchema = z.object({
  token: z.string(),
  expiresAt: z.string().datetime({ offset: true }),
});
export type Invite = z.infer<typeof inviteSchema>;

/** Route param for POST /api/invites/:token/redeem. */
export const inviteTokenParamSchema = z.object({
  token: z.string().min(1),
});
export type InviteTokenParam = z.infer<typeof inviteTokenParamSchema>;

/**
 * Response of redeem (no auth — the valid invite is the credential). Returns
 * the shared WG token; the device then picks its identity from the roster.
 */
export const redeemInviteResponseSchema = z.object({
  wgToken: z.string(),
});
export type RedeemInviteResponse = z.infer<typeof redeemInviteResponseSchema>;
