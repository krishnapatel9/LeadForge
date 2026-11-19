"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    async function fetchApprovalCount() {
      try {
        const res = await fetch("http://localhost:8000/leads");
        if (res.ok) {
          const leads = await res.json();
          const awaiting = leads.filter((l: any) => l.stage === "outreach_drafted");
          setApprovalCount(awaiting.length);
        } else {
          // Fallback demo state
          setApprovalCount(1);
        }
      } catch (err) {
        setApprovalCount(1);
      }
    }

    fetchApprovalCount();
    const interval = setInterval(fetchApprovalCount, 8000);
    return () => clearInterval(interval);
  }, []);

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
        {NAV_ITEMS.map((item) => {
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
        <span>
          <i className="dot" aria-hidden="true" />
          All systems running
        </span>
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

