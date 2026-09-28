import { z } from "zod";
import { queryBool, uuid } from "./common.js";

/** Name-only items. `ownerMemberId` null = shared WG list, else a member's private list. */
export const shoppingItemSchema = z.object({
  id: uuid,
  name: z.string().min(1).max(120),
  addedByMemberId: uuid,
  ownerMemberId: uuid.nullable(),
  createdAt: z.string().datetime({ offset: true }),
  boughtAt: z.string().datetime({ offset: true }).nullable(),
});
export type ShoppingItem = z.infer<typeof shoppingItemSchema>;

export const createShoppingItemSchema = z.object({
  name: z.string().min(1).max(120),
  /** true → private item owned by the actor. */
  personal: z.boolean().default(false),
});
export type CreateShoppingItem = z.input<typeof createShoppingItemSchema>;

export const shoppingScopeSchema = z.enum(["wg", "personal"]);
export type ShoppingScope = z.infer<typeof shoppingScopeSchema>;

/** Query for GET /api/shopping — active by default, ?history=true for bought. */
export const shoppingQuerySchema = z.object({
  history: queryBool.default(false),
  scope: shoppingScopeSchema.default("wg"),
});
export type ShoppingQuery = z.infer<typeof shoppingQuerySchema>;
