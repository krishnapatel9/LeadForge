import { API_BASE } from "./site";
import { clearSession, getSession, isPublicPath } from "./auth";

/*
 * The API runs on Render's free plan. A Cloudflare cron Worker pings it every
 * 10 minutes so it normally stays awake, but after a deploy or a missed ping it
 * can take 30-60 s to start. So we (1) start waking it as soon as the dashboard
 * loads, and (2) retry requests that fail because it is still starting, while a
 * "Starting the server" banner shows (see ServerWakeBanner).
 */
export const SERVER_WAKING_EVENT = "lf-server-waking";
const RETRY_DELAY_MS = 3000;
const MAX_WAIT_MS = 90_000;

let waitingRequests = 0;
function setWaking(delta: number) {
  const before = waitingRequests > 0;
  waitingRequests = Math.max(0, waitingRequests + delta);
  if (typeof window !== "undefined" && before !== waitingRequests > 0) {
    window.dispatchEvent(new CustomEvent(SERVER_WAKING_EVENT, { detail: waitingRequests > 0 }));
  }
}

/** Fire-and-forget ping so the API is already booting while the user signs in. */
export function wakeApi() {
  fetch(`${API_BASE}/health`, { cache: "no-store" }).catch(() => {});
}

// While the API is starting, Render's proxy answers without CORS headers, so the
// browser reports a network error (handled below). 503/504 can also show up.
// 502 is NOT retried: the API itself uses 502 when Gemini or SMTP fails, and
// retrying that would repeat the AI call for 90 s and hide the real error.
const STARTING_STATUSES = new Set([503, 504]);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Every dashboard call to the API goes through here, so the base URL and the
 * Authorization header are set in one place. A 401 means the session is gone
 * (expired, or the account was disabled): clear it and send the user to sign in.
 */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const session = getSession();
  const headers = new Headers(init.headers);
  if (session) headers.set("Authorization", `Bearer ${session.token}`);

  let startedWaitingAt: number | null = null;
  let res: Response;
  try {
    for (;;) {
      try {
        res = await fetch(`${API_BASE}${path}`, { ...init, headers });
        if (!STARTING_STATUSES.has(res.status)) break;
      } catch (err) {
        // No response at all (server asleep, or the proxy's error had no CORS headers)
        if (init.signal?.aborted) throw err;
        if (startedWaitingAt !== null && Date.now() - startedWaitingAt >= MAX_WAIT_MS) throw err;
      }
      if (startedWaitingAt === null) {
        startedWaitingAt = Date.now();
        setWaking(1);
      } else if (Date.now() - startedWaitingAt >= MAX_WAIT_MS) {
        break; // give up and return the last 5xx response
      }
      await sleep(RETRY_DELAY_MS);
    }
  } finally {
    if (startedWaitingAt !== null) setWaking(-1);
  }

  if (res!.status === 401 && typeof window !== "undefined") {
    clearSession();
    const { pathname, search } = window.location;
    if (!isPublicPath(pathname)) {
      const next = encodeURIComponent(pathname + search);
      window.location.assign(`/login?next=${next}`);
    }
  }
  return res!;
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
