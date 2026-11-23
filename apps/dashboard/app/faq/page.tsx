"use client";

export default function FAQPage() {
  const faqs = [
    {
      q: "How is the score worked out?",
      a: "Each lead gets a score out of 100 from five parts: fit (industry and company size), intent (funding and hiring signals), gaps in their current setup, contactability (verified email, LinkedIn), and engagement (a previous email sent). The number comes from fixed rules, with no AI guesswork. 70 and above is Hot, 40 to 69 is Warm, below that is Cool.",
    },
    {
      q: "When does the AI start researching a lead?",
      a: "When someone presses Run AI research on a new lead, or automation (n8n) calls the research step. The AI reads only the firmographics, tech stack, hiring signals and news that Apollo and Clay sent with the lead. If that is too thin to personalise, it says so and no draft is written.",
    },
    {
      q: "Can I change an email before it sends?",
      a: "Yes. Every AI draft waits in Approvals. Edit it, then approve it: only then is it sent, with your agency's postal address and a one-click unsubscribe link added. AEs and admins can approve; ops can't.",
    },
    {
      q: "How does deduplication work?",
      a: "Ingest matches lead emails and company domains case-insensitively. A lead refreshed in the last 90 days is skipped. An older one has its data refreshed, and goes back to the start of the pipeline only if it hasn't been emailed yet.",
    },
    {
      q: "What happens when someone unsubscribes?",
      a: "The lead is marked Do Not Contact straight away, any pending draft is cancelled, and no step (research, drafting or sending) will run for it again, even if it is ingested again later.",
    },
  ];

  return (
    <div>
      <h1>Help</h1>
      <p className="sub">How scoring, research and approvals work.</p>

      {faqs.map((faq, i) => (
        <details
          key={faq.q}
          className={i % 2 === 1 ? "inv" : ""}
          open={i === 0 ? true : undefined}
        >
          <summary>{faq.q}</summary>
          <p>{faq.a}</p>
        </details>
      ))}
    </div>
  );
}
