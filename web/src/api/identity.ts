import { useSyncExternalStore } from "react";

const TOKEN_KEY = "wg_token";
const MEMBER_KEY = "wg_member_id";

const listeners = new Set<() => void>();
function emit() {
  for (const l of listeners) l();
}

export function getWgToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function getMemberId(): string | null {
  return localStorage.getItem(MEMBER_KEY);
}
export function setWgToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
  emit();
}
export function setMemberId(id: string | null): void {
  if (id) localStorage.setItem(MEMBER_KEY, id);
  else localStorage.removeItem(MEMBER_KEY);
  emit();
}
export function clearIdentity(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(MEMBER_KEY);
  emit();
}

export interface IdentityState {
  wgToken: string | null;
  memberId: string | null;
}

let cached: IdentityState = { wgToken: getWgToken(), memberId: getMemberId() };

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

function getSnapshot(): IdentityState {
  const wgToken = getWgToken();
  const memberId = getMemberId();
  if (wgToken !== cached.wgToken || memberId !== cached.memberId) {
    cached = { wgToken, memberId };
  }
  return cached;
}

/** Reactive identity (drives the onboarding gate; updates on switch/logout). */
export function useIdentity(): IdentityState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
