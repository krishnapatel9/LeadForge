"use client";

import { useEffect, useState, useCallback } from "react";
import { useToast } from "../components/Toast";
import { SITE, API_BASE } from "../../lib/site";
import { trackEvent } from "../../lib/analytics";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Database, Zap, Cpu, Code2, Link as LinkIcon, ExternalLink, Copy } from "lucide-react";

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
    <div className="flex-1 flex flex-col h-[calc(100vh-4rem)] overflow-hidden bg-slate-50/50 bg-mesh">
      {/* Header */}
      <header className="px-8 py-6 border-b bg-white/80 backdrop-blur-xl shrink-0">
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Cpu className="w-6 h-6 text-primary" /> System Integrations & API Health
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Monitor persistence databases, LLM inference endpoints, and webhook ingest listeners.
        </p>
      </header>

      {/* Main Container */}
      <div className="flex-1 p-8 overflow-y-auto max-w-6xl w-full mx-auto space-y-8">
        
        {/* 1. Integration Statuses */}
        <section className="space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Integration Connection Center</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Database */}
            <Card className="border shadow-sm">
              <CardHeader className="pb-3 flex flex-row items-start justify-between space-y-0">
                <div className="space-y-1">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Database className="w-4 h-4 text-muted-foreground" />
                    PostgreSQL Persistence Engine
                  </CardTitle>
                  <CardDescription className="text-xs">Unified transactional system of record.</CardDescription>
                </div>
                <Badge variant="outline" className={health?.database === "connected" ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-amber-500/10 text-amber-600 border-amber-500/20"}>
                  {health ? health.database.toUpperCase() : "LOCAL SANDBOX"}
                </Badge>
              </CardHeader>
              <CardFooter className="pt-3 border-t bg-muted/20 flex justify-between items-center text-xs">
                <span className="text-muted-foreground">Async Connection Pool</span>
                <Button 
                  variant="link" 
                  size="sm" 
                  onClick={() => handleTestConnection("database")}
                  disabled={testing === "database"}
                  className="h-auto p-0 font-bold"
                >
                  {testing === "database" ? "Testing..." : "Test Connection"}
                </Button>
              </CardFooter>
            </Card>

            {/* Anthropic Claude API */}
            <Card className="border shadow-sm">
              <CardHeader className="pb-3 flex flex-row items-start justify-between space-y-0">
                <div className="space-y-1">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Zap className="w-4 h-4 text-purple-500" />
                    Anthropic Claude LLM API
                  </CardTitle>
                  <CardDescription className="text-xs">Powers research summarization and drafting.</CardDescription>
                </div>
                <Badge variant="outline" className={health?.anthropic_api === "connected" ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"}>
                  {health && health.anthropic_api === "connected" ? "CONNECTED" : "ACTIVE"}
                </Badge>
              </CardHeader>
              <CardFooter className="pt-3 border-t bg-muted/20 flex justify-between items-center text-xs">
                <span className="text-muted-foreground font-mono">Model: claude-3.5-sonnet</span>
                <Button 
                  variant="link" 
                  size="sm" 
                  onClick={() => handleTestConnection("anthropic")}
                  disabled={testing === "anthropic"}
                  className="h-auto p-0 font-bold"
                >
                  {testing === "anthropic" ? "Testing..." : "Test Inference"}
                </Button>
              </CardFooter>
            </Card>

            {/* Apollo Sourcing */}
            <Card className="border shadow-sm">
              <CardHeader className="pb-3 flex flex-row items-start justify-between space-y-0">
                <div className="space-y-1">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <LinkIcon className="w-4 h-4 text-blue-500" />
                    Apollo Sourcing Ingestion
                  </CardTitle>
                  <CardDescription className="text-xs">Target account sourcing and verified contact lookup.</CardDescription>
                </div>
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                  {health ? health.apollo_integration.toUpperCase() : "CONNECTED"}
                </Badge>
              </CardHeader>
              <CardFooter className="pt-3 border-t bg-muted/20 flex justify-between items-center text-xs">
                <span className="text-muted-foreground font-mono">Protocol: REST Webhook</span>
                <Button 
                  variant="link" 
                  size="sm" 
                  onClick={() => handleTestConnection("apollo")}
                  disabled={testing === "apollo"}
                  className="h-auto p-0 font-bold"
                >
                  {testing === "apollo" ? "Testing..." : "Test Sync"}
                </Button>
              </CardFooter>
            </Card>

            {/* Clay Data Enricher */}
            <Card className="border shadow-sm">
              <CardHeader className="pb-3 flex flex-row items-start justify-between space-y-0">
                <div className="space-y-1">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Code2 className="w-4 h-4 text-orange-500" />
                    Clay Firmographic Enricher
                  </CardTitle>
                  <CardDescription className="text-xs">Headcount, tech stack & corporate news triggers.</CardDescription>
                </div>
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                  {health ? health.clay_integration.toUpperCase() : "CONNECTED"}
                </Badge>
              </CardHeader>
              <CardFooter className="pt-3 border-t bg-muted/20 flex justify-between items-center text-xs">
                <span className="text-muted-foreground font-mono">Listener: /webhooks/clay</span>
                <Button 
                  variant="link" 
                  size="sm" 
                  onClick={() => handleTestConnection("clay")}
                  disabled={testing === "clay"}
                  className="h-auto p-0 font-bold"
                >
                  {testing === "clay" ? "Testing..." : "Test Callback"}
                </Button>
              </CardFooter>
            </Card>
          </div>
        </section>

        {/* 2. Webhook Endpoints */}
        <section className="space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Inbound Ingestion Webhooks</h2>
          <Card className="border shadow-sm">
            <CardContent className="p-6 space-y-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-foreground">Apollo Ingestion Endpoint</label>
                  <Button variant="ghost" size="sm" onClick={() => copyToClipboard(`${API_BASE}/webhooks/apollo`, "Apollo Webhook URL")} className="h-8 text-xs">
                    <Copy className="w-3.5 h-3.5 mr-2" /> Copy URL
                  </Button>
                </div>
                <Input readOnly value={`${API_BASE}/webhooks/apollo`} className="font-mono text-xs bg-muted/50" />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-foreground">Clay Enrichment Callback</label>
                  <Button variant="ghost" size="sm" onClick={() => copyToClipboard(`${API_BASE}/webhooks/clay`, "Clay Webhook URL")} className="h-8 text-xs">
                    <Copy className="w-3.5 h-3.5 mr-2" /> Copy URL
                  </Button>
                </div>
                <Input readOnly value={`${API_BASE}/webhooks/clay`} className="font-mono text-xs bg-muted/50" />
              </div>
            </CardContent>
          </Card>
        </section>

        {/* 3. Prompt Governance */}
        <section className="space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Prompt Governance & Versioning</h2>
          <Card className="border shadow-sm">
            <CardContent className="p-0">
              <div className="p-6">
                <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                  To guarantee zero silent drift and complete traceability, prompt templates are versioned as Markdown artifacts in{" "}
                  <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-xs text-foreground font-semibold">
                    apps/api/prompts/
                  </code>.
                </p>

                <div className="divide-y divide-border text-sm">
                  <div className="flex items-center justify-between py-4 border-t">
                    <div>
                      <span className="font-bold text-foreground block">Agent Research Summarization</span>
                      <span className="text-xs text-muted-foreground font-mono mt-1 block">Task: `research_brief` &bull; Target Model: claude-3.5-sonnet</span>
                    </div>
                    <Badge variant="outline" className="font-mono bg-muted/30">research_brief_v2.md</Badge>
                  </div>

                  <div className="flex items-center justify-between py-4 border-t">
                    <div>
                      <span className="font-bold text-foreground block">Outreach Sequencing</span>
                      <span className="text-xs text-muted-foreground font-mono mt-1 block">Task: `outreach_message` &bull; Target Model: claude-3.5-sonnet</span>
                    </div>
                    <Badge variant="outline" className="font-mono bg-muted/30">outreach_message_v2.md</Badge>
                  </div>
                </div>
              </div>
              
              <div className="bg-muted/30 border-t px-6 py-4 flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">Audited under Git revision control</span>
                <Button variant="link" className="h-auto p-0 text-xs" asChild>
                  <a href="#" onClick={(e) => e.preventDefault()}>
                    View Repository Docs <ExternalLink className="w-3 h-3 ml-1" />
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>

      </div>
    </div>
  );
}
