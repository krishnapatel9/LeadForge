"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  AUTH_EVENT,
  Session,
  SessionUser,
  clearSession,
  getSession,
  isPublicPath,
} from "../../lib/auth";

type AuthContextValue = {
  user: SessionUser | null;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue>({ user: null, signOut: () => {} });

export function useAuth() {
  return useContext(AuthContext);
}

/**
 * Blocks private pages until there is a valid session, and sends signed-out
 * visitors to /login. The API enforces access on its own; this only keeps the
 * UI from flashing data-less screens and failing requests.
 */
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSessionState] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const sync = () => setSessionState(getSession());
    sync();
    setReady(true);
    window.addEventListener(AUTH_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(AUTH_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const isPublic = isPublicPath(pathname);

  useEffect(() => {
    if (ready && !session && !isPublic) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [ready, session, isPublic, pathname, router]);

  // Expire the session in the UI at the same moment the token expires
  useEffect(() => {
    if (!session) return;
    const ms = session.expiresAt - Date.now();
    const timer = setTimeout(() => clearSession(), Math.max(ms, 0));
    return () => clearTimeout(timer);
  }, [session]);

  const signOut = useCallback(() => {
    clearSession();
    router.replace("/login");
  }, [router]);

  const value = { user: session?.user ?? null, signOut };

  if (!isPublic && (!ready || !session)) {
    return (
      <AuthContext.Provider value={value}>
        <p className="sub" style={{ padding: "64px 0", textAlign: "center" }} role="status">
          Checking your session…
        </p>
      </AuthContext.Provider>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
