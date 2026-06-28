import type { DisplayConfig, UpdateDisplayConfig } from "@wg/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { http } from "./client.js";
import { qk } from "./keys.js";

export const displayApi = {
  getConfig: () => http<DisplayConfig>("/api/display/config"),
  updateConfig: (body: UpdateDisplayConfig) =>
    http<DisplayConfig>("/api/display/config", {
      method: "PUT",
      body: JSON.stringify(body),
    }),
};

export function useDisplayConfig() {
  return useQuery({ queryKey: qk.displayConfig, queryFn: displayApi.getConfig });
}

export function useUpdateDisplayConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: displayApi.updateConfig,
    onSuccess: (data) => qc.setQueryData(qk.displayConfig, data),
  });
}
