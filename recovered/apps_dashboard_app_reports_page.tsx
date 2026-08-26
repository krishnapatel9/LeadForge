"use client";

import { useState } from "react";
import { useToast } from "../components/Toast";

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

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 sm:px-8 py-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Performance Analytics & Funnel
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Top-line operational throughput, multi-stage conversion rates, and AE review volume.
            </p>
          </div>

          <button
            onClick={handleExportCSV}
            className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-bold px-4 py-2.5 rounded-lg shadow-sm transition-colors shrink-0 flex items-center gap-1.5"
          >
            <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export CSV
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 p-4 sm:p-8 overflow-y-auto space-y-6 max-w-6xl w-full">
        {/* KPI Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          {[
            { label: "Leads Sourced", val: stats.leadsSourced, color: "text-slate-900" },
            { label: "Avg ICP Score", val: `${stats.avgScore}/100`, color: "text-indigo-600" },
            { label: "AE Approval Rate", val: stats.approvalRate, color: "text-indigo-600" },
            { label: "Emails Dispatched", val: stats.emailsSent, color: "text-slate-700" },
            { label: "Replies Received", val: stats.repliesReceived, color: "text-amber-600" },
            { label: "Meetings Booked", val: stats.meetingsBooked, color: "text-emerald-600" },
          ].map((kpi) => (
            <div key={kpi.label} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm text-center">
              <span className="text-[10px] uppercase font-bold text-slate-500 block tracking-wider mb-1">
                {kpi.label}
              </span>
              <span className={`text-xl font-extrabold ${kpi.color}`}>{kpi.val}</span>
            </div>
          ))}
        </div>

        {/* Funnel Conversions */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-base font-bold text-slate-900">Pipeline Conversion Funnel</h2>
              <p className="text-xs text-slate-500 mt-0.5">Progression from initial Apollo/Clay sourcing to meeting booked.</p>
            </div>
            <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
              Overall Conv: 3.8%
            </span>
          </div>

          <div className="space-y-4">
            {[
              { label: "1. Leads Ingested", count: 286, percentage: "100%", bg: "bg-slate-300" },
              { label: "2. Researched & Scored", count: 278, percentage: "97.2%", bg: "bg-indigo-300" },
              { label: "3. Outreach Approved", count: 263, percentage: "92.0%", bg: "bg-indigo-500" },
              { label: "4. Prospect Replied", count: 34, percentage: "12.9%", bg: "bg-amber-400" },
              { label: "5. Sales Meeting Booked", count: 11, percentage: "4.2%", bg: "bg-emerald-500" },
            ].map((step) => (
              <div key={step.label} className="flex flex-col sm:flex-row sm:items-center text-xs gap-1 sm:gap-3">
                <div className="w-48 font-semibold text-slate-700">{step.label}</div>
                <div className="flex-1 bg-slate-100 h-6 rounded-lg overflow-hidden relative border border-slate-200/60">
                  <div className={`${step.bg} h-full rounded-lg transition-all duration-500`} style={{ width: step.percentage }} />
                  <span className="absolute inset-y-0 right-3 flex items-center font-bold text-slate-800 text-[11px]">
                    {step.count} ({step.percentage})
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

