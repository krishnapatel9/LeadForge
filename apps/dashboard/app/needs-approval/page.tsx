"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useToast } from "../components/Toast";
import { trackEvent } from "../../lib/analytics";
import { CheckCircle2, XCircle, Keyboard, Mail, Building2, User } from "lucide-react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Skeleton } from "../components/ui/skeleton";
import { cn } from "../../lib/utils";

interface LeadDraft {
  id: string;
  full_name: string;
  title: string;
  company_name: string;
  tier: string;
  total_score: number;
  outreach_id: string;
  subject: string;
  body: string;
}

export default function NeedsApprovalPage() {
  const [drafts, setDrafts] = useState<LeadDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [saving, setSaving] = useState(false);

  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");

  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const { showToast } = useToast();

  const fetchDrafts = useCallback(async () => {
    try {
      const res = await fetch("http://localhost:8000/leads");
      if (res.ok) {
        const leads = await res.json();
        const draftedLeads = leads.filter(
          (l: any) => l.stage === "outreach_drafted"
        );

        const fullDrafts = await Promise.all(
          draftedLeads.map(async (l: any) => {
            try {
              const detRes = await fetch(`http://localhost:8000/leads/${l.id}`);
              if (detRes.ok) {
                const det = await detRes.json();
                const activeMsg = det.outreach?.find((m: any) => m.status === "draft");
                return {
                  id: l.id,
                  full_name: l.full_name,
                  title: l.title,
                  company_name: l.company_name,
                  tier: l.tier ?? "warm",
                  total_score: l.total_score ?? 0,
                  outreach_id: activeMsg?.id ?? "",
                  subject: activeMsg?.subject ?? "(No Subject)",
                  body: activeMsg?.body ?? "(No Body)",
                };
              }
            } catch (err) {
              // Ignore single lead fetch error
            }
            return null;
          })
        );

        const validDrafts = fullDrafts.filter(Boolean) as LeadDraft[];
        setDrafts(validDrafts);

        if (validDrafts.length > 0) {
          setSelectedIndex((prev) => Math.min(prev, validDrafts.length - 1));
        }
      }
    } catch (err) {
      console.debug("Backend unreachable or mock mode:", err);
      // Fallback for UI visualization purposes
      const validDrafts = [
        {
          id: "1",
          full_name: "Marcus Cole",
          title: "Head of Growth",
          company_name: "Globex",
          tier: "hot",
          total_score: 85,
          outreach_id: "draft-1",
          subject: "Scaling growth at Globex",
          body: "Hi Marcus,\n\nNoticed Globex is expanding rapidly. We automate outbound sequencing to help growth leaders like you scale without adding headcount.\n\nWorth a brief chat?"
        }
      ];
      setDrafts(validDrafts);
      setSelectedIndex(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDrafts();
  }, [fetchDrafts]);

  useEffect(() => {
    if (drafts.length > 0 && drafts[selectedIndex]) {
      setEditSubject(drafts[selectedIndex].subject);
      setEditBody(drafts[selectedIndex].body);
    } else {
      setEditSubject("");
      setEditBody("");
    }
  }, [selectedIndex, drafts]);

  const handleApprove = useCallback(async (indexToApprove: number) => {
    if (drafts.length === 0) return;
    const target = drafts[indexToApprove];
    setSaving(true);
    try {
      const res = await fetch(
        `http://localhost:8000/leads/${target.id}/outreach/approve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subject: editSubject, body: editBody }),
        }
      );
      if (res.ok) {
        showToast(
          `Approved outreach draft for ${target.full_name}`,
          "success",
          "Draft Enqueued"
        );
        trackEvent("lead_approved", { leadId: target.id });
        const remaining = drafts.filter((_, idx) => idx !== indexToApprove);
        setDrafts(remaining);
        if (remaining.length > 0) {
          setSelectedIndex((prev) => Math.min(prev, remaining.length - 1));
        }
      } else {
        showToast("Approval failed on server", "error");
      }
    } catch (err) {
      showToast("Network error approving draft", "error");
    } finally {
      setSaving(false);
    }
  }, [drafts, editSubject, editBody, showToast]);

  const handleReject = useCallback(async (indexToReject: number) => {
    if (drafts.length === 0) return;
    const target = drafts[indexToReject];
    setSaving(true);
    try {
      const res = await fetch(
        `http://localhost:8000/leads/${target.id}/outreach/reject`,
        { method: "POST" }
      );
      if (res.ok) {
        showToast(
          `Rejected draft for ${target.full_name}`,
          "warning",
          "Draft Discarded"
        );
        trackEvent("lead_rejected", { leadId: target.id });
        const remaining = drafts.filter((_, idx) => idx !== indexToReject);
        setDrafts(remaining);
        if (remaining.length > 0) {
          setSelectedIndex((prev) => Math.min(prev, remaining.length - 1));
        }
      }
    } catch (err) {
      showToast("Error rejecting outreach draft", "error");
    } finally {
      setSaving(false);
    }
  }, [drafts, showToast]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }

      if (drafts.length === 0) return;

      switch (e.key.toLowerCase()) {
        case "j":
        case "arrowdown":
          setSelectedIndex((prev) => Math.min(prev + 1, drafts.length - 1));
          e.preventDefault();
          break;
        case "k":
        case "arrowup":
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          e.preventDefault();
          break;
        case "a":
          handleApprove(selectedIndex);
          break;
        case "r":
          handleReject(selectedIndex);
          break;
        case "e":
          e.preventDefault();
          setTimeout(() => bodyRef.current?.focus(), 50);
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedIndex, drafts, handleApprove, handleReject]);

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-4rem)] overflow-hidden bg-slate-50/50 bg-mesh">
      {/* Header */}
      <header className="px-8 py-6 border-b border-slate-100 bg-white/80 backdrop-blur-xl shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold tracking-tight">Approval Queue</h1>
            <Badge variant="secondary" className="text-xs">
              {drafts.length} Awaiting
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Review and adjust AI-generated emails before dispatch.
          </p>
        </div>

        {/* Keyboard shortcut legend */}
        <div className="hidden xl:flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 px-4 py-2 rounded-lg border">
          <Keyboard className="w-4 h-4 mr-2" />
          <kbd className="px-1.5 py-0.5 bg-background border rounded font-mono text-[10px] font-bold shadow-sm">J/K</kbd> <span className="mr-2">Nav</span>
          <kbd className="px-1.5 py-0.5 bg-background border rounded font-mono text-[10px] font-bold shadow-sm">A</kbd> <span className="mr-2">Approve</span>
          <kbd className="px-1.5 py-0.5 bg-background border rounded font-mono text-[10px] font-bold shadow-sm">R</kbd> <span className="mr-2">Reject</span>
          <kbd className="px-1.5 py-0.5 bg-background border rounded font-mono text-[10px] font-bold shadow-sm">E</kbd> <span>Edit</span>
        </div>
      </header>

      {/* Main Splitscreen View */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left Side: Draft list */}
        <div className="w-full lg:w-[400px] border-r overflow-y-auto p-4 custom-scrollbar bg-muted/10">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-card rounded-xl border p-4">
                  <Skeleton className="h-4 w-1/3 mb-2" />
                  <Skeleton className="h-3 w-1/2 mb-4" />
                  <Skeleton className="h-3 w-full" />
                </div>
              ))}
            </div>
          ) : drafts.length === 0 ? (
            <div className="bg-background border rounded-xl p-8 text-center flex flex-col items-center justify-center mt-10">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-4">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-foreground">Inbox Zero</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-[200px] mx-auto">
                All drafted outreach emails have been reviewed.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {drafts.map((d, index) => {
                const isSelected = index === selectedIndex;
                return (
                  <div
                    key={d.id}
                    onClick={() => setSelectedIndex(index)}
                    className={cn(
                      "rounded-xl p-4 cursor-pointer transition-all border text-left",
                      isSelected
                        ? "bg-primary border-primary text-primary-foreground shadow-md ring-2 ring-primary ring-offset-2 ring-offset-background"
                        : "bg-card border-border hover:border-border/80 text-foreground"
                    )}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className={cn(
                        "text-[10px] font-bold uppercase tracking-wider truncate pr-2",
                        isSelected ? "text-primary-foreground/80" : "text-muted-foreground"
                      )}>
                        {d.company_name}
                      </span>
                      <span className={cn(
                        "text-[9px] font-black uppercase px-1.5 py-0.5 rounded-sm",
                        isSelected
                          ? "bg-primary-foreground/20 text-primary-foreground"
                          : d.tier === "hot"
                          ? "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
                          : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                      )}>
                        {d.tier} ({d.total_score})
                      </span>
                    </div>

                    <h3 className="font-bold text-sm tracking-tight leading-tight">{d.full_name}</h3>
                    <p className={cn("text-xs truncate mt-0.5", isSelected ? "text-primary-foreground/90" : "text-muted-foreground")}>
                      {d.title}
                    </p>

                    <div className={cn(
                      "text-xs border-t mt-3 pt-2 font-medium truncate",
                      isSelected ? "border-primary-foreground/20 text-primary-foreground/90" : "border-border text-muted-foreground"
                    )}>
                      {d.subject}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Side: Active Draft Editor view */}
        <div className="flex-1 bg-background overflow-y-auto p-6 sm:p-8 flex flex-col justify-between">
          {drafts.length > 0 && drafts[selectedIndex] ? (
            <div className="max-w-3xl w-full mx-auto space-y-6">
              <div className="pb-6 border-b">
                <span className="text-[10px] font-bold text-primary block uppercase tracking-widest mb-2 flex items-center gap-1">
                  <User className="w-3 h-3" /> Drafting Target
                </span>
                <h2 className="text-2xl font-bold tracking-tight text-foreground">{drafts[selectedIndex].full_name}</h2>
                <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                  <span>{drafts[selectedIndex].title}</span>
                  <span>&bull;</span>
                  <span className="flex items-center gap-1 font-medium text-foreground">
                    <Building2 className="w-3.5 h-3.5" />
                    {drafts[selectedIndex].company_name}
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-2">
                    <Mail className="w-3.5 h-3.5" /> Subject
                  </label>
                  <Input
                    value={editSubject}
                    onChange={(e) => setEditSubject(e.target.value)}
                    className="font-medium bg-muted/30"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-2">
                    Message Body
                  </label>
                  <textarea
                    ref={bodyRef}
                    rows={12}
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                    className="w-full text-sm border rounded-md p-4 bg-muted/30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-sans leading-relaxed resize-y"
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                  <Button
                    onClick={() => handleApprove(selectedIndex)}
                    disabled={saving}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    {saving ? "Authorizing..." : "Approve & Enqueue"}
                  </Button>
                  <Button
                    onClick={() => handleReject(selectedIndex)}
                    disabled={saving}
                    variant="destructive"
                    className="flex-1 sm:flex-none px-6"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Discard Draft
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
              Select an awaiting draft from the queue
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
