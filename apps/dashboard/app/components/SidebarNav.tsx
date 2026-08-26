"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { 
  LayoutDashboard, 
  CheckSquare, 
  Target, 
  LineChart, 
  Settings, 
  BookOpen,
  LogOut,
  Moon
} from "lucide-react";
import { SITE, API_BASE } from "../../lib/site";
import { cn } from "../../lib/utils";

export default function SidebarNav() {
  const pathname = usePathname();
  const [approvalCount, setApprovalCount] = useState<number>(0);

  useEffect(() => {
    async function fetchApprovalCount() {
      try {
        const res = await fetch(`${API_BASE}/leads`);
        if (res.ok) {
          const leads = await res.json();
          const awaiting = leads.filter((l: any) => l.stage === "outreach_drafted");
          setApprovalCount(awaiting.length);
        }
      } catch (err) {
        // Handle silently
      }
    }

    fetchApprovalCount();
    const interval = setInterval(fetchApprovalCount, 6000);
    return () => clearInterval(interval);
  }, []);

  const navGroups = [
    {
      title: "WORKSPACE",
      items: [
        { name: "Lead Pipeline", href: "/", icon: LayoutDashboard },
        { name: "Needs Approval", href: "/needs-approval", icon: CheckSquare, badge: approvalCount },
        { name: "Campaign ICPs", href: "/campaigns", icon: Target },
      ]
    },
    {
      title: "INSIGHTS",
      items: [
        { name: "Performance", href: "/reports", icon: LineChart },
      ]
    },
    {
      title: "SYSTEM",
      items: [
        { name: "Settings & APIs", href: "/settings", icon: Settings },
        { name: "Knowledge & FAQ", href: "/faq", icon: BookOpen },
      ]
    }
  ];

  return (
    <aside className="hidden lg:flex w-[260px] flex-col border-r border-slate-700 bg-[#2B3344] text-slate-100">
      {/* Brand Header */}
      <div className="flex h-16 items-center border-b border-slate-700 px-4 lg:px-6">
        <Link href="/" className="flex items-center gap-3 font-semibold">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm">
            <span className="font-bold text-xs">LF</span>
          </div>
          <span className="tracking-tight text-base font-bold text-white">LeadForge</span>
        </Link>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-6">
        <nav className="grid items-start px-3 text-sm font-medium">
          {navGroups.map((group, idx) => (
            <div key={idx} className="mb-8">
              <h4 className="mb-3 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {group.title}
              </h4>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all",
                        isActive ? "bg-indigo-600 text-white font-semibold shadow-sm" : "text-slate-400 hover:bg-slate-700 hover:text-slate-100"
                      )}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.name}
                      {item.badge !== undefined && item.badge > 0 && (
                        <span className={cn(
                          "ml-auto flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold",
                          isActive ? "bg-white text-indigo-600" : "bg-indigo-600 text-white"
                        )}>
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>

      {/* User Footer */}
      <div className="border-t border-slate-700 p-4">
        <div className="flex items-center gap-3 mb-4 px-2">
          <div className="h-9 w-9 rounded-full bg-slate-700 flex items-center justify-center text-white font-bold text-xs border border-slate-600">
            AE
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold leading-tight text-white">Alex Executive</span>
            <span className="text-[11px] text-slate-400">alex@leadforge.test</span>
          </div>
        </div>
        <div className="flex justify-between px-2 pt-2 border-t border-slate-700/50">
          <button className="text-slate-400 hover:text-white transition-colors p-1.5 rounded-md hover:bg-slate-700" title="Toggle Theme">
            <Moon className="h-4 w-4" />
          </button>
          <button className="text-slate-400 hover:text-white transition-colors p-1.5 rounded-md hover:bg-slate-700" title="Log out">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
