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
        if (data && data.length > 0) {
          setLeads(data);
        } else {
          // Fallback for UI visualization purposes if DB is empty
          setLeads([
            {
                id: "1", full_name: "Sarah Jenkins", email: "sarah.j@acmecorp.com",
                title: "VP of Marketing", stage: "hot", total_score: 92, tier: "hot",
                company_name: "Acme Corp", domain: "acmecorp.com", created_at: new Date().toISOString(),
            },
            {
                id: "2", full_name: "Marcus Cole", email: "mcole@globex.io",
                title: "Head of Growth", stage: "outreach_drafted", total_score: 85, tier: "hot",
                company_name: "Globex", domain: "globex.io", created_at: new Date().toISOString(),
            },
            {
                id: "3", full_name: "Elena Rodriguez", email: "elena@startup.net",
                title: "Director of Demand Gen", stage: "enriched", total_score: 74, tier: "warm",
                company_name: "Startup Inc", domain: "startup.net", created_at: new Date().toISOString(),
            },
            {
                id: "4", full_name: "David Chen", email: "dchen@enterprise.com",
                title: "CMO", stage: "new", total_score: null, tier: null,
                company_name: "Enterprise LLC", domain: "enterprise.com", created_at: new Date().toISOString(),
            }
          ]);
        }
      }
    } catch (err) {
      console.debug("Backend not currently running or unreachable:", err);
      // Fallback for UI visualization purposes if no backend
      setLeads([
          {
              id: "1", full_name: "Sarah Jenkins", email: "sarah.j@acmecorp.com",
              title: "VP of Marketing", stage: "hot", total_score: 92, tier: "hot",
              company_name: "Acme Corp", domain: "acmecorp.com", created_at: new Date().toISOString(),
          },
          {
              id: "2", full_name: "Marcus Cole", email: "mcole@globex.io",
              title: "Head of Growth", stage: "outreach_drafted", total_score: 85, tier: "hot",
              company_name: "Globex", domain: "globex.io", created_at: new Date().toISOString(),
          },
          {
              id: "3", full_name: "Elena Rodriguez", email: "elena@startup.net",
              title: "Director of Demand Gen", stage: "enriched", total_score: 74, tier: "warm",
              company_name: "Startup Inc", domain: "startup.net", created_at: new Date().toISOString(),
          },
          {
              id: "4", full_name: "David Chen", email: "dchen@enterprise.com",
              title: "CMO", stage: "new", total_score: null, tier: null,
              company_name: "Enterprise LLC", domain: "enterprise.com", created_at: new Date().toISOString(),
          }
      ]);
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
        // Fallback for UI visualization purposes
        setDetails({
          lead: {
            id: selectedLeadId,
            full_name: "Sarah Jenkins",
            email: "sarah.j@acmecorp.com",
            title: "VP of Marketing",
            stage: "hot"
          },
          company: {
            name: "Acme Corp",
            domain: "acmecorp.com",
            industry: "SaaS",
            employee_count: 150,
            revenue_band: "$10M - $50M",
            hiring_signals: ["Looking for growth marketers", "Expanding marketing team"],
            tech_stack: ["React", "Node", "Postgres"]
          },
          score: {
            total_score: 92,
            fit_score: 18,
            intent_score: 19,
            contactability_score: 18,
            gap_score: 17,
            engagement_score: 20
          },
          research: {
            summary: "Acme Corp recently raised Series B and is aggressively expanding their GTM team. They have high intent for automated outbound solutions.",
            personalization_angles: ["Recent funding round", "Growth goals", "Marketing scale"]
          },
          outreach: [
            {
              status: "draft",
              subject: "Automating your outbound at Acme Corp",
              body: "Hi Sarah,\n\nI noticed your recent Series B and aggressive hiring for the growth team. We help SaaS companies like yours automate their outbound pipeline using AI.\n\nWould you be open to a quick chat?"
            }
          ],
          activities: [
            {
              id: "act-1",
              action: "lead_ingested",
              actor: "System",
              detail: { source: "Apollo" },
              created_at: new Date().toISOString()
            },
            {
              id: "act-2",
              action: "score_computed",
              actor: "AI Engine",
              detail: { score: 92 },
              created_at: new Date().toISOString()
            }
          ]
        });
        setEditSubject("Automating your outbound at Acme Corp");
        setEditBody("Hi Sarah,\n\nI noticed your recent Series B and aggressive hiring for the growth team. We help SaaS companies like yours automate their outbound pipeline using AI.\n\nWould you be open to a quick chat?");
      } finally {
        setDetailsLoading(false);
      }
    }
    loadDetails();
  }, [selectedLeadId]);

  const columns = [
    { title: "New Ingestion", stages: ["new", "ingested", "enriched"] },
    { title: "Researched", stages: ["researched"] },
    { title: "Scored", stages: ["scored"] },
    { title: "Drafted", stages: ["outreach_drafted"] },
    { title: "Approved & Sent", stages: ["outreach_approved", "approved", "sent", "outreach_sent", "replied", "booked", "won"] },
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
    <div className="flex-1 flex flex-col h-[calc(100vh-4rem)] overflow-hidden bg-slate-50/50 bg-mesh">
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
                        let borderClass = "border-slate-100/50 hover:border-slate-200";
                        if (isSelected) borderClass = "border-primary ring-2 ring-primary/20 shadow-lg";
                        
                        return (
                          <div
                            key={lead.id}
                            onClick={() => setSelectedLeadId(lead.id)}
                            className={`bg-white rounded-2xl p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border cursor-pointer transition-all ${borderClass}`}
                          >
                            <div className="flex justify-between items-start mb-3">
                              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider truncate pr-2">
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
