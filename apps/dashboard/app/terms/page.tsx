"use client";

export default function TermsPage() {
  return (
    <div>
      <h1>Terms of Service</h1>
      <p className="sub">Last updated: October 2026</p>

      <div style={{ maxWidth: "720px", display: "flex", flexDirection: "column", gap: "24px" }}>
        <section style={{ borderTop: "1px solid var(--line)", paddingTop: "16px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 700, margin: "0 0 8px" }}>1. Acceptance of Terms</h2>
          <p style={{ color: "var(--mute)", lineHeight: 1.6, margin: 0 }}>
            By accessing and using the LeadForge platform, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the system.
          </p>
        </section>

        <section style={{ borderTop: "1px solid var(--line)", paddingTop: "16px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 700, margin: "0 0 8px" }}>2. Acceptable B2B Use</h2>
          <p style={{ color: "var(--mute)", lineHeight: 1.6, margin: 0 }}>
            You agree to use LeadForge only for authorized B2B commercial outreach. You are responsible for ensuring that all outbound cadences comply with CAN-SPAM, CASL, and relevant electronic communications regulations.
          </p>
        </section>

        <section style={{ borderTop: "1px solid var(--line)", paddingTop: "16px", borderBottom: "1px solid var(--line)", paddingBottom: "16px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 700, margin: "0 0 8px" }}>3. Human-in-the-Loop Safeguards</h2>
          <p style={{ color: "var(--mute)", lineHeight: 1.6, margin: 0 }}>
            The system drafts outreach via generative AI models. An authorized team member reviews and authorizes outgoing messages. LeadForge disclaims liability for unauthorized manual modifications.
          </p>
        </section>
      </div>
    </div>
  );
}
