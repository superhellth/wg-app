import type { CreateFixedCost, FixedCostView, UpdateFixedCost } from "@wg/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { http } from "./client.js";
import { qk } from "./keys.js";

export const fixedCostsApi = {
  list: () => http<FixedCostView[]>("/api/fixed-costs"),
  create: (body: CreateFixedCost) =>
    http<FixedCostView>("/api/fixed-costs", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  update: (id: string, body: UpdateFixedCost) =>
    http<FixedCostView>(`/api/fixed-costs/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  remove: (id: string) =>
    http<void>(`/api/fixed-costs/${id}`, { method: "DELETE" }),
};

export function useFixedCosts() {
  return useQuery({ queryKey: qk.fixedCosts, queryFn: fixedCostsApi.list });
}

function useFixedCostMutation<V>(fn: (v: V) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.fixedCosts });
      qc.invalidateQueries({ queryKey: qk.activity });
    },
  });
}

export const useCreateFixedCost = () => useFixedCostMutation(fixedCostsApi.create);
export const useUpdateFixedCost = () =>
  useFixedCostMutation(({ id, body }: { id: string; body: UpdateFixedCost }) =>
    fixedCostsApi.update(id, body),
  );
export const useDeleteFixedCost = () => useFixedCostMutation(fixedCostsApi.remove);
