"use client";

import { useState } from "react";
import { useToast } from "../components/Toast";

export default function PerformancePage() {
  const { showToast } = useToast();

  const [kpis] = useState([
    { label: "Leads sourced", val: "286", delta: "+12%", isNegative: false },
    { label: "Average score", val: "75/100", delta: "+3 pts", isNegative: false },
    { label: "Approved by you", val: "92%", delta: "−1%", isNegative: true },
    { label: "Emails sent", val: "263", delta: "+8%", isNegative: false },
    { label: "Replies", val: "34", delta: "+14%", isNegative: false },
    { label: "Meetings booked", val: "11", delta: "+22%", isNegative: false },
  ]);

  const [funnel] = useState([
    { stage: "Leads ingested", count: 286 },
    { stage: "Researched and scored", count: 278 },
    { stage: "Outreach approved", count: 263 },
    { stage: "Prospect replied", count: 34 },
    { stage: "Meeting booked", count: 11 },
  ]);

  const handleDownloadCSV = () => {
    showToast("Generating operational CSV export...");
    setTimeout(() => {
      showToast("CSV export ready: pipeline_performance_nov.csv");
    }, 1000);
  };

  const totalSourced = 286;

  return (
    <div>
      <h1>Performance</h1>
      <p className="sub">
        What happened to the 286 leads sourced this period, and where they dropped out.
      </p>

      {/* 6-Column KPI Grid with alternating .inv */}
      <div className="kpis">
        {kpis.map((k, i) => (
          <div key={k.label} className={`kpi ${i % 2 === 1 ? "inv" : ""}`}>
            <b>{k.val}</b>
            <span>{k.label}</span>
            <em className={k.isNegative ? "neg" : ""}>{k.delta}</em>
          </div>
        ))}
      </div>

      {/* Funnel Section */}
      <div className="fun">
        <h2>Where leads drop out</h2>
        <p className="sub" style={{ marginBottom: "12px" }}>
          3.8% of sourced leads end in a meeting.
        </p>

        {funnel.map((f, i) => {
          const p = (f.count / totalSourced) * 100;
          const next = funnel[i + 1];
          const loss = next ? f.count - next.count : 0;

          return (
            <div key={f.stage}>
              <div className="fr">
                <div>{f.stage}</div>
                <div
                  className={`bar ${i % 2 === 1 ? "out" : ""}`}
                  style={{ width: `${Math.max(p, 8)}%` }}
                >
                  {f.count}{" "}
                  <span style={{ fontWeight: 400, marginLeft: "8px", opacity: 0.8 }}>
                    {p.toFixed(1)}%
                  </span>
                </div>
              </div>

              {next && (
                <div className="fr" style={{ padding: 0 }}>
                  <div></div>
                  <div className="loss">
                    <b>{loss} lost</b> before {next.stage.toLowerCase()}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p style={{ marginTop: "32px" }}>
        <button
          className="btn"
          onClick={handleDownloadCSV}
          type="button"
        >
          Download CSV
        </button>
      </p>
    </div>
  );
}
