import type { CreateMeeting, Meeting, UpdateMeeting } from "@wg/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { http } from "./client.js";
import { qk } from "./keys.js";

export const meetingsApi = {
  list: () => http<Meeting[]>("/api/meetings"),
  get: (id: string) => http<Meeting>(`/api/meetings/${id}`),
  create: (body: CreateMeeting) =>
    http<Meeting>("/api/meetings", { method: "POST", body: JSON.stringify(body) }),
  update: (id: string, body: UpdateMeeting) =>
    http<Meeting>(`/api/meetings/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  remove: (id: string) => http<void>(`/api/meetings/${id}`, { method: "DELETE" }),
};

export function useMeetings() {
  return useQuery({ queryKey: qk.meetings, queryFn: meetingsApi.list });
}
export function useMeeting(id?: string) {
  return useQuery({
    queryKey: qk.meeting(id ?? ""),
    queryFn: () => meetingsApi.get(id!),
    enabled: !!id,
  });
}

function useMeetingMutation<V>(fn: (v: V) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.meetings });
      qc.invalidateQueries({ queryKey: qk.activity });
    },
  });
}

export const useCreateMeeting = () => useMeetingMutation(meetingsApi.create);
export function useUpdateMeeting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateMeeting }) =>
      meetingsApi.update(id, body),
    onSuccess: (_d, { id }) => {
      qc.invalidateQueries({ queryKey: qk.meetings });
      qc.invalidateQueries({ queryKey: qk.meeting(id) });
      qc.invalidateQueries({ queryKey: qk.activity });
    },
  });
}
export const useDeleteMeeting = () => useMeetingMutation(meetingsApi.remove);
