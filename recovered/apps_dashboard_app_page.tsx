"use client";

import { useEffect, useState, useCallback } from "react";
import { useToast } from "./components/Toast";
import { Skeleton } from "./components/ui/skeleton";
import LeadDossier from "./components/LeadDossier";
import { trackEvent } from "../lib/analytics";
import { Filter, SlidersHorizontal, Flame, ThermometerSun, AlertCircle } from "lucide-react";
import { Button } from "./components/ui/button";
import { Badge } from "./components/ui/badge";

interface Lead {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  full_name: string;
  email: string;
  title: string;
  stage: string;
  total_score?: number | null;
  tier?: string | null;
  company_name: string;
  domain: string;
  created_at: string;
}

export default function PipelinePage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [details, setDetails] = useState<any | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTier, setSelectedTier] = useState<string>("all");

  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");
  const [savingOutreach, setSavingOutreach] = useState(false);

  const { showToast } = useToast();

  const fetchLeads = useCallback(async () => {
    try {
      const res = await fetch("http://localhost:8000/leads");
      if (res.ok) {
        const data = await res.json();
        setLeads(data);
      }
    } catch (err) {
      console.debug("Backend not currently running or unreachable:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeads();
    const intv = setInterval(fetchLeads, 8000);
    return () => clearInterval(intv);
  }, [fetchLeads]);

  useEffect(() => {
    if (!selectedLeadId) {
      setDetails(null);
      return;
    }
    async function loadDetails() {
      setDetailsLoading(true);
      try {
        const res = await fetch(`http://localhost:8000/leads/${selectedLeadId}`);
        if (res.ok) {
          const data = await res.json();
          setDetails(data);
          const activeDraft = data.outreach.find((m: any) => m.status === "draft");
          if (activeDraft) {
            setEditSubject(activeDraft.subject);
            setEditBody(activeDraft.body);
          } else if (data.outreach.length > 0) {
            setEditSubject(data.outreach[0].subject);
            setEditBody(data.outreach[0].body);
          } else {
            setEditSubject("");
            setEditBody("");
          }
        }
      } catch (err) {
        // silent
      } finally {
        setDetailsLoading(false);
      }
    }
    loadDetails();
  }, [selectedLeadId]);

  const columns = [
    { title: "New Ingestion", stages: ["ingested", "enriched"] },
    { title: "Researched", stages: ["researched"] },
    { title: "Scored", stages: ["scored"] },
    { title: "Drafted", stages: ["outreach_drafted"] },
    { title: "Approved & Sent", stages: ["outreach_approved", "approved", "sent"] },
  ];

  const handleApprove = async () => {
    if (!selectedLeadId) return;
    setSavingOutreach(true);
    try {
      const res = await fetch(`http://localhost:8000/leads/${selectedLeadId}/outreach/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: editSubject, body: editBody }),
      });
      if (res.ok) {
        showToast("Outreach draft approved", "success");
        trackEvent("lead_approved", { leadId: selectedLeadId });
        await fetchLeads();
        setSelectedLeadId(null);
      } else {
        showToast("Failed to approve draft", "error");
      }
    } catch (err) {
      showToast("Network error", "error");
    } finally {
      setSavingOutreach(false);
    }
  };

  const handleReject = async () => {
    if (!selectedLeadId) return;
    setSavingOutreach(true);
    try {
      const res = await fetch(`http://localhost:8000/leads/${selectedLeadId}/outreach/reject`, { method: "POST" });
      if (res.ok) {
        showToast("Draft rejected", "warning");
        trackEvent("lead_rejected", { leadId: selectedLeadId });
        await fetchLeads();
        setSelectedLeadId(null);
      }
    } catch (err) {
      showToast("Error rejecting outreach", "error");
    } finally {
      setSavingOutreach(false);
    }
  };

  const handleTriggerResearch = async () => {
    if (!selectedLeadId) return;
    showToast("Triggering Claude synthesis...", "info");
    try {
      await fetch(`http://localhost:8000/leads/${selectedLeadId}/research`, { method: "POST" });
      await fetchLeads();
      const detRes = await fetch(`http://localhost:8000/leads/${selectedLeadId}`);
      if (detRes.ok) setDetails(await detRes.json());
      showToast("Research synthesis completed", "success");
    } catch (err) {
      showToast("Research failed", "error");
    }
  };

  const handleTriggerScore = async () => {
    if (!selectedLeadId) return;
    showToast("Recomputing ICP score...", "info");
    try {
      await fetch(`http://localhost:8000/leads/${selectedLeadId}/score`, { method: "POST" });
      await fetchLeads();
      const detRes = await fetch(`http://localhost:8000/leads/${selectedLeadId}`);
      if (detRes.ok) setDetails(await detRes.json());
      showToast("Score recomputed", "success");
    } catch (err) {
      showToast("Scoring failed", "error");
    }
  };

  const handleTriggerDraft = async () => {
    if (!selectedLeadId) return;
    showToast("Generating Claude outreach draft...", "info");
    try {
      await fetch(`http://localhost:8000/leads/${selectedLeadId}/draft-outreach`, { method: "POST" });
      await fetchLeads();
      const detRes = await fetch(`http://localhost:8000/leads/${selectedLeadId}`);
      if (detRes.ok) setDetails(await detRes.json());
      showToast("Outreach drafted", "success");
    } catch (err) {
      showToast("Outreach generation failed", "error");
    }
  };

  const filteredLeads = leads.filter((lead) => {
    const matchesSearch =
      lead.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.company_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTier = selectedTier === "all" || lead.tier?.toLowerCase() === selectedTier.toLowerCase();
    return matchesSearch && matchesTier;
  });

  const hotCount = leads.filter((l) => l.tier?.toLowerCase() === "hot").length;
  const warmCount = leads.filter((l) => l.tier?.toLowerCase() === "warm").length;
  const pendingCount = leads.filter((l) => l.stage === "outreach_drafted").length;

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-3.5rem)] overflow-hidden bg-muted/10">
      {/* Header & Metrics */}
      <div className="flex-none p-6 pb-2">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight mb-1">Lead Pipeline</h1>
            <p className="text-sm text-muted-foreground">Monitor real-time AI scoring and outreach workflows.</p>
          </div>
          
          <div className="flex gap-4">
            <div className="flex flex-col items-end">
              <span className="text-2xl font-bold text-rose-600 tracking-tighter flex items-center gap-1">
                <Flame className="w-5 h-5" /> {hotCount}
              </span>
              <span className="text-[10px] uppercase font-bold text-muted-foreground">Hot Leads</span>
            </div>
            <div className="w-px h-10 bg-border hidden md:block" />
            <div className="flex flex-col items-end">
              <span className="text-2xl font-bold text-amber-500 tracking-tighter flex items-center gap-1">
                <ThermometerSun className="w-5 h-5" /> {warmCount}
              </span>
              <span className="text-[10px] uppercase font-bold text-muted-foreground">Warm Leads</span>
            </div>
            <div className="w-px h-10 bg-border hidden md:block" />
            <div className="flex flex-col items-end">
              <span className="text-2xl font-bold text-indigo-600 tracking-tighter flex items-center gap-1">
                <AlertCircle className="w-5 h-5" /> {pendingCount}
              </span>
              <span className="text-[10px] uppercase font-bold text-muted-foreground">Needs Review</span>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <div className="relative flex-1 max-w-sm">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Filter by name or company..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border rounded-lg bg-background shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          
          <div className="flex bg-muted/50 p-1 rounded-lg border">
            <button
              onClick={() => setSelectedTier("all")}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${selectedTier === "all" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              All
            </button>
            <button
              onClick={() => setSelectedTier("hot")}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${selectedTier === "hot" ? "bg-background shadow-sm text-rose-600" : "text-muted-foreground hover:text-rose-600"}`}
            >
              Hot
            </button>
            <button
              onClick={() => setSelectedTier("warm")}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${selectedTier === "warm" ? "bg-background shadow-sm text-amber-500" : "text-muted-foreground hover:text-amber-500"}`}
            >
              Warm
            </button>
          </div>
          
          <Button variant="outline" size="sm" className="ml-auto hidden md:flex">
            <SlidersHorizontal className="w-4 h-4 mr-2" />
            Display Options
          </Button>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden px-6 pb-6">
        <div className="flex gap-4 h-full min-w-max">
          {loading ? (
            Array(5).fill(0).map((_, i) => (
              <div key={i} className="w-[300px] flex flex-col gap-3">
                <div className="flex justify-between items-center mb-2 px-1">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-6 rounded-full" />
                </div>
                <Skeleton className="h-32 w-full rounded-xl" />
                <Skeleton className="h-32 w-full rounded-xl" />
              </div>
            ))
          ) : (
            columns.map((col) => {
              const colLeads = filteredLeads.filter((l) => col.stages.includes(l.stage));
              return (
                <div key={col.title} className="w-[300px] flex flex-col max-h-full">
                  <div className="flex items-center justify-between mb-4 px-1 shrink-0">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      {col.title}
                    </h3>
                    <Badge variant="secondary" className="font-mono text-[10px]">
                      {colLeads.length}
                    </Badge>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto space-y-3 pr-2 pb-8 custom-scrollbar">
                    {colLeads.length === 0 ? (
                      <div className="border border-dashed rounded-xl p-6 text-center text-xs text-muted-foreground">
                        No leads in this stage
                      </div>
                    ) : (
                      colLeads.map((lead) => {
                        const isSelected = selectedLeadId === lead.id;
                        let borderClass = "border-border hover:border-border/80";
                        if (isSelected) borderClass = "border-primary ring-1 ring-primary shadow-md";
                        
                        return (
                          <div
                            key={lead.id}
                            onClick={() => setSelectedLeadId(lead.id)}
                            className={`bg-card rounded-xl p-4 shadow-sm cursor-pointer transition-all ${borderClass}`}
                          >
                            <div className="flex justify-between items-start mb-2.5">
                              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider truncate pr-2">
                                {lead.company_name}
                              </span>
                              {lead.tier && (
                                <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-sm ${lead.tier === "hot" ? "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400" : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"}`}>
                                  {lead.tier}
                                </span>
                              )}
                            </div>
                            <h4 className="font-bold text-sm tracking-tight text-foreground leading-none mb-1">
                              {lead.full_name}
                            </h4>
                            <p className="text-xs text-muted-foreground truncate mb-4">
                              {lead.title}
                            </p>
                            
                            <div className="flex items-center justify-between pt-3 border-t">
                              <span className="text-[10px] font-semibold text-muted-foreground">
                                Score: <strong className="text-foreground text-xs">{lead.total_score ?? "-"}</strong>
                              </span>
                              <span className="text-[10px] text-muted-foreground/70">
                                {new Date(lead.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Dossier Panel */}
      <LeadDossier
        selectedLeadId={selectedLeadId}
        details={details}
        detailsLoading={detailsLoading}
        setSelectedLeadId={setSelectedLeadId}
        editSubject={editSubject}
        setEditSubject={setEditSubject}
        editBody={editBody}
        setEditBody={setEditBody}
        savingOutreach={savingOutreach}
        handleApprove={handleApprove}
        handleReject={handleReject}
        handleTriggerResearch={handleTriggerResearch}
        handleTriggerScore={handleTriggerScore}
        handleTriggerDraft={handleTriggerDraft}
      />
    </div>
  );
}

                    </div>
                  ) : (
                    colLeads.map((lead) => {
                      const isSelected = selectedLeadId === lead.id;
                      let tierBadge = "bg-slate-100 text-slate-700 border-slate-200";
                      if (lead.tier?.toLowerCase() === "hot") {
                        tierBadge = "bg-rose-50 text-rose-700 border-rose-200 font-black";
                      } else if (lead.tier?.toLowerCase() === "warm") {
                        tierBadge = "bg-amber-50 text-amber-800 border-amber-200 font-bold";
                      }

                      return (
                        <div
                          key={lead.id}
                          tabIndex={0}
                          role="button"
                          aria-label={`Inspect lead ${lead.full_name} from ${lead.company_name}`}
                          onClick={() => setSelectedLeadId(lead.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              setSelectedLeadId(lead.id);
                            }
                          }}
                          className={`bg-white border rounded-xl p-4 shadow-sm hover:shadow transition-all duration-150 cursor-pointer text-left focus:outline-none ${
                            isSelected
                              ? "border-indigo-600 ring-2 ring-indigo-500/20"
                              : "border-slate-200 hover:border-slate-300"
                          }`}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider truncate max-w-[140px]">
                              {lead.company_name}
                            </span>
                            {lead.tier && (
                              <span className={`text-[10px] px-2 py-0.5 rounded-full border ${tierBadge}`}>
                                {lead.tier.toUpperCase()}
                              </span>
                            )}
                          </div>

                          <h3 className="font-bold text-slate-900 text-sm tracking-tight leading-snug">
                            {lead.full_name}
                          </h3>
                          <p className="text-xs text-slate-500 truncate mt-0.5">{lead.title}</p>

                          <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-500">
                            <span className="font-semibold text-slate-700">
                              ICP Score: <strong className="text-indigo-600 font-bold">{lead.total_score ?? "N/A"}</strong>
                            </span>
                            <span>{new Date(lead.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Slide-over Detail Panel */}
      {selectedLeadId && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Lead profile and triage inspector"
          className="fixed inset-y-0 right-0 w-full sm:w-[540px] bg-white shadow-2xl border-l border-slate-200 flex flex-col z-50 animate-in slide-in-from-right duration-200"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900 text-white">
            <div>
              <h2 className="text-base font-bold tracking-tight">Lead Dossier & Outreach Triage</h2>
              <span className="text-[11px] text-slate-400 font-mono">Lead ID: {selectedLeadId}</span>
            </div>
            <button
              onClick={() => setSelectedLeadId(null)}
              aria-label="Close detail panel"
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Scrollable Detail Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {detailsLoading ? (
              <SkeletonDetailPanel />
            ) : details ? (
              <>
                {/* 1. Header Card Info */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-bold text-slate-900">{details.lead.full_name}</h3>
                      <p className="text-xs text-slate-500">
                        {details.lead.title} @ <strong className="text-slate-700">{details.company.name}</strong>
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">Status</span>
                      <span className="bg-indigo-100 text-indigo-800 text-[11px] font-bold px-2.5 py-0.5 rounded-full capitalize">
                        {details.lead.stage.replace("_", " ")}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-200/80 text-xs font-medium">
                    <a
                      href={`mailto:${details.lead.email}`}
                      className="text-indigo-600 hover:underline flex items-center gap-1"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      {details.lead.email}
                    </a>
                  </div>

                  {/* Manual Stage Trigger CTAs */}
                  <div className="mt-4 pt-3 border-t border-slate-200 flex flex-wrap gap-2">
                    {details.lead.stage === "ingested" && (
                      <button
                        onClick={handleTriggerResearch}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex-1 transition-colors shadow-sm"
                      >
                        Run Claude Research
                      </button>
                    )}
                    {details.lead.stage === "researched" && (
                      <button
                        onClick={handleTriggerScore}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex-1 transition-colors shadow-sm"
                      >
                        Compute ICP Score
                      </button>
                    )}
                    {details.lead.stage === "scored" && (
                      <button
                        onClick={handleTriggerDraft}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex-1 transition-colors shadow-sm"
                      >
                        Draft Outreach Copy
                      </button>
                    )}
                  </div>
                </div>

                {/* 2. Firmographics */}
                <div>
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Firmographics</h4>
                  <div className="flex flex-wrap gap-2">
                    <span className="bg-slate-100 text-slate-800 text-xs px-3 py-1.5 rounded-lg border border-slate-200 font-medium">
                      Industry: <strong className="text-slate-900">{details.company.industry ?? "Technology"}</strong>
                    </span>
                    <span className="bg-slate-100 text-slate-800 text-xs px-3 py-1.5 rounded-lg border border-slate-200 font-medium">
                      Size: <strong className="text-slate-900">{details.company.employee_count ?? 150} employees</strong>
                    </span>
                    <span className="bg-slate-100 text-slate-800 text-xs px-3 py-1.5 rounded-lg border border-slate-200 font-medium">
                      Revenue: <strong className="text-slate-900">{details.company.revenue_band ?? "$10M - $50M"}</strong>
                    </span>
                  </div>

                  <div className="mt-3.5">
                    <span className="text-xs font-semibold text-slate-600 block mb-1">Detected Tech Stack:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {details.company.tech_stack && details.company.tech_stack.length > 0 ? (
                        details.company.tech_stack.map((t) => (
                          <span key={t} className="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-2.5 py-0.5 rounded border border-indigo-100">
                            {t}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-slate-400 italic">None detected</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* 3. AI Deterministic Score Breakdown */}
                {details.score && (
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Deterministic ICP Scoring</h4>
                      <span className="text-xs font-extrabold text-indigo-700">Total: {details.score.total_score}/100</span>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                      {[
                        { label: "ICP Fit (Firmographics)", val: details.score.fit_score },
                        { label: "Intent Signals (News & Hiring)", val: details.score.intent_score },
                        { label: "Contactability (Verified Email)", val: details.score.contactability_score },
                        { label: "Digital Gap (Competitor Inefficiencies)", val: details.score.gap_score },
                        { label: "Engagement Likelihood", val: details.score.engagement_score },
                      ].map((item) => (
                        <div key={item.label}>
                          <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                            <span>{item.label}</span>
                            <span className="font-bold">{item.val}/20</span>
                          </div>
                          <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                            <div className="bg-indigo-600 h-1.5 rounded-full" style={{ width: `${(item.val / 20) * 100}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 4. Research Brief */}
                {details.research && (
                  <div>
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Prospect Research Brief</h4>
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-700 leading-relaxed space-y-3">
                      <p className="font-semibold text-slate-900 border-b border-slate-200 pb-2">Synthesis:</p>
                      <p>{details.research.summary}</p>

                      <div className="mt-2">
                        <p className="font-semibold text-slate-900 mb-1">Extracted Personalization Angles:</p>
                        <ul className="list-disc pl-4 space-y-1 text-slate-600">
                          {details.research.personalization_angles.map((ang, idx) => (
                            <li key={idx}>{ang}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {/* 5. Outreach Draft Editor */}
                {details.outreach && details.outreach.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Outreach Message Draft</h4>
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">Subject Line</label>
                        <input
                          type="text"
                          value={editSubject}
                          onChange={(e) => setEditSubject(e.target.value)}
                          className="w-full text-xs font-medium border border-slate-300 rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">Message Body</label>
                        <textarea
                          rows={7}
                          value={editBody}
                          onChange={(e) => setEditBody(e.target.value)}
                          className="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-indigo-500 font-sans leading-relaxed"
                        />
                      </div>

                      {/* Action CTAs */}
                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={handleApprove}
                          disabled={savingOutreach}
                          className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-400 text-white text-xs font-bold px-4 py-2.5 rounded-lg flex-1 transition-colors shadow-sm"
                        >
                          {savingOutreach ? "Authorizing..." : "Approve & Enqueue for Dispatch"}
                        </button>
                        <button
                          onClick={handleReject}
                          disabled={savingOutreach}
                          className="bg-white hover:bg-rose-50 text-rose-700 text-xs font-bold px-4 py-2.5 rounded-lg border border-rose-300 transition-colors"
                        >
                          Discard Draft
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-20 text-slate-400">Select a lead card to inspect profile context</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


                {/* 6. Activity Logs */}
                {details.activities && details.activities.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2.5">Activity Timeline</h4>
                    <div className="flow-root">
                      <ul className="-mb-8">
                        {details.activities.map((act, actIdx) => (
                          <li key={act.id}>
                            <div className="relative pb-8">
                              {actIdx !== details.activities.length - 1 ? (
                                <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-slate-200" aria-hidden="true" />
                              ) : null}
                              <div className="relative flex space-x-3">
                                <div>
                                  <span className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center ring-8 ring-white text-[10px] font-bold text-slate-500 capitalize">
                                    {act.action.slice(0, 2)}
                                  </span>
                                </div>
                                <div className="flex-1 min-w-0 pt-1.5 flex justify-between space-x-4">
                                  <div>
                                    <p className="text-xs text-slate-800">
                                      <span className="font-semibold text-slate-900">{act.action.replace("_", " ")}</span> by <span className="font-semibold text-slate-650">{act.actor}</span>
                                    </p>
                                    {act.detail && Object.keys(act.detail).length > 0 && (
                                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                                        {JSON.stringify(act.detail)}
                                      </p>
                                    )}
                                  </div>
                                  <div className="text-right text-[10px] whitespace-nowrap text-slate-400 font-medium">
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
              <div className="text-center py-20 text-slate-400">Select a lead to visualize context</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

