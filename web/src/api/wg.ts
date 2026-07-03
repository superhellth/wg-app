import type {
  CreateWg,
  CreateWgResponse,
  RedeemInviteResponse,
  UpdateWgConfig,
  WgConfig,
} from "@wg/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { http } from "./client.js";
import { qk } from "./keys.js";

export const wgApi = {
  create: (body: CreateWg) =>
    http<CreateWgResponse>("/api/wg", { method: "POST", body: JSON.stringify(body) }),
  redeem: (token: string) =>
    http<RedeemInviteResponse>(
      `/api/invites/${encodeURIComponent(token)}/redeem`,
      { method: "POST" },
    ),
  reset: (password: string) =>
    http<void>("/api/wg/reset", {
      method: "POST",
      body: JSON.stringify({ password }),
    }),
  config: () => http<WgConfig>("/api/wg"),
  updateConfig: (body: UpdateWgConfig) =>
    http<WgConfig>("/api/wg", { method: "PATCH", body: JSON.stringify(body) }),
};

/** Shared chore config: the rotation order + grace window. */
export function useWgConfig() {
  return useQuery({ queryKey: qk.wgConfig, queryFn: wgApi.config });
}

export function useUpdateWgConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: wgApi.updateConfig,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.wgConfig });
      qc.invalidateQueries({ queryKey: qk.chores });
    },
  });
}
