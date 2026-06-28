import { z } from "zod";
import { queryBool, uuid } from "./common.js";

/** One shared list, name-only items. Bought items move to history. */
export const shoppingItemSchema = z.object({
  id: uuid,
  name: z.string().min(1).max(120),
  addedByMemberId: uuid,
  createdAt: z.string().datetime({ offset: true }),
  boughtAt: z.string().datetime({ offset: true }).nullable(),
});
export type ShoppingItem = z.infer<typeof shoppingItemSchema>;

export const createShoppingItemSchema = z.object({
  name: z.string().min(1).max(120),
});
export type CreateShoppingItem = z.infer<typeof createShoppingItemSchema>;

/** Query for GET /api/shopping — active by default, ?history=true for bought. */
export const shoppingQuerySchema = z.object({
  history: queryBool.default(false),
});
export type ShoppingQuery = z.infer<typeof shoppingQuerySchema>;
