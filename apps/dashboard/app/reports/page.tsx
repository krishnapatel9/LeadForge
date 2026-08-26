"use client";

import { useState } from "react";
import { useToast } from "../components/Toast";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Download, TrendingUp, Users, Target, CheckCircle2, MessageSquare, Calendar } from "lucide-react";
import { Badge } from "../components/ui/badge";

export default function ReportsPage() {
  const { showToast } = useToast();
  const [stats] = useState({
    leadsSourced: 286,
    avgScore: 75,
    approvalRate: "92%",
    emailsSent: 263,
    repliesReceived: 34,
    meetingsBooked: 11,
  });

  const handleExportCSV = () => {
    showToast("Generating operational CSV export...", "info");
    setTimeout(() => {
      showToast("Pipeline performance metrics exported to CSV", "success", "Export Ready");
    }, 1000);
  };

  const kpis = [
    { label: "Leads Sourced", val: stats.leadsSourced, icon: Users, trend: "+12%", color: "text-blue-500", bg: "bg-blue-500/10" },
    { label: "Avg ICP Score", val: `${stats.avgScore}/100`, icon: Target, trend: "+3 pts", color: "text-primary", bg: "bg-primary/10" },
    { label: "AE Approval Rate", val: stats.approvalRate, icon: CheckCircle2, trend: "-1%", color: "text-primary", bg: "bg-primary/10" },
    { label: "Emails Sent", val: stats.emailsSent, icon: MessageSquare, trend: "+8%", color: "text-slate-500", bg: "bg-slate-500/10" },
    { label: "Replies Received", val: stats.repliesReceived, icon: MessageSquare, trend: "+14%", color: "text-amber-500", bg: "bg-amber-500/10" },
    { label: "Meetings Booked", val: stats.meetingsBooked, icon: Calendar, trend: "+22%", color: "text-emerald-500", bg: "bg-emerald-500/10" },
  ];

  const funnel = [
    { label: "1. Leads Ingested", count: 286, percentage: "100%", color: "bg-slate-200 dark:bg-slate-800" },
    { label: "2. Researched & Scored", count: 278, percentage: "97.2%", color: "bg-blue-500/60" },
    { label: "3. Outreach Approved", count: 263, percentage: "92.0%", color: "bg-primary" },
    { label: "4. Prospect Replied", count: 34, percentage: "12.9%", color: "bg-amber-400" },
    { label: "5. Sales Meeting Booked", count: 11, percentage: "4.2%", color: "bg-emerald-500" },
  ];

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-4rem)] overflow-hidden bg-slate-50/50 bg-mesh">
      {/* Header */}
      <header className="px-8 py-6 border-b bg-white/80 backdrop-blur-xl shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-primary" /> Performance Analytics
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Top-line operational throughput and multi-stage conversion rates.
            </p>
          </div>

          <Button variant="outline" onClick={handleExportCSV}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 p-8 overflow-y-auto max-w-7xl mx-auto w-full space-y-8">
        {/* KPI Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {kpis.map((kpi) => (
            <Card key={kpi.label} className="border shadow-sm">
              <CardContent className="p-4 flex flex-col justify-between h-full">
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-2 rounded-md ${kpi.bg}`}>
                    <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
                  </div>
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                    {kpi.trend}
                  </span>
                </div>
                <div>
                  <h3 className="text-[11px] uppercase font-bold text-muted-foreground tracking-wider mb-1">{kpi.label}</h3>
                  <div className="text-2xl font-black text-foreground">{kpi.val}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Funnel Conversions */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Pipeline Conversion Funnel</CardTitle>
                <CardDescription>Progression from initial sourcing to meeting booked.</CardDescription>
              </div>
              <Badge className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border-transparent">
                Overall Conv: 3.8%
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-5">
              {funnel.map((step) => (
                <div key={step.label} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6">
                  <div className="w-48 text-sm font-semibold text-foreground">{step.label}</div>
                  <div className="flex-1 bg-muted rounded-md h-8 overflow-hidden relative">
                    <div className={`${step.color} h-full transition-all duration-1000 ease-in-out flex items-center`} style={{ width: step.percentage }}>
                      {/* Optional: Add a subtle pattern or gradient inside the bar */}
                    </div>
                    <span className="absolute inset-y-0 right-3 flex items-center text-xs font-bold text-foreground">
                      {step.count} <span className="text-muted-foreground ml-1">({step.percentage})</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
