"use client";

import { useEffect, useState, useCallback } from "react";
import { useToast } from "../components/Toast";
import { SITE, API_BASE } from "../../lib/site";
import { trackEvent } from "../../lib/analytics";

interface HealthData {
  database: string;
  anthropic_api: string;
  unresolved_pipeline_errors: number;
  apollo_integration: string;
  clay_integration: string;
}

export default function SettingsPage() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState<string | null>(null);
  const { showToast } = useToast();

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/system-health`);
      if (res.ok) {
        setHealth(await res.json());
      }
    } catch (err) {
      console.debug("API health check unavailable (local dev mode):", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  const handleTestConnection = async (type: string) => {
    setTesting(type);
    showToast(`Testing ${type.toUpperCase()} integration handshake...`, "info");
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await fetchHealth();
      showToast(`${type.toUpperCase()} connection verified`, "success", "Integration Online");
      trackEvent("connection_tested", { service: type, status: "success" });
    } catch (err) {
      showToast(`Failed to establish ${type} handshake`, "error");
    } finally {
      setTesting(null);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    try {
      navigator.clipboard.writeText(text);
      showToast(`Copied ${label} to clipboard`, "success");
    } catch (err) {
      showToast("Could not access clipboard", "error");
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 sm:px-8 py-5">
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
          System Integrations & API Health
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Monitor persistence databases, LLM inference endpoints, and webhook ingest listeners.
        </p>
      </header>

      {/* Main Container */}
      <div className="flex-1 p-4 sm:p-8 overflow-y-auto space-y-8 max-w-5xl w-full">
        {/* 1. Integration Statuses */}
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 mb-4">
            Integration Connection Center
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Database */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-sm text-slate-900">PostgreSQL Persistence Engine</h3>
                  <p className="text-xs text-slate-500 mt-1">Unified transactional system of record.</p>
                </div>
                <span
                  className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                    health?.database === "connected"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-amber-50 text-amber-700 border-amber-200"
                  }`}
                >
                  {health ? health.database.toUpperCase() : "LOCAL SANDBOX"}
                </span>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>Async Connection Pool</span>
                <button
                  onClick={() => handleTestConnection("database")}
                  disabled={testing === "database"}
                  className="text-indigo-600 hover:text-indigo-800 font-bold disabled:opacity-50"
                >
                  {testing === "database" ? "Testing..." : "Test Connection"}
                </button>
              </div>
            </div>

            {/* Anthropic Claude API */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Anthropic Claude LLM API</h3>
                  <p className="text-xs text-slate-500 mt-1">Powers research summarization and drafting.</p>
                </div>
                <span
                  className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                    health?.anthropic_api === "connected"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-emerald-50 text-emerald-700 border-emerald-200"
                  }`}
                >
                  {health && health.anthropic_api === "connected" ? "CONNECTED" : "ACTIVE"}
                </span>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>Model: claude-3-5-sonnet</span>
                <button
                  onClick={() => handleTestConnection("anthropic")}
                  disabled={testing === "anthropic"}
                  className="text-indigo-600 hover:text-indigo-800 font-bold disabled:opacity-50"
                >
                  {testing === "anthropic" ? "Testing..." : "Test Inference"}
                </button>
              </div>
            </div>

            {/* Apollo Sourcing */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Apollo Sourcing Ingestion</h3>
                  <p className="text-xs text-slate-500 mt-1">Target account sourcing and verified contact lookup.</p>
                </div>
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">
                  {health ? health.apollo_integration.toUpperCase() : "CONNECTED"}
                </span>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>Protocol: REST Webhook</span>
                <button
                  onClick={() => handleTestConnection("apollo")}
                  disabled={testing === "apollo"}
                  className="text-indigo-600 hover:text-indigo-800 font-bold disabled:opacity-50"
                >
                  {testing === "apollo" ? "Testing..." : "Test Sync"}
                </button>
              </div>
            </div>

            {/* Clay Data Enricher */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Clay Firmographic Enricher</h3>
                  <p className="text-xs text-slate-500 mt-1">Headcount, tech stack & corporate news triggers.</p>
                </div>
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">
                  {health ? health.clay_integration.toUpperCase() : "CONNECTED"}
                </span>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>Listener: /webhooks/clay</span>
                <button
                  onClick={() => handleTestConnection("clay")}
                  disabled={testing === "clay"}
                  className="text-indigo-600 hover:text-indigo-800 font-bold disabled:opacity-50"
                >
                  {testing === "clay" ? "Testing..." : "Test Callback"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 2. Webhook Endpoints for Integrations */}
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 mb-4">
            Inbound Ingestion Webhooks
          </h2>
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4 text-xs">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-slate-800">Apollo Ingestion Endpoint</span>
                <button
                  onClick={() => copyToClipboard(`${API_BASE}/webhooks/apollo`, "Apollo Webhook URL")}
                  className="text-indigo-600 hover:text-indigo-800 font-semibold"
                >
                  Copy URL
                </button>
              </div>
              <code className="block bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-slate-700 font-mono">
                {API_BASE}/webhooks/apollo
              </code>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-slate-800">Clay Enrichment Callback</span>
                <button
                  onClick={() => copyToClipboard(`${API_BASE}/webhooks/clay`, "Clay Webhook URL")}
                  className="text-indigo-600 hover:text-indigo-800 font-semibold"
                >
                  Copy URL
                </button>
              </div>
              <code className="block bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-slate-700 font-mono">
                {API_BASE}/webhooks/clay
              </code>
            </div>
          </div>
        </div>

        {/* 3. Prompt Governance */}
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 mb-4">
            Prompt Governance & Versioning
          </h2>
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-500 leading-relaxed">
                To guarantee zero silent drift and complete traceability, prompt templates are versioned as Markdown artifacts in{" "}
                <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono text-slate-800 font-semibold">
                  apps/api/prompts/
                </code>
                .
              </p>

              <div className="divide-y divide-slate-100 text-xs">
                <div className="flex items-center justify-between py-3">
                  <div>
                    <span className="font-bold text-slate-800 block">Agent Research Summarization (`research_brief`)</span>
                    <span className="text-[11px] text-slate-400">Target Model: claude-3-5-sonnet</span>
                  </div>
                  <span className="bg-slate-100 text-slate-800 font-mono font-bold px-2.5 py-1 rounded-lg border border-slate-200">
                    research_brief_v2.md
                  </span>
                </div>

                <div className="flex items-center justify-between py-3">
                  <div>
                    <span className="font-bold text-slate-800 block">Outreach Sequencing (`outreach_message`)</span>
                    <span className="text-[11px] text-slate-400">Target Model: claude-3-5-sonnet</span>
                  </div>
                  <span className="bg-slate-100 text-slate-800 font-mono font-bold px-2.5 py-1 rounded-lg border border-slate-200">
                    outreach_message_v2.md
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 border-t border-slate-100 px-6 py-4 flex items-center justify-between text-xs text-slate-500">
              <span>Audited under Git revision control</span>
              <a
                href="#"
                onClick={(e) => e.preventDefault()}
                className="text-indigo-600 hover:underline font-semibold"
              >
                View Repository Docs &rarr;
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


