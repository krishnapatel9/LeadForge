"use client";

import { Search, Bell, Settings } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

export default function TopBar() {
  return (
    <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-slate-100 bg-white/80 backdrop-blur-xl px-4 sm:gap-x-6 sm:px-6 lg:px-8">
      <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
        <form className="relative flex flex-1 items-center" action="#" method="GET" onSubmit={(e) => e.preventDefault()}>
          <label htmlFor="search-field" className="sr-only">
            Search
          </label>
          <Search
            className="pointer-events-none absolute inset-y-0 left-0 h-full w-4 text-muted-foreground ml-3"
            aria-hidden="true"
          />
          <Input
            id="search-field"
            className="block h-full w-full border-0 py-0 pl-9 pr-0 text-foreground placeholder:text-muted-foreground focus:ring-0 sm:text-sm shadow-none focus-visible:ring-0 bg-transparent rounded-none"
            placeholder="Search prospects or commands (⌘K)..."
            type="search"
            name="search"
          />
        </form>
        <div className="flex items-center gap-x-4 lg:gap-x-6">
          <Button variant="ghost" size="icon" className="text-muted-foreground">
            <span className="sr-only">View notifications</span>
            <Bell className="h-5 w-5" aria-hidden="true" />
          </Button>

          {/* Separator */}
          <div className="hidden lg:block lg:h-6 lg:w-px lg:bg-border" aria-hidden="true" />

          {/* System Health / Profile */}
          <div className="flex items-center gap-x-4 lg:gap-x-6">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-muted/50">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[11px] font-medium text-muted-foreground">Systems Operational</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
