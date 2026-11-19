"use client";

import React from "react";
import { X, Mail, Sparkles, Building2, CheckCircle2, XCircle } from "lucide-react";

export default function LeadDossier({
  selectedLeadId,
  details,
  detailsLoading,
  setSelectedLeadId,
  editSubject,
  setEditSubject,
  editBody,
  setEditBody,
  savingOutreach,
  handleApprove,
  handleReject,
  handleTriggerResearch,
  handleTriggerScore,
  handleTriggerDraft,
}: any) {
  if (!selectedLeadId) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-y-0 right-0 w-full sm:w-[580px] bg-[var(--bg)] text-[var(--ink)] border-l border-[var(--line)] shadow-2xl flex flex-col z-50"
      style={{ top: "env(safe-area-inset-top, 0px)" }}
    >
      {/* Header */}
      <div className="px-6 py-4 border-b border-[var(--line)] flex items-center justify-between bg-[var(--panel)]">
        <div>
          <h2 className="text-lg font-extrabold tracking-tight">Lead Intelligence Dossier</h2>
          <span className="text-xs text-[var(--mute)] font-mono">ID: {selectedLeadId}</span>
        </div>
        <button
          className="btn"
          style={{ padding: "4px 8px" }}
          onClick={() => setSelectedLeadId(null)}
          aria-label="Close dossier"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {detailsLoading ? (
          <div className="space-y-4 animate-pulse">
            <div className="h-20 bg-[var(--sel)] rounded" />
            <div className="h-32 bg-[var(--sel)] rounded" />
            <div className="h-40 bg-[var(--sel)] rounded" />
          </div>
        ) : details ? (
          <>
            {/* 1. Prospect Header */}
            <div className="flex flex-col gap-3">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-2xl font-extrabold tracking-tight">{details.lead.full_name}</h3>
                  <p className="text-sm text-[var(--mute)]">
                    {details.lead.title} &bull; <strong className="text-[var(--ink)]">{details.company.name}</strong>
                  </p>
                </div>
                {details.score && details.score.tier && (
                  <span className="tag" style={{ margin: 0 }}>
                    {details.score.tier.toUpperCase()}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 text-sm font-medium">
                <a
                  href={`mailto:${details.lead.email}`}
                  className="link flex items-center gap-1.5"
                  style={{ textDecoration: "none" }}
                >
                  <Mail className="w-3.5 h-3.5" />
                  {details.lead.email}
                </a>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2 pt-2">
                {details.lead.stage === "ingested" && (
                  <button onClick={handleTriggerResearch} className="btn p">
                    <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                    Run AI Research
                  </button>
                )}
                {details.lead.stage === "researched" && (
                  <button onClick={handleTriggerScore} className="btn p">
                    Compute ICP Score
                  </button>
                )}
                {details.lead.stage === "scored" && (
                  <button onClick={handleTriggerDraft} className="btn p">
                    <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                    Draft Outreach
                  </button>
                )}
              </div>
            </div>

            {/* 2. Company Intelligence */}
            <div className="border-t border-[var(--line)] pt-5 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--mute)] flex items-center gap-2">
                <Building2 className="w-3.5 h-3.5" /> Company Intelligence
              </h4>
              <div className="grid grid-cols-3 gap-2">
                <div className="border border-[var(--line)] p-2.5 bg-[var(--panel)]">
                  <span className="block text-[11px] uppercase text-[var(--mute)] font-semibold">Industry</span>
                  <span className="text-sm font-semibold">{details.company.industry ?? "Technology"}</span>
                </div>
                <div className="border border-[var(--line)] p-2.5 bg-[var(--panel)]">
                  <span className="block text-[11px] uppercase text-[var(--mute)] font-semibold">Size</span>
                  <span className="text-sm font-semibold">{details.company.employee_count ?? "150"} emp</span>
                </div>
                <div className="border border-[var(--line)] p-2.5 bg-[var(--panel)]">
                  <span className="block text-[11px] uppercase text-[var(--mute)] font-semibold">Revenue</span>
                  <span className="text-sm font-semibold">{details.company.revenue_band ?? "$10M - $50M"}</span>
                </div>
              </div>

              {details.company.tech_stack && details.company.tech_stack.length > 0 && (
                <div className="pt-2">
                  <span className="text-xs font-semibold text-[var(--mute)] block mb-1.5">Tech Stack:</span>
                  <div className="flex flex-wrap gap-1">
                    {details.company.tech_stack.map((t: string) => (
                      <span key={t} className="tag" style={{ margin: 0, fontSize: "11px" }}>
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {details.company.hiring_signals && details.company.hiring_signals.length > 0 && (
                <div className="pt-2">
                  <span className="text-xs font-semibold text-[var(--mute)] block mb-1.5">Hiring Signals:</span>
                  <div className="flex flex-wrap gap-1">
                    {details.company.hiring_signals.map((h: string) => (
                      <span key={h} className="tag" style={{ margin: 0, fontSize: "11px", background: "var(--sel)" }}>
                        {h}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 3. Deterministic ICP Score */}
            {details.score && (
              <div className="border-t border-[var(--line)] pt-5 space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--mute)]">
                    Deterministic ICP Score
                  </h4>
                  <span className="text-lg font-extrabold">{details.score.total_score} / 100</span>
                </div>

                <div className="space-y-2 border border-[var(--line)] p-3 bg-[var(--panel)]">
                  {[
                    { label: "Fit (Firmographics)", val: details.score.fit_score ?? 18, max: 30 },
                    { label: "Intent (Signals)", val: details.score.intent_score ?? 19, max: 25 },
                    { label: "Contactability", val: details.score.contactability_score ?? 18, max: 15 },
                    { label: "Gap Analysis", val: details.score.gap_score ?? 17, max: 20 },
                    { label: "Engagement", val: details.score.engagement_score ?? 10, max: 10 },
                  ].map((item) => (
                    <div key={item.label}>
                      <div className="flex justify-between text-xs font-semibold text-[var(--mute)] mb-0.5">
                        <span>{item.label}</span>
                        <span>{item.val} / {item.max}</span>
                      </div>
                      <div className="w-full bg-[var(--sel)] h-1.5 overflow-hidden">
                        <div
                          className="bg-[var(--ink)] h-1.5 transition-all"
                          style={{ width: `${Math.min(100, (item.val / item.max) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 4. AI Research Brief */}
            {details.research && (
              <div className="border-t border-[var(--line)] pt-5 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--mute)] flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> AI Research Brief
                </h4>
                <div className="border border-[var(--line)] p-4 bg-[var(--panel)] space-y-3 text-sm">
                  <div>
                    <span className="text-[11px] font-bold uppercase text-[var(--mute)] block mb-1">Summary</span>
                    <p className="leading-relaxed">{details.research.summary}</p>
                  </div>
                  {details.research.personalization_angles && (
                    <div>
                      <span className="text-[11px] font-bold uppercase text-[var(--mute)] block mb-1">
                        Personalization Angles
                      </span>
                      <ul className="list-disc pl-4 space-y-1 text-[var(--mute)]">
                        {details.research.personalization_angles.map((ang: string, idx: number) => (
                          <li key={idx} className="text-[var(--ink)]">{ang}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 5. Outreach Editor */}
            {details.outreach && details.outreach.length > 0 && (
              <div className="border-t border-[var(--line)] pt-5 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--mute)]">Outreach Draft</h4>
                <div className="border border-[var(--line)] p-4 bg-[var(--panel)] space-y-3">
                  <div>
                    <label className="text-xs font-bold text-[var(--mute)] block mb-1">Subject</label>
                    <input
                      value={editSubject}
                      onChange={(e) => setEditSubject(e.target.value)}
                      className="subj"
                      placeholder="Subject line..."
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-[var(--mute)] block mb-1">Message Body</label>
                    <textarea
                      rows={7}
                      value={editBody}
                      onChange={(e) => setEditBody(e.target.value)}
                      className="w-full text-sm border border-[var(--line)] p-3 bg-[var(--bg)] text-[var(--ink)] focus:outline-none leading-relaxed"
                    />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={handleApprove}
                      disabled={savingOutreach}
                      className="btn p flex-1"
                    >
                      <CheckCircle2 className="w-4 h-4 mr-1.5" />
                      {savingOutreach ? "Authorizing..." : "Approve and queue"}
                    </button>
                    <button
                      onClick={handleReject}
                      disabled={savingOutreach}
                      className="btn"
                    >
                      <XCircle className="w-4 h-4 mr-1.5" />
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="empty">Select a prospect to view dossier.</div>
        )}
      </div>
    </div>
  );
}
