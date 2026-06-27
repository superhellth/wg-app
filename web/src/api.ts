import type { Member } from "@wg/shared";

const BASE = import.meta.env.VITE_API_URL ?? "";

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
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
