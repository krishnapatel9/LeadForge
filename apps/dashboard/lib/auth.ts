// Browser-side session for the dashboard.
//
// The access token lives in sessionStorage: it is scoped to this tab, cleared
// when the tab closes, and expires on the server after JWT_EXPIRE_MINUTES.
// It is still readable by scripts on this origin, so keep the dashboard free of
// third-party scripts. Moving to an httpOnly cookie needs the API and dashboard
// on the same site; see the README auth section.

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  role: "admin" | "ae" | "ops";
};

export type Session = {
  token: string;
  user: SessionUser;
  expiresAt: number; // epoch ms
};

const KEY = "lf-session";
export const AUTH_EVENT = "lf-auth-change";

export function getSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as Session;
    if (!session.token || Date.now() >= session.expiresAt) {
      window.sessionStorage.removeItem(KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function setSession(token: string, user: SessionUser, expiresInSeconds: number) {
  const session: Session = { token, user, expiresAt: Date.now() + expiresInSeconds * 1000 };
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    // Storage blocked: the session will last only until the next page load
  }
  window.dispatchEvent(new Event(AUTH_EVENT));
}

export function clearSession() {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
  window.dispatchEvent(new Event(AUTH_EVENT));
}

/** Only same-app paths are allowed as a post-login redirect (no open redirects). */
export function safeNextPath(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/login")) {
    return "/";
  }
  return next;
}

export const PUBLIC_PATHS = ["/login", "/privacy", "/terms", "/faq"];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
