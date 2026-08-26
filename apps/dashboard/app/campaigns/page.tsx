"use client";

import { useState } from "react";
import { useToast } from "../components/Toast";
import { trackEvent } from "../../lib/analytics";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Plus, Target, Play, Pause, X } from "lucide-react";

interface Campaign {
  id: string;
  name: string;
  industry: string;
  company_sizes: string;
  active: boolean;
  leads_sourced: number;
  avg_score: number;
  conversion_rate: string;
}

export default function CampaignsPage() {
  const { showToast } = useToast();
  const [showModal, setShowModal] = useState(false);

  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("saas");
  const [size, setSize] = useState("50-200 employees");

  const [campaigns, setCampaigns] = useState<Campaign[]>([
    {
      id: "1",
      name: "SaaS Series A Founders - US",
      industry: "saas",
      company_sizes: "50-200 employees",
      active: true,
      leads_sourced: 142,
      avg_score: 78,
      conversion_rate: "4.2%",
    },
    {
      id: "2",
      name: "E-Commerce Marketing Directors - EU",
      industry: "e-commerce",
      company_sizes: "10-100 employees",
      active: false,
      leads_sourced: 89,
      avg_score: 62,
      conversion_rate: "2.1%",
    },
    {
      id: "3",
      name: "FinTech Executives - Global",
      industry: "fintech",
      company_sizes: "100-500 employees",
      active: true,
      leads_sourced: 55,
      avg_score: 85,
      conversion_rate: "5.8%",
    },
  ]);

  const toggleCampaign = (id: string) => {
    setCampaigns((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          const nextState = !c.active;
          showToast(
            `Campaign "${c.name}" ${nextState ? "activated" : "paused"}`,
            nextState ? "success" : "info"
          );
          trackEvent("campaign_toggled", { campaignId: id, active: nextState });
          return { ...c, active: nextState };
        }
        return c;
      })
    );
  };

  const handleCreateCampaign = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast("Please enter a valid campaign name", "error");
      return;
    }

    const newCamp: Campaign = {
      id: Date.now().toString(),
      name: name.trim(),
      industry,
      company_sizes: size,
      active: true,
      leads_sourced: 0,
      avg_score: 80,
      conversion_rate: "0.0%",
    };

    setCampaigns((prev) => [newCamp, ...prev]);
    showToast(`Created sourcing campaign "${name}"`, "success", "Campaign Created");
    trackEvent("campaign_created", { name, industry });
    setName("");
    setShowModal(false);
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-4rem)] overflow-hidden bg-slate-50/50 bg-mesh">
      {/* Header */}
      <header className="px-8 py-6 border-b bg-white/80 backdrop-blur-xl shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Target className="w-6 h-6 text-primary" /> Campaign ICPs
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Configure automated sourcing rules via Apollo and Clay integrations.
            </p>
          </div>

          <Button onClick={() => setShowModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create Campaign
          </Button>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 p-8 overflow-y-auto max-w-7xl mx-auto w-full">
        <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-muted/50 border-b text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  <th className="px-6 py-4">Campaign Details</th>
                  <th className="px-6 py-4 text-center">Leads Sourced</th>
                  <th className="px-6 py-4 text-center">Avg ICP Score</th>
                  <th className="px-6 py-4 text-center">Conversion</th>
                  <th className="px-6 py-4 text-center">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y text-sm">
                {campaigns.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-foreground mb-1">{c.name}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2">
                        <span className="capitalize">{c.industry}</span>
                        <span className="w-1 h-1 bg-border rounded-full" />
                        <span>{c.company_sizes}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center font-medium text-foreground">{c.leads_sourced}</td>
                    <td className="px-6 py-4 text-center font-bold text-primary">{c.avg_score}/100</td>
                    <td className="px-6 py-4 text-center font-medium text-emerald-600 dark:text-emerald-500">{c.conversion_rate}</td>
                    <td className="px-6 py-4 text-center">
                      <Badge variant={c.active ? "default" : "secondary"} className={c.active ? "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border-transparent shadow-none" : ""}>
                        {c.active ? "Active" : "Paused"}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => toggleCampaign(c.id)}
                        className={c.active ? "text-amber-500 hover:text-amber-600 hover:bg-amber-500/10" : "text-emerald-500 hover:text-emerald-600 hover:bg-emerald-500/10"}
                      >
                        {c.active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          
          <div className="bg-card rounded-2xl max-w-md w-full shadow-2xl border flex flex-col z-10 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b">
              <h3 className="text-lg font-bold text-foreground">Configure New Campaign</h3>
              <Button variant="ghost" size="icon" onClick={() => setShowModal(false)} className="-mr-2">
                <X className="w-4 h-4" />
              </Button>
            </div>

            <form onSubmit={handleCreateCampaign} className="p-6 space-y-5">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Campaign Name</label>
                  <Input
                    placeholder="e.g. Series B DevOps Directors"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Target Vertical</label>
                  <select
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="saas">B2B SaaS</option>
                    <option value="e-commerce">E-Commerce & Retail</option>
                    <option value="fintech">FinTech & Banking</option>
                    <option value="healthcare">Healthcare & MedTech</option>
                    <option value="logistics">Logistics & Supply Chain</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Company Size Focus</label>
                  <select
                    value={size}
                    onChange={(e) => setSize(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="10-50 employees">Seed (10-50 employees)</option>
                    <option value="50-200 employees">Growth (50-200 employees)</option>
                    <option value="200-1000 employees">Mid-Market (200-1,000 employees)</option>
                    <option value="1000+ employees">Enterprise (1,000+ employees)</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="flex-1">
                  Launch Campaign
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
