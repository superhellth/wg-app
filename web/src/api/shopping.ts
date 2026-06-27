import type { CreateShoppingItem, ShoppingItem } from "@wg/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { http } from "./client.js";
import { qk } from "./keys.js";

export const shoppingApi = {
  list: (history = false) =>
    http<ShoppingItem[]>(`/api/shopping?history=${history}`),
  add: (body: CreateShoppingItem) =>
    http<ShoppingItem>("/api/shopping", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  markBought: (id: string) =>
    http<ShoppingItem>(`/api/shopping/${id}/bought`, { method: "PATCH" }),
  remove: (id: string) => http<void>(`/api/shopping/${id}`, { method: "DELETE" }),
};

export function useShopping(history = false) {
  return useQuery({
    queryKey: qk.shopping(history),
    queryFn: () => shoppingApi.list(history),
  });
}

function useShoppingMutation<V>(fn: (v: V) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.shoppingAll });
      qc.invalidateQueries({ queryKey: qk.activity });
    },
  });
}

export const useAddShoppingItem = () => useShoppingMutation(shoppingApi.add);
export const useMarkBought = () => useShoppingMutation(shoppingApi.markBought);
export const useDeleteShoppingItem = () => useShoppingMutation(shoppingApi.remove);
