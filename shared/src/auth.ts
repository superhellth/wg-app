import { z } from "zod";
import { uuid } from "./common.js";

/**
 * What every authenticated request carries.
 *  - wgToken: the single shared WG secret (== WG_TOKEN_SECRET). Proves membership,
 *    NOT identity. Sent as `Authorization: Bearer <wgToken>`.
 *  - memberId: the device's current, UNVERIFIED local identity choice.
 *    Sent as `X-Member-Id`. Trust-based; impersonation is possible by design.
 */
export const authContextSchema = z.object({
  wgToken: z.string().min(8),
  memberId: uuid.nullable(),
});
export type AuthContext = z.infer<typeof authContextSchema>;

export const AUTH_HEADER = "authorization" as const;
export const MEMBER_HEADER = "x-member-id" as const;
