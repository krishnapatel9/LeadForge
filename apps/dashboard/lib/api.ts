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

/** A user-facing message for a failed response. */
export async function apiErrorMessage(res: Response, fallback = "Request failed."): Promise<string> {
  if (res.status === 403) return "Your role can't do this. Only AEs and admins can approve or reject outreach.";
  if (res.status === 401) return "Your session ended. Sign in again.";
  try {
    const data = await res.json();
    if (typeof data?.detail === "string") return data.detail;
  } catch {
    // not JSON
  }
  return fallback;
}
