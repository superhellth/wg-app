import type { CreateWg, CreateWgResponse, RedeemInviteResponse } from "@wg/shared";
import { http } from "./client.js";

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
};
