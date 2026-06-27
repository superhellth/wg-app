import type { CreateMember, Member, UpdateMember } from "@wg/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { http } from "./client.js";
import { qk } from "./keys.js";

export const membersApi = {
  list: (includeArchived = false) =>
    http<Member[]>(`/api/members?includeArchived=${includeArchived}`),
  add: (body: CreateMember) =>
    http<Member>("/api/members", { method: "POST", body: JSON.stringify(body) }),
  update: (id: string, body: UpdateMember) =>
    http<Member>(`/api/members/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  archive: (id: string) =>
    http<Member>(`/api/members/${id}/archive`, { method: "PATCH" }),
  restore: (id: string) =>
    http<Member>(`/api/members/${id}/restore`, { method: "PATCH" }),
};

export function useMembers(includeArchived = false) {
  return useQuery({
    queryKey: qk.members(includeArchived),
    queryFn: () => membersApi.list(includeArchived),
  });
}

/** id → Member lookup (includes archived) for names/avatars across the app. */
export function useMembersMap() {
  const { data } = useMembers(true);
  return useMemo(
    () => new Map((data ?? []).map((m) => [m.id, m] as const)),
    [data],
  );
}

export function useAddMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: membersApi.add,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.membersAll }),
  });
}
export function useUpdateMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateMember }) =>
      membersApi.update(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.membersAll }),
  });
}
export function useArchiveMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: membersApi.archive,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.membersAll });
      qc.invalidateQueries({ queryKey: qk.chores });
    },
  });
}
export function useRestoreMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: membersApi.restore,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.membersAll }),
  });
}
