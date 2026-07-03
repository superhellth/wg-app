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
 * WG-wide chore config (see docs/chore-rota-redesign.md). `rotation` is the one
 * shared, ordered member list every task passes around; it's auto-maintained
 * (append on add, remove on archive) and reorderable here. `graceDays` is the
 * post-deadline grace window (default 2 = through Tuesday): completing within it
 * passes normally, past it skips the next person.
 */
export const wgConfigSchema = z.object({
  id: uuid,
  name: z.string(),
  rotation: z.array(uuid),
  graceDays: z.number().int().min(0).max(6),
});
export type WgConfig = z.infer<typeof wgConfigSchema>;

/** PATCH body for the WG chore config — reorder rotation and/or set graceDays. */
export const updateWgConfigSchema = z
  .object({
    rotation: z.array(uuid).optional(),
    graceDays: z.number().int().min(0).max(6).optional(),
  })
  .refine((v) => v.rotation !== undefined || v.graceDays !== undefined, {
    message: "nothing to update",
  });
export type UpdateWgConfig = z.infer<typeof updateWgConfigSchema>;

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
