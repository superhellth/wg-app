import { apiErrorSchema, type Member } from "@wg/shared";

const BASE = import.meta.env.VITE_API_URL ?? "";

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    // Surface the API error envelope's message when present.
    const body = await res.json().catch(() => null);
    const parsed = apiErrorSchema.safeParse(body);
    throw new Error(
      parsed.success ? parsed.data.error.message : `${res.status} ${res.statusText}`,
    );
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  listMembers: () => http<Member[]>("/api/members"),
  addMember: (displayName: string) =>
    http<Member>("/api/members", {
      method: "POST",
      body: JSON.stringify({ displayName }),
    }),
};
