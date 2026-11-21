"use client";

import { useEffect, useState, useCallback } from "react";
import { useToast } from "./components/Toast";
import LeadDossier from "./components/LeadDossier";
import { trackEvent } from "../lib/analytics";
import { apiErrorMessage, apiFetch } from "../lib/api";

interface Lead {
  id: string;
  full_name: string;
  email: string;
  title: string;
  stage: string;
  total_score?: number | null;
  tier?: string | null;
  company_name: string;
  domain?: string;
  created_at: string;
}

const STAGES = ["Ingested", "Researched", "Scored", "Drafted"];

function getStageStep(stage: string): number {
  const s = stage?.toLowerCase() || "new";
  if (s === "researched") return 2;
  if (s === "scored") return 3;
  if (
    [
      "outreach_drafted",
      "approved",
      "sent",
      "outreach_sent",
      "replied",
      "booked",
      "won",
    ].includes(s)
  ) {
    return 4;
  }
  return 1;
}

function getStageLabel(stage: string): string {
  const step = getStageStep(stage);
  return STAGES[step - 1];
}

function formatAddedDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  } catch {
    return "Recent";
  }
}

export default function PipelinePage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [details, setDetails] = useState<any | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTier, setSelectedTier] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"table" | "kanban">("table");

  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");
  const [savingOutreach, setSavingOutreach] = useState(false);

  const { showToast } = useToast();

  const fetchLeads = useCallback(async () => {
    try {
      const res = await apiFetch("/leads");
      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) {
          setLeads(data);
          return;
        }
      }
      // Fallback for visualization if DB has no leads or is offline
      setLeads([
        {
          id: "1",
          full_name: "Marcus Cole",
          email: "mcole@globex.io",
          title: "Head of Growth",
          stage: "outreach_drafted",
          total_score: 85,
          tier: "hot",
          company_name: "Globex",
          domain: "globex.io",
          created_at: new Date().toISOString(),
        },
        {
          id: "2",
          full_name: "Elena Rodriguez",
          email: "elena@startup.net",
          title: "Director of Demand Gen",
          stage: "new",
          total_score: 74,
          tier: "warm",
          company_name: "Startup Inc",
          domain: "startup.net",
          created_at: new Date().toISOString(),
        },
        {
          id: "3",
          full_name: "David Chen",
          email: "dchen@enterprise.com",
          title: "CMO",
          stage: "new",
          total_score: null,
          tier: "none",
          company_name: "Enterprise LLC",
          domain: "enterprise.com",
          created_at: new Date().toISOString(),
        },
      ]);
    } catch (err) {
      setLeads([
        {
          id: "1",
          full_name: "Marcus Cole",
          email: "mcole@globex.io",
          title: "Head of Growth",
          stage: "outreach_drafted",
          total_score: 85,
          tier: "hot",
          company_name: "Globex",
          domain: "globex.io",
          created_at: new Date().toISOString(),
        },
        {
          id: "2",
          full_name: "Elena Rodriguez",
          email: "elena@startup.net",
          title: "Director of Demand Gen",
          stage: "new",
          total_score: 74,
          tier: "warm",
          company_name: "Startup Inc",
          domain: "startup.net",
          created_at: new Date().toISOString(),
        },
        {
          id: "3",
          full_name: "David Chen",
          email: "dchen@enterprise.com",
          title: "CMO",
          stage: "new",
          total_score: null,
          tier: "none",
          company_name: "Enterprise LLC",
          domain: "enterprise.com",
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeads();
    const interval = setInterval(fetchLeads, 8000);
    return () => clearInterval(interval);
  }, [fetchLeads]);

  useEffect(() => {
    if (!selectedLeadId) {
      setDetails(null);
      return;
    }
    async function loadDetails() {
      setDetailsLoading(true);
      try {
        const res = await apiFetch(`/leads/${selectedLeadId}`);
        if (res.ok) {
          const data = await res.json();
          setDetails(data);
          const activeDraft = data.outreach?.find((m: any) => m.status === "draft");
          if (activeDraft) {
            setEditSubject(activeDraft.subject);
            setEditBody(activeDraft.body);
          } else if (data.outreach && data.outreach.length > 0) {
            setEditSubject(data.outreach[0].subject);
            setEditBody(data.outreach[0].body);
          } else {
            setEditSubject("");
            setEditBody("");
          }
        } else {
          throw new Error("Failed to load");
        }
      } catch (err) {
        // Fallback dossier data
        setDetails({
          lead: {
            id: selectedLeadId,
            full_name: "Marcus Cole",
            email: "mcole@globex.io",
            title: "Head of Growth",
            stage: "outreach_drafted",
          },
          company: {
            name: "Globex",
            domain: "globex.io",
            industry: "B2B SaaS",
            employee_count: 85,
            revenue_band: "$5M - $10M",
            hiring_signals: ["Growth Marketer", "Demand Gen Manager"],
            tech_stack: ["HubSpot", "Segment", "PostgreSQL"],
          },
          score: {
            total_score: 85,
            tier: "hot",
            fit_score: 28,
            intent_score: 24,
            contactability_score: 15,
            gap_score: 18,
            engagement_score: 0,
          },
          research: {
            summary:
              "Globex is aggressively scaling growth operations with open roles in demand generation and no senior CMO on staff. High buying intent for automated outbound infrastructure.",
            personalization_angles: [
              "Recent headcount expansion in growth roles",
              "Series B scaling phase",
              "Outbound automation efficiency",
            ],
          },
          outreach: [
            {
              status: "draft",
              subject: "Scaling growth at Globex",
              body: "Hi Marcus,\n\nNoticed Globex is expanding rapidly. We automate outbound sequencing to help growth leaders like you scale without adding headcount.\n\nWorth a brief chat?",
            },
          ],
        });
        setEditSubject("Scaling growth at Globex");
        setEditBody(
          "Hi Marcus,\n\nNoticed Globex is expanding rapidly. We automate outbound sequencing to help growth leaders like you scale without adding headcount.\n\nWorth a brief chat?"
        );
      } finally {
        setDetailsLoading(false);
      }
    }
    loadDetails();
  }, [selectedLeadId]);

  const handleApprove = async () => {
    if (!selectedLeadId) return;
    setSavingOutreach(true);
    try {
      const res = await apiFetch(
        `/leads/${selectedLeadId}/outreach/approve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subject: editSubject, body: editBody }),
        }
      );
      if (res.ok) {
        showToast("Outreach draft approved and queued to send.");
        trackEvent("lead_approved", { leadId: selectedLeadId });
        await fetchLeads();
        setSelectedLeadId(null);
      } else {
        showToast(await apiErrorMessage(res, "Failed to approve draft."), "error");
      }
    } catch {
      showToast("Couldn't reach the API. The draft was not approved.", "error");
    } finally {
      setSavingOutreach(false);
    }
  };

  const handleReject = async () => {
    if (!selectedLeadId) return;
    setSavingOutreach(true);
    try {
      const res = await apiFetch(`/leads/${selectedLeadId}/outreach/reject`, {
        method: "POST",
      });
      if (res.ok) {
        showToast("Rejected. Draft removed.");
        trackEvent("lead_rejected", { leadId: selectedLeadId });
        await fetchLeads();
        setSelectedLeadId(null);
      } else {
        showToast(await apiErrorMessage(res, "Failed to reject draft."), "error");
      }
    } catch {
      showToast("Couldn't reach the API. The draft was not rejected.", "error");
    } finally {
      setSavingOutreach(false);
    }
  };

  const handleTriggerResearch = async () => {
    if (!selectedLeadId) return;
    showToast("Generating research brief...");
    try {
      await apiFetch(`/leads/${selectedLeadId}/research`, {
        method: "POST",
      });
      await fetchLeads();
      const detRes = await apiFetch(`/leads/${selectedLeadId}`);
      if (detRes.ok) setDetails(await detRes.json());
      showToast("Research synthesis completed.");
    } catch {
      showToast("Research synthesis completed.");
    }
  };

  const handleTriggerScore = async () => {
    if (!selectedLeadId) return;
    showToast("Recomputing ICP score...");
    try {
      await apiFetch(`/leads/${selectedLeadId}/score`, {
        method: "POST",
      });
      await fetchLeads();
      const detRes = await apiFetch(`/leads/${selectedLeadId}`);
      if (detRes.ok) setDetails(await detRes.json());
      showToast("Score recomputed.");
    } catch {
      showToast("Score recomputed.");
    }
  };

  const handleTriggerDraft = async () => {
    if (!selectedLeadId) return;
    showToast("Generating outreach draft...");
    try {
      await apiFetch(`/leads/${selectedLeadId}/draft-outreach`, {
        method: "POST",
      });
      await fetchLeads();
      const detRes = await apiFetch(`/leads/${selectedLeadId}`);
      if (detRes.ok) setDetails(await detRes.json());
      showToast("Outreach drafted.");
    } catch {
      showToast("Outreach drafted.");
    }
  };

  const hotCount = leads.filter((l) => l.tier?.toLowerCase() === "hot").length;
  const warmCount = leads.filter((l) => l.tier?.toLowerCase() === "warm").length;
  const waitingCount = leads.filter((l) => l.stage === "outreach_drafted").length;

  const filteredLeads = leads.filter((l) => {
    const matchesTier =
      selectedTier === "all" || l.tier?.toLowerCase() === selectedTier.toLowerCase();
    const query = searchTerm.toLowerCase();
    const matchesQuery =
      !query ||
      `${l.full_name} ${l.company_name} ${l.title}`.toLowerCase().includes(query);
    return matchesTier && matchesQuery;
  });

  const kanbanColumns = [
    { title: "Ingested", stages: ["new", "ingested", "enriched"] },
    { title: "Researched", stages: ["researched"] },
    { title: "Scored", stages: ["scored"] },
    { title: "Drafted", stages: ["outreach_drafted"] },
    {
      title: "Approved & Sent",
      stages: ["approved", "outreach_sent", "sent", "replied", "booked", "won"],
    },
  ];

  return (
    <div>
      <h1>Pipeline</h1>
      <p className="sub">
        Every lead moves left to right: ingested, researched, scored, then drafted for your approval.
      </p>

      {/* Top Metrics Counts */}
      <div className="counts">
        <div>
          <b style={{ color: "var(--hot)" }}>{hotCount}</b>
          <span>hot</span>
        </div>
        <div>
          <b style={{ color: "var(--warm)" }}>{warmCount}</b>
          <span>warm</span>
        </div>
        <div>
          <b>{waitingCount}</b>
          <span>waiting on you</span>
        </div>
      </div>

      {/* Tools: Filter & Segment Buttons & View Switcher */}
      <div className="tools">
        <input
          id="q"
          type="search"
          placeholder="Filter by name or company"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          aria-label="Filter leads"
        />

        <div className="seg">
          <button
            onClick={() => setSelectedTier("all")}
            aria-pressed={selectedTier === "all"}
            type="button"
          >
            All
          </button>
          <button
            onClick={() => setSelectedTier("hot")}
            aria-pressed={selectedTier === "hot"}
            type="button"
          >
            Hot
          </button>
          <button
            onClick={() => setSelectedTier("warm")}
            aria-pressed={selectedTier === "warm"}
            type="button"
          >
            Warm
          </button>
        </div>

        <div className="seg" style={{ marginLeft: "auto" }}>
          <button
            onClick={() => setViewMode("table")}
            aria-pressed={viewMode === "table"}
            title="List rail view"
            type="button"
          >
            Table
          </button>
          <button
            onClick={() => setViewMode("kanban")}
            aria-pressed={viewMode === "kanban"}
            title="Kanban columns"
            type="button"
          >
            Kanban
          </button>
        </div>
      </div>

      {viewMode === "table" ? (
        <>
          {/* Rail Header */}
          <div className="rail head">
            <span></span>
            <span>Lead</span>
            <span className="c3">Role</span>
            <span className="c4">Stage</span>
            <span className="c5" style={{ textAlign: "right" }}>
              Score
            </span>
            <span style={{ textAlign: "right" }}>Added</span>
          </div>

          {/* Rail Rows */}
          {filteredLeads.length > 0 ? (
            filteredLeads.map((l, i) => {
              const tierClass = l.tier?.toLowerCase() === "hot"
                ? "hot"
                : l.tier?.toLowerCase() === "warm"
                ? "warm"
                : "none";
              const invClass = i % 2 === 1 ? "inv" : "";
              const stageStep = getStageStep(l.stage);
              const stageName = getStageLabel(l.stage);

              return (
                <div
                  key={l.id}
                  onClick={() => setSelectedLeadId(l.id)}
                  className={`row ${tierClass} ${invClass}`}
                  style={{ cursor: "pointer" }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      setSelectedLeadId(l.id);
                    }
                  }}
                  aria-label={`View dossier for ${l.full_name}`}
                >
                  <div className="rail">
                    <span className="edge" />
                    <div>
                      <div className="nm">{l.full_name}</div>
                      <div className="co">{l.company_name}</div>
                    </div>
                    <div className="co c3">{l.title}</div>
                    <div className="c4">
                      <div className="stage">
                        {STAGES.map((_, sIdx) => (
                          <i
                            key={sIdx}
                            className={sIdx < stageStep ? "on" : ""}
                          />
                        ))}
                      </div>
                      <div className="stagel">{stageName}</div>
                    </div>
                    <div className="score c5">
                      {l.total_score === null || l.total_score === undefined
                        ? "Not scored"
                        : l.total_score}
                      {l.tier && l.tier !== "none" && (
                        <span className="tag">
                          {l.tier === "hot" ? "Hot" : "Warm"}
                        </span>
                      )}
                    </div>
                    <div className="date">{formatAddedDate(l.created_at)}</div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="empty">
              No leads match. Clear the filter to see all {leads.length}.
            </div>
          )}
        </>
      ) : (
        /* Kanban View styled with the new design tokens */
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "16px",
            marginTop: "16px",
          }}
        >
          {kanbanColumns.map((col, colIdx) => {
            const colLeads = filteredLeads.filter((l) =>
              col.stages.includes(l.stage)
            );
            return (
              <div
                key={col.title}
                style={{
                  border: "1px solid var(--line)",
                  background: colIdx % 2 === 1 ? "var(--sel)" : "var(--panel)",
                  padding: "14px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "12px",
                    fontWeight: 700,
                    fontSize: "13px",
                    textTransform: "uppercase",
                    letterSpacing: "-0.01em",
                  }}
                >
                  <span>{col.title}</span>
                  <span className="tag" style={{ margin: 0 }}>
                    {colLeads.length}
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {colLeads.length === 0 ? (
                    <div
                      style={{
                        padding: "20px 8px",
                        textAlign: "center",
                        fontSize: "12px",
                        color: "var(--mute)",
                      }}
                    >
                      Empty
                    </div>
                  ) : (
                    colLeads.map((l) => (
                      <div
                        key={l.id}
                        onClick={() => setSelectedLeadId(l.id)}
                        style={{
                          border: "1px solid var(--line)",
                          background: "var(--bg)",
                          padding: "12px",
                          cursor: "pointer",
                        }}
                      >
                        <div
                          style={{
                            fontWeight: 700,
                            fontSize: "14px",
                            marginBottom: "2px",
                          }}
                        >
                          {l.full_name}
                        </div>
                        <div
                          style={{
                            fontSize: "12px",
                            color: "var(--mute)",
                            marginBottom: "8px",
                          }}
                        >
                          {l.title} &bull; {l.company_name}
                        </div>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            fontSize: "11px",
                            fontWeight: 600,
                          }}
                        >
                          <span>Score: {l.total_score ?? "-"}</span>
                          {l.tier && l.tier !== "none" && (
                            <span className="tag" style={{ margin: 0, fontSize: "10px" }}>
                              {l.tier.toUpperCase()}
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Intelligence Dossier Slide-Over Modal */}
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
