"use client";

import { useState } from "react";
import { useToast } from "../components/Toast";
import { trackEvent } from "../../lib/analytics";

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

  // Form states
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
    <div className="flex-1 flex flex-col min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 sm:px-8 py-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Campaign ICP Manager
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Configure Apollo and Clay sourcing filters to feed prospects directly into the ingestion pipeline.
            </p>
          </div>

          <button
            onClick={() => setShowModal(true)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-2.5 rounded-lg shadow-sm transition-colors shrink-0"
          >
            + Create Sourcing ICP
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 p-4 sm:p-8 overflow-y-auto space-y-6 max-w-6xl w-full">
        {/* Table Container */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[650px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  <th className="px-6 py-4">Campaign Name</th>
                  <th className="px-6 py-4">Target ICP Definition</th>
                  <th className="px-6 py-4 text-center">Leads Sourced</th>
                  <th className="px-6 py-4 text-center">Avg ICP Score</th>
                  <th className="px-6 py-4 text-center">Conversion</th>
                  <th className="px-6 py-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {campaigns.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-900">{c.name}</td>
                    <td className="px-6 py-4 text-slate-500">
                      <span className="capitalize font-semibold text-slate-700">{c.industry}</span> &bull; {c.company_sizes}
                    </td>
                    <td className="px-6 py-4 text-center font-semibold text-slate-900">{c.leads_sourced}</td>
                    <td className="px-6 py-4 text-center font-bold text-indigo-600">{c.avg_score}/100</td>
                    <td className="px-6 py-4 text-center font-semibold text-emerald-600">{c.conversion_rate}</td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => toggleCampaign(c.id)}
                        className={`px-3 py-1 rounded-full text-[10px] font-bold border transition-colors ${
                          c.active
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                            : "bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200"
                        }`}
                      >
                        {c.active ? "ACTIVE" : "PAUSED"}
                      </button>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-base font-bold text-slate-900">Define New Sourcing ICP</h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateCampaign} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Campaign Name</label>
                <input
                  type="text"
                  placeholder="e.g. Series B DevOps Directors"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Industry Vertical</label>
                <select
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  <option value="saas">B2B SaaS</option>
                  <option value="e-commerce">E-Commerce & Retail</option>
                  <option value="fintech">FinTech & Banking</option>
                  <option value="healthcare">Healthcare & MedTech</option>
                  <option value="logistics">Logistics & Supply Chain</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Target Headcount Range</label>
                <select
                  value={size}
                  onChange={(e) => setSize(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  <option value="10-50 employees">Seed (10-50 employees)</option>
                  <option value="50-200 employees">Growth (50-200 employees)</option>
                  <option value="200-1000 employees">Mid-Market (200-1,000 employees)</option>
                  <option value="1000+ employees">Enterprise (1,000+ employees)</option>
                </select>
              </div>

              <div className="flex gap-2.5 pt-3">
                <button
                  type="submit"
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 rounded-lg transition-colors"
                >
                  Save & Launch Ingestion
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

