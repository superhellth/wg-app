import type { Invite } from "@wg/shared";
import { useMutation } from "@tanstack/react-query";
import { http } from "./client.js";

export const invitesApi = {
  create: () => http<Invite>("/api/invites", { method: "POST" }),
};

export function useCreateInvite() {
  return useMutation({ mutationFn: invitesApi.create });
}
