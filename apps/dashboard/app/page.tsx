"use client";

import { useState } from "react";
import LeadDossier from "./components/LeadDossier";
import { ErrorState, LoadingState } from "./components/States";
import { useApi } from "../lib/useApi";
import { KANBAN_COLUMNS, STEPS, stageLabel, stageStep, tierClass, tierLabel } from "../lib/stages";
import type { LeadListItem } from "../lib/types";

function formatAddedDate(dateStr: string): string {
  const d = new Date(dateStr);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

type TierFilter = "all" | "hot" | "warm";

export default function PipelinePage() {
  const { data, error, loading, reload } = useApi<LeadListItem[]>("/leads", { pollMs: 15000 });
  const leads = data ?? [];

  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<TierFilter>("all");
  const [view, setView] = useState<"table" | "kanban">("table");

  const hotCount = leads.filter((l) => l.tier === "hot").length;
  const warmCount = leads.filter((l) => l.tier === "warm").length;
  const waitingCount = leads.filter((l) => l.stage === "outreach_drafted").length;

  const query = q.trim().toLowerCase();
  const list = leads.filter(
    (l) =>
      (filter === "all" || l.tier === filter) &&
      (!query || `${l.full_name} ${l.company_name} ${l.title ?? ""}`.toLowerCase().includes(query))
  );

  const open = (id: string) => setSelectedLeadId(id);

  return (
    <div>
      <h1>Pipeline</h1>
      <p className="sub">
        Every lead moves left to right: ingested, researched, scored, then drafted for your approval.
      </p>

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

      <div className="tools">
        <input
          id="q"
          type="search"
          placeholder="Filter by name or company"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Filter leads"
        />
        <div className="seg">
          {(["all", "hot", "warm"] as TierFilter[]).map((f) => (
            <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>
              {f[0].toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <div className="seg" style={{ marginLeft: "auto" }}>
          <button type="button" aria-pressed={view === "table"} onClick={() => setView("table")}>
            Table
          </button>
          <button type="button" aria-pressed={view === "kanban"} onClick={() => setView("kanban")}>
            Kanban
          </button>
        </div>
      </div>

      {loading && !data ? (
        <LoadingState label="Loading leads…" />
      ) : error && !data ? (
        <ErrorState message={error} onRetry={() => reload()} />
      ) : leads.length === 0 ? (
        <div className="empty">
          No leads yet. Leads appear here when Apollo, Clay or n8n send them to the ingest webhook (see Integrations).
        </div>
      ) : view === "table" ? (
        <>
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

          {list.length > 0 ? (
            list.map((l, i) => {
              const step = stageStep(l.stage);
              const tag = tierLabel(l.tier);
              return (
                <div
                  key={l.id}
                  className={`row ${tierClass(l.tier)}${i % 2 ? " inv" : ""}`}
                  style={{ cursor: "pointer" }}
                  role="button"
                  tabIndex={0}
                  onClick={() => open(l.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      open(l.id);
                    }
                  }}
                  aria-label={`Open ${l.full_name}, ${l.company_name}`}
                >
                  <div className="rail">
                    <span className="edge" />
                    <div>
                      <div className="nm">{l.full_name}</div>
                      <div className="co">{l.company_name}</div>
                    </div>
                    <div className="co c3">{l.title ?? ""}</div>
                    <div className="c4">
                      <div className="stage">
                        {STEPS.map((_, s) => (
                          <i key={s} className={s < step ? "on" : ""} />
                        ))}
                      </div>
                      <div className="stagel">{stageLabel(l.stage)}</div>
                    </div>
                    <div className="score c5">
                      {l.total_score ?? "Not scored"}
                      {tag && <span className="tag">{tag}</span>}
                    </div>
                    <div className="date">{formatAddedDate(l.created_at)}</div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="empty">No leads match. Clear the filter to see all {leads.length}.</div>
          )}
        </>
      ) : (
        <div className="kanban">
          {KANBAN_COLUMNS.map((col, ci) => {
            const colLeads = list.filter((l) => col.stages.includes(l.stage));
            return (
              <section key={col.title} className={`kcol${ci % 2 ? " inv" : ""}`} aria-label={col.title}>
                <header>
                  <span>{col.title}</span>
                  <span className="tag">{colLeads.length}</span>
                </header>
                {colLeads.length === 0 ? (
                  <div className="kempty">Empty</div>
                ) : (
                  colLeads.map((l) => (
                    <button key={l.id} type="button" className="kcard" onClick={() => open(l.id)}>
                      <b>{l.full_name}</b>
                      <small>
                        {l.title ? `${l.title} · ` : ""}
                        {l.company_name}
                      </small>
                      <small>
                        {l.total_score === null ? "Not scored" : `Score ${l.total_score}`}
                        {l.tier ? ` · ${tierLabel(l.tier)}` : ""}
                      </small>
                    </button>
                  ))
                )}
              </section>
            );
          })}
        </div>
      )}

      <LeadDossier
        leadId={selectedLeadId}
        onClose={() => setSelectedLeadId(null)}
        onChanged={() => reload(true)}
      />
    </div>
  );
}
