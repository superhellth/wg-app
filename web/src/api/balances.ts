import type { BalancesResponse } from "@wg/shared";
import { useQuery } from "@tanstack/react-query";
import { http } from "./client.js";
import { qk } from "./keys.js";

export const balancesApi = {
  get: () => http<BalancesResponse>("/api/balances"),
};

export function useBalances() {
  return useQuery({ queryKey: qk.balances, queryFn: balancesApi.get });
}
