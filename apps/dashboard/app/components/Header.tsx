"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";
import { PIPELINE_EVENT } from "../../lib/useApi";
import { useAuth } from "./AuthGate";

const NAV_ITEMS = [
  { href: "/", label: "Pipeline" },
  { href: "/needs-approval", label: "Approvals", hasBadge: true },
  { href: "/campaigns", label: "Campaigns" },
  { href: "/reports", label: "Performance" },
  { href: "/settings", label: "Integrations" },
  { href: "/faq", label: "Help" },
];

export default function Header() {
  const pathname = usePathname();
  const [approvalCount, setApprovalCount] = useState<number>(0);
  const [health, setHealth] = useState<"ok" | "issues" | "offline" | null>(null);

  const { user, signOut } = useAuth();

  useEffect(() => {
    if (!user) {
      setApprovalCount(0);
      setHealth(null);
      return;
    }
    async function poll() {
      try {
        const [drafts, sys] = await Promise.all([apiFetch("/outreach/drafts"), apiFetch("/system-health")]);
        if (drafts.ok) setApprovalCount(((await drafts.json()) as unknown[]).length);
        if (sys.ok) setHealth(((await sys.json()) as { ok: boolean }).ok ? "ok" : "issues");
        else setHealth("issues");
      } catch {
        setHealth("offline");
      }
    }
    poll();
    const interval = setInterval(poll, 15000);
    window.addEventListener(PIPELINE_EVENT, poll);
    return () => {
      clearInterval(interval);
      window.removeEventListener(PIPELINE_EVENT, poll);
    };
  }, [user]);

  const toggleTheme = () => {
    const root = document.documentElement;
    const currentTheme = root.dataset.theme;
    const isDark = currentTheme
      ? currentTheme === "dark"
      : window.matchMedia("(prefers-color-scheme: dark)").matches;
    const nextTheme = isDark ? "light" : "dark";
    root.dataset.theme = nextTheme;
    try {
      localStorage.setItem("lf-theme", nextTheme);
    } catch (e) {
      // Ignore localStorage errors in private windows
    }
  };

  return (
    <header className="app-header inv">
      <Link href="/" className="logo">
        <i aria-hidden="true" />
        LeadForge
      </Link>

      <nav className="app-nav" id="nav" aria-label="Main Navigation">
        {user && NAV_ITEMS.map((item) => {
          const isCurrent =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isCurrent ? "page" : undefined}
              className={isCurrent ? "active" : ""}
            >
              {item.label}
              {item.hasBadge && approvalCount > 0 && (
                <span className="badge" aria-label={`${approvalCount} pending approvals`}>
                  {approvalCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="who">
        {user && health && (
          <span className="who-status" title="See Integrations for details">
            <i className={`dot${health === "ok" ? "" : " hollow"}`} />
            {health === "ok" ? "All systems running" : health === "offline" ? "API unreachable" : "Issues detected"}
          </span>
        )}
        {user ? (
          <>
            <span className="who-user" title={`Signed in as ${user.email} (${user.role})`}>
              {user.name || user.email} · {user.role.toUpperCase()}
            </span>
            <button className="theme-btn" onClick={signOut} type="button">
              Sign out
            </button>
          </>
        ) : (
          <Link href="/login" className="theme-btn">
            Sign in
          </Link>
        )}
        <button
          id="theme"
          className="theme-btn"
          onClick={toggleTheme}
          aria-label="Toggle dark mode"
          type="button"
        >
          Theme
        </button>
      </div>
    </header>
  );
}

