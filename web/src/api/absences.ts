import type { Absence, CreateAbsence, UpdateAbsence } from "@wg/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { http } from "./client.js";
import { qk } from "./keys.js";

export const absencesApi = {
  list: (memberId?: string) =>
    http<Absence[]>(`/api/absences${memberId ? `?memberId=${memberId}` : ""}`),
  get: (id: string) => http<Absence>(`/api/absences/${id}`),
  create: (body: CreateAbsence) =>
    http<Absence>("/api/absences", { method: "POST", body: JSON.stringify(body) }),
  update: (id: string, body: UpdateAbsence) =>
    http<Absence>(`/api/absences/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  remove: (id: string) => http<void>(`/api/absences/${id}`, { method: "DELETE" }),
};

export function useAbsences(memberId?: string) {
  return useQuery({
    queryKey: qk.absences(memberId),
    queryFn: () => absencesApi.list(memberId),
  });
}

export function useAbsence(id?: string) {
  return useQuery({
    queryKey: qk.absence(id ?? ""),
    queryFn: () => absencesApi.get(id!),
    enabled: !!id,
  });
}

export function useCreateAbsence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: absencesApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.absencesAll });
      qc.invalidateQueries({ queryKey: qk.activity });
    },
  });
}

export function useUpdateAbsence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateAbsence }) =>
      absencesApi.update(id, body),
    onSuccess: (_d, { id }) => {
      qc.invalidateQueries({ queryKey: qk.absencesAll });
      qc.invalidateQueries({ queryKey: qk.absence(id) });
      qc.invalidateQueries({ queryKey: qk.activity });
    },
  });
}

export function useDeleteAbsence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: absencesApi.remove,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.absencesAll });
      qc.invalidateQueries({ queryKey: qk.activity });
    },
  });
}
