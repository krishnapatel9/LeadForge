"use client";

import { Shield } from "lucide-react";
import { Card, CardContent } from "../components/ui/card";

export default function PrivacyPage() {
  return (
    <div className="flex-1 flex flex-col min-h-screen bg-muted/10">
      <header className="px-8 py-6 border-b bg-background">
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Shield className="w-6 h-6 text-primary" /> Privacy Policy
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Last updated: October 2026
        </p>
      </header>

      <div className="flex-1 p-8 overflow-y-auto max-w-4xl mx-auto w-full">
        <Card className="border shadow-sm">
          <CardContent className="p-8 prose prose-sm dark:prose-invert max-w-none text-muted-foreground">
            <h2 className="text-foreground">Data Collection and Usage</h2>
            <p>
              We collect information that you provide directly to us, including when you create an account, build a campaign, or communicate with us. This includes contact data and B2B firmographics sourced through our integrations (Apollo, Clay).
            </p>
            
            <h2 className="text-foreground">AI Processing</h2>
            <p>
              LeadForge utilizes third-party LLMs (Google Gemini) to synthesize research and draft outreach. Data processed through these APIs is subject to their respective privacy agreements and is not used to train base models.
            </p>

            <h2 className="text-foreground">Data Security</h2>
            <p>
              We implement industry-standard security measures to protect your operational data. However, no security system is impenetrable, and we cannot guarantee the security of our databases.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
