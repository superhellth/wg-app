import type { Chore, ChoreTurn, CreateChore, SwapTurn, UpdateChore } from "@wg/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { http } from "./client.js";
import { qk } from "./keys.js";

export type ChoreWithTurn = Chore & { currentTurn: ChoreTurn | null };

export const choresApi = {
  list: () => http<ChoreWithTurn[]>("/api/chores"),
  create: (body: CreateChore) =>
    http<{ chore: Chore; turn: ChoreTurn }>("/api/chores", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  update: (id: string, body: UpdateChore) =>
    http<Chore>(`/api/chores/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  done: (id: string) =>
    http<ChoreTurn>(`/api/chores/${id}/done`, { method: "POST" }),
  skip: (id: string) =>
    http<ChoreTurn>(`/api/chores/${id}/skip`, { method: "POST" }),
  swap: (id: string, body: SwapTurn) =>
    http<ChoreTurn>(`/api/chores/${id}/turn/assignee`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  remind: (id: string) =>
    http<void>(`/api/chores/${id}/remind`, { method: "POST" }),
  remove: (id: string) => http<void>(`/api/chores/${id}`, { method: "DELETE" }),
};

export function useChores() {
  return useQuery({ queryKey: qk.chores, queryFn: choresApi.list });
}

function useChoreMutation<V>(fn: (v: V) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.chores });
      qc.invalidateQueries({ queryKey: qk.activity });
    },
  });
}

export const useCreateChore = () => useChoreMutation(choresApi.create);
export const useUpdateChore = () =>
  useChoreMutation(({ id, body }: { id: string; body: UpdateChore }) =>
    choresApi.update(id, body),
  );
export const useChoreDone = () => useChoreMutation(choresApi.done);
export const useChoreSkip = () => useChoreMutation(choresApi.skip);
export const useChoreSwap = () =>
  useChoreMutation(({ id, body }: { id: string; body: SwapTurn }) =>
    choresApi.swap(id, body),
  );
export const useChoreRemind = () => useChoreMutation(choresApi.remind);
export const useDeleteChore = () => useChoreMutation(choresApi.remove);
