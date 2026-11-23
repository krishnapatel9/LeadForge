import { API_BASE } from "./site";
import { clearSession, getSession, isPublicPath } from "./auth";

/**
 * Every dashboard call to the API goes through here, so the base URL and the
 * Authorization header are set in one place. A 401 means the session is gone
 * (expired, or the account was disabled): clear it and send the user to sign in.
 */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const session = getSession();
  const headers = new Headers(init.headers);
  if (session) headers.set("Authorization", `Bearer ${session.token}`);

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });

  if (res.status === 401 && typeof window !== "undefined") {
    clearSession();
    const { pathname, search } = window.location;
    if (!isPublicPath(pathname)) {
      const next = encodeURIComponent(pathname + search);
      window.location.assign(`/login?next=${next}`);
    }
  }
  return res;
}

/** A user-facing message for a failed response. Prefers the API's own `detail`. */
export async function apiErrorMessage(res: Response, fallback = "Request failed."): Promise<string> {
  if (res.status === 401) return "Your session ended. Sign in again.";
  try {
    const data = await res.json();
    if (typeof data?.detail === "string") return data.detail;
    // FastAPI validation errors: [{loc, msg}, ...]
    if (Array.isArray(data?.detail) && data.detail[0]?.msg) {
      const first = data.detail[0];
      const field = Array.isArray(first.loc) ? first.loc[first.loc.length - 1] : "";
      return field ? `${field}: ${first.msg}` : first.msg;
    }
  } catch {
    // not JSON
  }
  if (res.status === 403) return "Your role can't do this.";
  return fallback;
}
