import { z } from "zod";
import { uuid } from "./common.js";

/** First-run only: creates the single WG. Allowed when no WG exists yet. */
export const createWgSchema = z.object({
  name: z.string().min(1).max(80),
});
export type CreateWg = z.infer<typeof createWgSchema>;

export const wgSchema = z.object({
  id: uuid,
  name: z.string(),
  createdAt: z.string().datetime({ offset: true }),
});
export type Wg = z.infer<typeof wgSchema>;

/**
 * Response of POST /api/wg. Hands the creator's device the shared WG token
 * (== WG_TOKEN_SECRET) so it can authenticate subsequent requests. The creator
 * then builds the member roster via POST /api/members.
 */
export const createWgResponseSchema = z.object({
  wg: wgSchema,
  wgToken: z.string(),
});
export type CreateWgResponse = z.infer<typeof createWgResponseSchema>;

/**
 * Hard reset: wipe the entire WG (all members, money, chores, meetings,
 * shopping, activity, display config) back to a blank slate. Gated by a fixed
 * password so it can't be triggered casually.
 */
export const resetWgSchema = z.object({
  password: z.string().min(1),
});
export type ResetWg = z.infer<typeof resetWgSchema>;
