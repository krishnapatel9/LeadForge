import React from "react";
import { X, Mail, Sparkles, Building2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";

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
      className="fixed inset-y-0 right-0 w-full sm:w-[600px] bg-background shadow-2xl border-l flex flex-col z-50 animate-slide-in"
    >
      {/* Header */}
      <div className="px-6 py-4 border-b flex items-center justify-between bg-card text-card-foreground">
        <div>
          <h2 className="text-lg font-bold tracking-tight">Lead Intelligence Dossier</h2>
          <span className="text-[11px] text-muted-foreground font-mono">ID: {selectedLeadId}</span>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setSelectedLeadId(null)}>
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        {detailsLoading ? (
          <div className="space-y-4 animate-pulse">
            <div className="h-24 bg-muted rounded-xl" />
            <div className="h-32 bg-muted rounded-xl" />
            <div className="h-48 bg-muted rounded-xl" />
          </div>
        ) : details ? (
          <>
            {/* 1. Prospect Header */}
            <div className="flex flex-col gap-4">
              <div className="flex justify-between items-start">
                <div className="flex gap-4 items-center">
                  <div className="w-12 h-12 rounded-xl bg-muted border flex items-center justify-center font-bold text-muted-foreground text-xl">
                    {details.lead.full_name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-foreground tracking-tight">{details.lead.full_name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {details.lead.title} <span className="mx-1">&bull;</span> <span className="font-semibold text-foreground">{details.company.name}</span>
                    </p>
                  </div>
                </div>
                <Badge variant="secondary" className="capitalize">
                  {details.lead.stage.replace("_", " ")}
                </Badge>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-sm font-medium">
                <a href={`mailto:${details.lead.email}`} className="text-primary hover:underline flex items-center gap-1.5">
                  <Mail className="w-4 h-4" />
                  {details.lead.email}
                </a>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2 pt-2">
                {details.lead.stage === "ingested" && (
                  <Button onClick={handleTriggerResearch} size="sm" className="w-full sm:w-auto">
                    <Sparkles className="w-4 h-4 mr-2" />
                    Run AI Research
                  </Button>
                )}
                {details.lead.stage === "researched" && (
                  <Button onClick={handleTriggerScore} size="sm" className="w-full sm:w-auto">
                    Compute ICP Score
                  </Button>
                )}
                {details.lead.stage === "scored" && (
                  <Button onClick={handleTriggerDraft} size="sm" className="w-full sm:w-auto">
                    <Sparkles className="w-4 h-4 mr-2" />
                    Draft Outreach
                  </Button>
                )}
              </div>
            </div>

            {/* 2. Company Intelligence */}
            <div className="space-y-3 border-t pt-6">
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Building2 className="w-4 h-4" /> Company Intelligence
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="bg-muted/50 p-3 rounded-lg border">
                  <span className="block text-[10px] uppercase text-muted-foreground font-semibold mb-1">Industry</span>
                  <span className="text-sm font-medium">{details.company.industry ?? "Technology"}</span>
                </div>
                <div className="bg-muted/50 p-3 rounded-lg border">
                  <span className="block text-[10px] uppercase text-muted-foreground font-semibold mb-1">Size</span>
                  <span className="text-sm font-medium">{details.company.employee_count ?? "150"} emp</span>
                </div>
                <div className="bg-muted/50 p-3 rounded-lg border">
                  <span className="block text-[10px] uppercase text-muted-foreground font-semibold mb-1">Revenue</span>
                  <span className="text-sm font-medium">{details.company.revenue_band ?? "$10M - $50M"}</span>
                </div>
              </div>

              <div className="pt-2">
                <span className="text-xs font-semibold text-muted-foreground block mb-2">Detected Tech Stack:</span>
                <div className="flex flex-wrap gap-1.5">
                  {details.company.tech_stack && details.company.tech_stack.length > 0 ? (
                    details.company.tech_stack.map((t: string) => (
                      <Badge key={t} variant="outline" className="font-normal text-[11px] py-0 px-2 h-5">
                        {t}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground italic">None detected</span>
                  )}
                </div>
              </div>

              <div className="pt-2">
                <span className="text-xs font-semibold text-muted-foreground block mb-2">Hiring Signals & News Triggers:</span>
                <div className="flex flex-wrap gap-1.5">
                  {details.company.hiring_signals && details.company.hiring_signals.length > 0 ? (
                    details.company.hiring_signals.map((h: string) => (
                      <Badge key={h} variant="secondary" className="font-normal text-[11px] py-0 px-2 h-5 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20">
                        {h}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground italic">None detected</span>
                  )}
                </div>
              </div>
            </div>

            {/* 3. ICP Score Breakdown */}
            {details.score && (
              <div className="space-y-4 border-t pt-6">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Deterministic ICP Score</h4>
                  <Badge className="bg-primary/10 text-primary hover:bg-primary/20 border-primary/20 text-sm py-1 px-3">
                    {details.score.total_score} / 100
                  </Badge>
                </div>

                <div className="space-y-3 bg-muted/30 p-4 rounded-xl border">
                  {[
                    { label: "Fit (Firmographics)", val: details.score.fit_score },
                    { label: "Intent (Signals)", val: details.score.intent_score },
                    { label: "Contactability", val: details.score.contactability_score },
                    { label: "Gap Analysis", val: details.score.gap_score },
                    { label: "Engagement", val: details.score.engagement_score },
                  ].map((item) => (
                    <div key={item.label}>
                      <div className="flex justify-between text-[11px] font-semibold text-muted-foreground mb-1">
                        <span>{item.label}</span>
                        <span>{item.val}/20</span>
                      </div>
                      <div className="w-full bg-muted h-1.5 rounded-full overflow-hidden">
                        <div className="bg-primary h-1.5 rounded-full transition-all" style={{ width: `${(item.val / 20) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 4. AI Research Brief */}
            {details.research && (
              <div className="space-y-3 border-t pt-6">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-500" /> AI Research Brief
                </h4>
                <div className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-4 text-sm leading-relaxed space-y-4">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-purple-600 dark:text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full mb-2 inline-block">AI Insight</span>
                    <p className="text-foreground/90">{details.research.summary}</p>
                  </div>

                  <div>
                    <span className="text-xs font-semibold text-foreground mb-2 block">Personalization Angles:</span>
                    <ul className="list-disc pl-4 space-y-1.5 text-muted-foreground">
                      {details.research.personalization_angles.map((ang: string, idx: number) => (
                        <li key={idx}>{ang}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* 5. Outreach Editor */}
            {details.outreach && details.outreach.length > 0 && (
              <div className="space-y-4 border-t pt-6">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Outreach Sequence</h4>
                <div className="bg-card border shadow-sm rounded-xl p-5 space-y-4">
                  <div>
                    <label className="text-xs font-bold text-muted-foreground block mb-1.5">Subject Line</label>
                    <Input
                      value={editSubject}
                      onChange={(e) => setEditSubject(e.target.value)}
                      className="font-medium bg-muted/50"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-muted-foreground block mb-1.5">Message Body</label>
                    <textarea
                      rows={8}
                      value={editBody}
                      onChange={(e) => setEditBody(e.target.value)}
                      className="w-full text-sm border rounded-md p-3 bg-muted/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-sans leading-relaxed"
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 pt-2">
                    <Button
                      onClick={handleApprove}
                      disabled={savingOutreach}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      {savingOutreach ? "Authorizing..." : "Approve & Queue"}
                    </Button>
                    <Button
                      onClick={handleReject}
                      disabled={savingOutreach}
                      variant="destructive"
                      className="flex-1 sm:flex-none"
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Reject
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* 6. Activity Logs */}
            {details.activities && details.activities.length > 0 && (
              <div className="space-y-4 border-t pt-6">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Activity Timeline</h4>
                <div className="flow-root">
                  <ul className="-mb-8">
                    {details.activities.map((act: any, actIdx: number) => (
                      <li key={act.id}>
                        <div className="relative pb-8">
                          {actIdx !== details.activities.length - 1 ? (
                            <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-border" aria-hidden="true" />
                          ) : null}
                          <div className="relative flex space-x-3">
                            <div>
                              <span className="h-8 w-8 rounded-full bg-muted flex items-center justify-center ring-8 ring-background text-[10px] font-bold text-muted-foreground capitalize">
                                {act.action.slice(0, 2)}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0 pt-1.5 flex justify-between space-x-4">
                              <div>
                                <p className="text-sm text-foreground">
                                  <span className="font-semibold">{act.action.replace("_", " ")}</span> by <span className="font-semibold text-muted-foreground">{act.actor}</span>
                                </p>
                                {act.detail && Object.keys(act.detail).length > 0 && (
                                  <p className="text-xs text-muted-foreground font-mono mt-1">
                                    {JSON.stringify(act.detail)}
                                  </p>
                                )}
                              </div>
                              <div className="text-right text-xs whitespace-nowrap text-muted-foreground font-medium">
                                {new Date(act.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </div>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
            Select a prospect to view intelligence dossier.
          </div>
        )}
      </div>
    </div>
  );
}
