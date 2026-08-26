"use client";

import Link from "next/link";
import { Button } from "./components/ui/button";
import { Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-screen bg-muted/10 p-6 text-center">
      <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-6 shadow-sm">
        <span className="text-2xl font-black">404</span>
      </div>
      <h1 className="text-3xl font-bold tracking-tight text-foreground mb-3">
        Endpoint Not Found
      </h1>
      <p className="text-muted-foreground mb-8 max-w-md">
        The requested route or resource does not exist. It may have been moved or you may have followed an outdated link.
      </p>
      <Button asChild>
        <Link href="/">
          <Home className="w-4 h-4 mr-2" />
          Return to Pipeline
        </Link>
      </Button>
    </div>
  );
}
