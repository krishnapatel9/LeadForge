"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SITE } from "../../lib/site";
import { apiFetch } from "../../lib/api";
import { 
  LayoutDashboard, 
  CheckSquare, 
  Target, 
  LineChart, 
  Settings, 
  BookOpen,
  Menu,
  X
} from "lucide-react";
import { cn } from "../../lib/utils";
import { Button } from "./ui/button";

export default function MobileNav() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const [approvalCount, setApprovalCount] = useState<number>(0);

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  useEffect(() => {
    async function fetchApprovalCount() {
      try {
        const res = await apiFetch(`/leads`);
        if (res.ok) {
          const leads = await res.json();
          const awaiting = leads.filter((l: any) => l.stage === "outreach_drafted");
          setApprovalCount(awaiting.length);
        }
      } catch (err) {
        // Silent catch
      }
    }
    fetchApprovalCount();
    const interval = setInterval(fetchApprovalCount, 8000);
    return () => clearInterval(interval);
  }, []);

  const navItems = [
    { name: "Lead Pipeline", href: "/", icon: LayoutDashboard },
    { name: "Needs Approval", href: "/needs-approval", badge: approvalCount, icon: CheckSquare },
    { name: "Campaign ICPs", href: "/campaigns", icon: Target },
    { name: "Performance", href: "/reports", icon: LineChart },
    { name: "Settings & APIs", href: "/settings", icon: Settings },
    { name: "Knowledge & FAQ", href: "/faq", icon: BookOpen },
  ];

  return (
    <header className="lg:hidden sticky top-0 z-40 bg-background border-b px-4 py-3">
      <div className="flex items-center justify-between">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <span className="font-bold text-xs">LF</span>
          </div>
          <span className="tracking-tight text-sm">LeadForge</span>
        </Link>

        {/* Hamburger Toggle Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          aria-label={isOpen ? "Close navigation menu" : "Open navigation menu"}
        >
          {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {/* Slide-out Drawer */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex"
          role="dialog"
          aria-modal="true"
          aria-label="Mobile Navigation"
        >
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-background/80 backdrop-blur-sm transition-opacity"
            onClick={() => setIsOpen(false)}
          />

          {/* Drawer Content */}
          <div className="relative w-4/5 max-w-xs bg-background h-full p-5 flex flex-col justify-between shadow-2xl border-r z-10 overflow-y-auto">
            <div>
              {/* Drawer Header */}
              <div className="flex items-center justify-between pb-4 border-b mb-4">
                <Link href="/" className="flex items-center gap-2 font-semibold" onClick={() => setIsOpen(false)}>
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
                    <span className="font-bold text-xs">LF</span>
                  </div>
                  <span className="tracking-tight text-sm">LeadForge</span>
                </Link>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsOpen(false)}
                  aria-label="Close drawer"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>

              {/* Navigation links */}
              <nav className="space-y-1">
                {navItems.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-all hover:bg-muted",
                        isActive ? "bg-muted text-primary font-semibold" : "text-muted-foreground"
                      )}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.name}
                      {item.badge !== undefined && item.badge > 0 && (
                        <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </nav>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
