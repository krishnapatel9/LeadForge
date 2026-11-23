"use client";

import { useState } from "react";
import { useToast } from "../components/Toast";
import { ErrorState, LoadingState } from "../components/States";
import { apiErrorMessage, apiFetch } from "../../lib/api";
import { useApi } from "../../lib/useApi";
import type { Kpi, ReportSummary } from "../../lib/types";

const PERIODS = [7, 30, 90];

function formatValue(k: Kpi): string {
  if (k.value === null) return "—";
  if (k.format === "pct") return `${Math.round(k.value * 100)}%`;
  if (k.format === "score") return `${k.value}/100`;
  return k.value.toLocaleString();
}

function formatDelta(k: Kpi): string | null {
  if (k.delta === null) return null;
  const sign = k.delta > 0 ? "+" : k.delta < 0 ? "−" : "±";
  const abs = Math.abs(k.delta);
  if (k.delta_format === "pts") return `${sign}${Math.round(abs)} pts`;
  return `${sign}${Math.round(abs * 100)}%`; // pct change, or percentage points for rates
}

export default function PerformancePage() {
  const { showToast } = useToast();
  const [days, setDays] = useState(30);
  const { data, error, loading, reload } = useApi<ReportSummary>(`/reports/summary?days=${days}`);
  const [downloading, setDownloading] = useState(false);

  const download = async () => {
    setDownloading(true);
    try {
      const res = await apiFetch(`/reports/export.csv?days=${days}`);
      if (!res.ok) throw new Error(await apiErrorMessage(res, "Export failed."));
      const blob = await res.blob();
      const name =
        /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? "leadforge_pipeline.csv";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
      showToast(`Downloaded ${name}`);
    } catch (err) {
      showToast(err instanceof TypeError ? "Can't reach the LeadForge API." : (err as Error).message, "error");
    } finally {
      setDownloading(false);
    }
  };

  const sourced = data?.funnel[0]?.count ?? 0;

  return (
    <div>
      <h1>Performance</h1>
      <p className="sub">
        {data
          ? `What happened to the ${sourced.toLocaleString()} leads sourced in the last ${days} days, and where they dropped out.`
          : "What happened to the leads sourced this period, and where they dropped out."}
      </p>

      <div className="tools" style={{ marginBottom: 24 }}>
        <div className="seg" role="group" aria-label="Period">
          {PERIODS.map((p) => (
            <button key={p} type="button" aria-pressed={days === p} onClick={() => setDays(p)}>
              {p} days
            </button>
          ))}
        </div>
      </div>

      {loading && !data ? (
        <LoadingState label="Loading numbers…" />
      ) : error && !data ? (
        <ErrorState message={error} onRetry={() => reload()} />
      ) : data ? (
        <>
          <div className="kpis">
            {data.kpis.map((k, i) => {
              const delta = formatDelta(k);
              return (
                <div key={k.key} className={`kpi${i % 2 ? " inv" : ""}`}>
                  <b>{formatValue(k)}</b>
                  <span>{k.label}</span>
                  <em className={k.delta !== null && k.delta < 0 ? "neg" : ""}>{delta ?? "no earlier data"}</em>
                </div>
              );
            })}
          </div>

          <div className="fun">
            <h2>Where leads drop out</h2>
            <p className="sub" style={{ marginBottom: 12 }}>
              {data.meeting_rate === null
                ? "No leads were sourced in this period."
                : `${(data.meeting_rate * 100).toFixed(1)}% of sourced leads end in a meeting.`}
            </p>
            {data.funnel.map((f, i) => {
              const p = sourced ? (f.count / sourced) * 100 : 0;
              const next = data.funnel[i + 1];
              return (
                <div key={f.stage}>
                  <div className="fr">
                    <div>{f.stage}</div>
                    <div className={`bar${i % 2 ? " out" : ""}`} style={{ width: `${Math.max(p, 8)}%` }}>
                      {f.count}
                      <span style={{ fontWeight: 400, marginLeft: 8, opacity: 0.8 }}>{p.toFixed(1)}%</span>
                    </div>
                  </div>
                  {next && (
                    <div className="fr" style={{ padding: 0 }}>
                      <div></div>
                      <div className="loss">
                        <b>{Math.max(f.count - next.count, 0)} lost</b> before {next.stage.toLowerCase()}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <p style={{ marginTop: 32 }}>
            <button className="btn" type="button" onClick={download} disabled={downloading}>
              {downloading ? "Preparing…" : "Download CSV"}
            </button>
          </p>
        </>
      ) : null}
    </div>
  );
}
