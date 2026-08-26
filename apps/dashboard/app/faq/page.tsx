"use client";

import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { BookOpen } from "lucide-react";

export default function FAQPage() {
  const faqs = [
    {
      q: "How does the ICP Score work?",
      a: "The deterministic ICP score is calculated out of 100 points, broken down into Fit (Firmographics), Intent (Signals), Contactability, Gap Analysis, and Engagement. It evaluates the raw data from Apollo and Clay against your Campaign targets."
    },
    {
      q: "When is AI Research triggered?",
      a: "Research synthesis automatically triggers once a lead passes the initial firmographic gate (minimum score threshold). Claude parses the company's recent news, tech stack, and LinkedIn presence."
    },
    {
      q: "Can I edit the outreach before sending?",
      a: "Yes. All AI-generated outreach is placed in the 'Needs Approval' queue. An Account Executive must explicitly authorize the draft, at which point it is queued for dispatch."
    },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-muted/10">
      <header className="px-8 py-6 border-b bg-background">
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-primary" /> Knowledge Base & FAQ
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Operational documentation and frequently asked questions.
        </p>
      </header>

      <div className="flex-1 p-8 overflow-y-auto max-w-4xl mx-auto w-full space-y-6">
        {faqs.map((faq, i) => (
          <Card key={i} className="border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-bold">{faq.q}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground leading-relaxed">{faq.a}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
