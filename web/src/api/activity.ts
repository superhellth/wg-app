import type { Activity } from "@wg/shared";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { http } from "./client.js";
import { qk } from "./keys.js";

export const activityApi = {
  list: (params?: { before?: string; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.before) q.set("before", params.before);
    if (params?.limit) q.set("limit", String(params.limit));
    const qs = q.toString();
    return http<Activity[]>(`/api/activity${qs ? `?${qs}` : ""}`);
  },
};

/** Recent slice for the dashboard. */
export function useRecentActivity(limit = 8) {
  return useQuery({
    queryKey: [...qk.activity, { limit }],
    queryFn: () => activityApi.list({ limit }),
  });
}

/** Cursor-paginated full feed. */
export function useActivityFeed(pageSize = 30) {
  return useInfiniteQuery({
    queryKey: qk.activity,
    queryFn: ({ pageParam }) =>
      activityApi.list({ before: pageParam, limit: pageSize }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) =>
      last.length === pageSize ? last[last.length - 1]!.createdAt : undefined,
  });
}
