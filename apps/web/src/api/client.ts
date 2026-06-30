// The one place that talks to the backend. Base URL from env (local backend in
// header mode for dev); a Cognito bearer token is attached when set (auth step).
const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

let authToken: string | null = null;
export function setAuthToken(token: string | null) {
  authToken = token;
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (authToken) headers.set("Authorization", `Bearer ${authToken}`);
  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const apiBase = BASE;
