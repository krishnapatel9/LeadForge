export const SITE = {
  name: "LeadForge",
  legalName: "LeadForge Technologies Inc.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001",
  title: "LeadForge | B2B Lead Intelligence & Outreach Engine",
  description:
    "AI-powered lead intelligence platform that researches, scores ICP fit, and crafts tailored cold outreach sequences for high-growth B2B teams.",
  email: "ops@leadforge.example",
  supportEmail: "support@leadforge.example",
  privacyEmail: "privacy@leadforge.example",
  phone: "+1 (415) 555-0148",
  address: "548 Market St, Suite 39201, San Francisco, CA 94104",
  social: {
    twitter: "https://twitter.com/leadforge_ai",
    linkedin: "https://linkedin.com/company/leadforge-ai",
    github: "https://github.com/krishnapatel9/compliancedocumenttracker",
  },
};

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";
