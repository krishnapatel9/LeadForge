"use client";

import { FileText } from "lucide-react";
import { Card, CardContent } from "../components/ui/card";

export default function TermsPage() {
  return (
    <div className="flex-1 flex flex-col min-h-screen bg-muted/10">
      <header className="px-8 py-6 border-b bg-background">
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <FileText className="w-6 h-6 text-primary" /> Terms of Service
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Last updated: October 2026
        </p>
      </header>

      <div className="flex-1 p-8 overflow-y-auto max-w-4xl mx-auto w-full">
        <Card className="border shadow-sm">
          <CardContent className="p-8 prose prose-sm dark:prose-invert max-w-none text-muted-foreground">
            <h2 className="text-foreground">1. Acceptance of Terms</h2>
            <p>
              By accessing and using the LeadForge platform, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the service.
            </p>
            
            <h2 className="text-foreground">2. Acceptable Use</h2>
            <p>
              You agree to use LeadForge only for lawful B2B outreach purposes. You are responsible for ensuring your outreach campaigns comply with CAN-SPAM, GDPR, and other applicable electronic communications regulations.
            </p>

            <h2 className="text-foreground">3. Service Availability</h2>
            <p>
              While we strive for high availability, LeadForge is provided "as is" and "as available". We reserve the right to modify, suspend, or discontinue the service with or without notice.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
