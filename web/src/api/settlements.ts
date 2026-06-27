import type { CreateSettlement, Settlement, UpdateSettlement } from "@wg/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { http } from "./client.js";
import { qk } from "./keys.js";

export const settlementsApi = {
  list: () => http<Settlement[]>("/api/settlements"),
  create: (body: CreateSettlement) =>
    http<Settlement>("/api/settlements", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  update: (id: string, body: UpdateSettlement) =>
    http<Settlement>(`/api/settlements/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  remove: (id: string) =>
    http<void>(`/api/settlements/${id}`, { method: "DELETE" }),
};

export function useSettlements() {
  return useQuery({ queryKey: qk.settlements, queryFn: settlementsApi.list });
}

function useSettlementMutation<V>(fn: (v: V) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.settlements });
      qc.invalidateQueries({ queryKey: qk.balances });
      qc.invalidateQueries({ queryKey: qk.activity });
    },
  });
}

export const useCreateSettlement = () => useSettlementMutation(settlementsApi.create);
export const useUpdateSettlement = () =>
  useSettlementMutation(({ id, body }: { id: string; body: UpdateSettlement }) =>
    settlementsApi.update(id, body),
  );
export const useDeleteSettlement = () => useSettlementMutation(settlementsApi.remove);
