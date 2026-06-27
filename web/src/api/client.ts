import { apiErrorSchema } from "@wg/shared";
import { clearIdentity, getMemberId, getWgToken } from "./identity.js";

const BASE = import.meta.env.VITE_API_URL ?? "";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Core fetch wrapper: injects auth headers, unwraps the error envelope. */
export async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body) headers.set("Content-Type", "application/json");
  const token = getWgToken();
  const memberId = getMemberId();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (memberId) headers.set("X-Member-Id", memberId);

  const res = await fetch(`${BASE}${path}`, { ...init, headers });

  if (res.status === 401) {
    clearIdentity();
    if (window.location.pathname !== "/") window.location.assign("/");
    throw new ApiError(401, "unauthorized", "Sitzung abgelaufen");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const parsed = apiErrorSchema.safeParse(body);
    if (parsed.success) {
      throw new ApiError(
        res.status,
        parsed.data.error.code,
        parsed.data.error.message,
        parsed.data.error.details,
      );
    }
    throw new ApiError(res.status, "error", `${res.status} ${res.statusText}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
