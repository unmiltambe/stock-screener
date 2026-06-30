// The one place that talks to the backend. Same-origin by default: in prod the
// CloudFront distribution serves the SPA and proxies /v1/* to API Gateway, and in
// dev Vite proxies /v1 + /health to the local backend (see vite.config.ts). So
// requests use relative paths and there is no CORS in any environment. VITE_API_URL
// remains an optional override (e.g. pointing dev straight at a deployed API).
const BASE = import.meta.env.VITE_API_URL ?? "";

let authToken: string | null = null;
export function setAuthToken(token: string | null) {
  authToken = token;
}

// Guest session (ADR-0009): until the user signs in, requests carry a
// client-generated guest id so the deployed API can give them their own data
// without a login wall. Persisted in sessionStorage (per ADR — a new tab/window
// is a fresh guest). In local `header` mode the backend ignores this header.
const GUEST_KEY = "guestId";
function getGuestId(): string {
  let id = sessionStorage.getItem(GUEST_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(GUEST_KEY, id);
  }
  return id;
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (authToken) {
    headers.set("Authorization", `Bearer ${authToken}`);
  } else {
    headers.set("X-Guest-Id", getGuestId());
  }
  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const apiBase = BASE;
