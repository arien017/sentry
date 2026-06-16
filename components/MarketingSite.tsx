"use client";

import { useState } from "react";

/* ──────────────────────────────────────────────────────────────
   Types
   ────────────────────────────────────────────────────────────── */
type Materiality = "high" | "elevated" | "routine";

interface Citation {
  id: string;
  url: string;
  anchors?: string[];
}

interface Briefing {
  regulator: string;
  materiality: Materiality;
  score: number;
  timestamp: string;
  title: string;
  summary: string;
  interpretation?: string;
  citation: Citation;
}

interface Plan {
  id: string;
  name: string;
  pitch: string;
  priceMonthly: number;
  badge: string | null;
  features: string[];
  cta: string;
}

/* ──────────────────────────────────────────────────────────────
   Atoms
   ────────────────────────────────────────────────────────────── */
function Wordmark({ size = 18 }: { size?: number }) {
  return (
    <span
      style={{
        fontFamily: "var(--display-font)",
        fontWeight: 500,
        fontSize: size,
        letterSpacing: "-0.02em",
        color: "var(--ink)",
      }}
    >
      Sentry
    </span>
  );
}

function matColor(m: Materiality) {
  return { high: "var(--mat-high)", elevated: "var(--mat-elevated)", routine: "var(--mat-routine)" }[m];
}

function TagRow({ b }: { b: Briefing }) {
  return (
    <div style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
      <span className={`mat-dot ${b.materiality}`} style={{ marginRight: 10 }} />
      <span className="t-caption-emph">{b.regulator}</span>
      <span className="t-caption-emph" style={{ color: "var(--ink-faint)", padding: "0 8px" }}>
        ·
      </span>
      <span className="t-caption-emph">{b.timestamp}</span>
      <span className="t-caption-emph" style={{ marginLeft: "auto", color: matColor(b.materiality) }}>
        {b.materiality}
        {b.score > 0 && <span style={{ color: "var(--ink-faint)" }}>{" · "}{b.score}</span>}
      </span>
    </div>
  );
}

function Interpretation({ text }: { text?: string }) {
  if (!text) return null;
  return (
    <div className="interp">
      <span className="interp-label">What this means for your firm</span>
      <span className="t-body" style={{ color: "var(--ink)" }}>
        {text}
      </span>
    </div>
  );
}

function CitationBlock({ c }: { c?: Citation }) {
  if (!c) return null;
  return (
    <div className="citation">
      <div style={{ marginBottom: 4 }}>{c.id}</div>
      <div>
        <a href={`https://${c.url}`} onClick={(e) => e.preventDefault()}>
          {c.url}
        </a>
      </div>
      {c.anchors && c.anchors.length > 0 && <div style={{ marginTop: 4 }}>{c.anchors.join(" · ")}</div>}
    </div>
  );
}

function DigestItem({ b }: { b: Briefing }) {
  const showInterp = (b.materiality === "high" || b.materiality === "elevated") && b.interpretation;
  return (
    <article>
      <TagRow b={b} />
      <h2 className="t-heading" style={{ margin: "0 0 10px" }}>
        {b.title}
      </h2>
      <p className={b.materiality === "high" ? "t-body-emph" : "t-body"} style={{ margin: 0 }}>
        {b.summary}
      </p>
      {showInterp && <Interpretation text={b.interpretation} />}
      <CitationBlock c={b.citation} />
    </article>
  );
}

/* ──────────────────────────────────────────────────────────────
   Data
   ────────────────────────────────────────────────────────────── */
const sampleItem: Briefing = {
  regulator: "ASIC",
  materiality: "high",
  score: 84,
  timestamp: "05:47 AEST",
  title: "INFO 271 amended. Reportable situations regime tightened on 30-day clock.",
  summary:
    "ASIC published an amended INFO 271 today, clarifying the start of the 30-day reporting clock for reportable situations under s912DAA of the Corporations Act. The amendment narrows the previous \u201Creasonable grounds to believe\u201D test and adds three worked examples covering AFSL holders advising retail clients.",
  interpretation:
    "Two clients on Halverson's books (a mid-tier ADI and an AFS licensee advising on managed funds) currently rely on the previous wording of INFO 271 for their breach reporting policies. Those policies should be reviewed against the new examples this week. The Financial Services Regulation group should circulate a client alert by EOD Friday.",
  citation: {
    id: "ASIC INFO 271 (amended 15 May 2026)",
    url: "asic.gov.au/regulatory-resources/find-a-document/information-sheets/info-271",
    anchors: ["\u00A73.2 — Start of reporting clock", "\u00A74.1 — Example 1 (AFSL retail advice)", "\u00A74.3 — Example 3 (managed funds)"],
  },
};

const PRICING_PLANS: Plan[] = [
  {
    id: "essentials",
    name: "Essentials",
    pitch: "Regulatory and compliance coverage for teams that just need the morning briefing.",
    priceMonthly: 250,
    badge: null,
    features: [
      "Six Australian regulators",
      "Daily briefing at 07:00 AEST",
      "Real-time alerts (3 / day cap)",
      "Agentic home with full provenance",
      "Archive search & PDF export",
      "Five seats included",
      "Email support · 48-hr response",
    ],
    cta: "Start free trial",
  },
  {
    id: "standard",
    name: "Standard",
    pitch: "Everything in Essentials, plus the political and parliamentary surface.",
    priceMonthly: 500,
    badge: "Most popular",
    features: [
      "Everything in Essentials",
      "Political & parliamentary coverage",
      "Bills, committees, Hansard, submissions",
      "Tracker — forward horizon view",
      "Slack & Teams forwarding",
      "SSO (SAML / OIDC)",
      "Email support · 24-hr response",
    ],
    cta: "Start free trial",
  },
  {
    id: "government",
    name: "Government",
    pitch: "For firms whose strategy depends on reading the political landscape.",
    priceMonthly: 750,
    badge: null,
    features: [
      "Everything in Standard",
      "Monthly political landscape briefing",
      "Analyst-authored long-form report",
      "Custom regulator & subject watches",
      "Audit log export & retention controls",
      "Priority support · 4-hr response",
      "Named customer engineer",
    ],
    cta: "Start free trial",
  },
];

/* ──────────────────────────────────────────────────────────────
   Pricing card
   ────────────────────────────────────────────────────────────── */
function PricingCard({ plan, billing, featured }: { plan: Plan; billing: "monthly" | "annual"; featured: boolean }) {
  const annualMonthly = Math.round(plan.priceMonthly * 0.9);
  const price = billing === "annual" ? annualMonthly : plan.priceMonthly;
  const annualSaved = (plan.priceMonthly - annualMonthly) * 12;

  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [firmName, setFirmName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCheckout = async () => {
    if (!email.trim() || !firmName.trim()) {
      setError("Email and firm name are required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    // NOTE: route requires "yearly", not "annual"
    const interval = billing === "annual" ? "yearly" : "monthly";
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile: {}, // STUB profile — onboarding chat will supply the real one later
          email: email.trim(),
          firmName: firmName.trim(),
          tier: plan.id, // already lowercase essentials|standard|government
          interval,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error || "Checkout failed. Please try again.");
        setSubmitting(false);
        return;
      }
      const { url } = (await res.json()) as { url: string };
      window.location.href = url;
    } catch {
      setError("Checkout failed. Please try again.");
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        background: "var(--ground-raised)",
        border: featured ? "1.5px solid var(--signal)" : "1px solid var(--hairline-strong)",
        padding: 32,
        position: "relative",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {plan.badge && (
        <div
          style={{
            position: "absolute",
            top: -1,
            right: 24,
            background: "var(--signal)",
            color: "#fff",
            padding: "4px 10px",
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          {plan.badge}
        </div>
      )}

      <h3 className="t-title" style={{ margin: "0 0 8px", fontSize: 22 }}>
        {plan.name}
      </h3>
      <p className="t-caption" style={{ margin: "0 0 24px", color: "var(--ink-mute)", minHeight: 40 }}>
        {plan.pitch}
      </p>

      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 4 }}>
        <span style={{ fontFamily: "var(--display-font)", fontWeight: 500, fontSize: 40, letterSpacing: "-0.04em", lineHeight: 1 }}>
          A${price}
        </span>
        <span className="t-caption" style={{ color: "var(--ink-mute)" }}>
          / month
        </span>
      </div>
      <div className="t-caption" style={{ color: "var(--ink-faint)", minHeight: 20, marginBottom: 24 }}>
        {billing === "annual"
          ? `Billed A$${annualMonthly * 12} / year · save A$${annualSaved}`
          : `or A$${annualMonthly} / month billed annually`}
      </div>

      <button onClick={() => setOpen(true)} className={featured ? "btn btn-primary" : "btn"} style={{ width: "100%", padding: "10px 16px", fontSize: 13, marginBottom: 24 }}>
        {plan.cta} →
      </button>

      {open && (
        <div
          style={{
            background: "var(--ground-raised)",
            border: "1px solid var(--hairline)",
            padding: 16,
            marginTop: 12,
            marginBottom: 24,
          }}
        >
          <h4 className="t-title" style={{ margin: "0 0 6px", fontSize: 18 }}>
            Start your trial
          </h4>
          <p className="t-body" style={{ margin: "0 0 12px", color: "var(--ink-mute)", fontSize: 13 }}>
            30-day free trial. Card required, cancel anytime before day 30 at no charge.
          </p>
          <input
            type="email"
            placeholder="Work email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              width: "100%",
              border: "1px solid var(--hairline)",
              padding: 8,
              marginBottom: 8,
              background: "var(--ground)",
              color: "var(--ink)",
              fontFamily: "inherit",
              fontSize: 13,
            }}
          />
          <input
            type="text"
            placeholder="Firm name"
            value={firmName}
            onChange={(e) => setFirmName(e.target.value)}
            style={{
              width: "100%",
              border: "1px solid var(--hairline)",
              padding: 8,
              marginBottom: 8,
              background: "var(--ground)",
              color: "var(--ink)",
              fontFamily: "inherit",
              fontSize: 13,
            }}
          />
          {error && (
            <p className="t-body" style={{ margin: "0 0 8px", color: "var(--signal)", fontSize: 13 }}>
              {error}
            </p>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handleCheckout} disabled={submitting} className="btn btn-primary" style={{ fontSize: 13 }}>
              {submitting ? "Starting..." : "Continue to payment"}
            </button>
            <button onClick={() => setOpen(false)} className="btn" style={{ fontSize: 13 }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {plan.features.map((f, i) => (
          <li key={i} className="t-body" style={{ fontSize: 13, padding: "6px 0", display: "flex", alignItems: "baseline", gap: 10, color: "var(--ink-mute)" }}>
            <span style={{ color: "var(--signal)", fontFamily: "var(--mono-font)", fontSize: 11, flexShrink: 0 }}>—</span>
            <span style={{ color: "var(--ink)" }}>{f}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   Marketing site
   ────────────────────────────────────────────────────────────── */
const billingOptions: { id: "monthly" | "annual"; label: string }[] = [
  { id: "monthly", label: "Monthly" },
  { id: "annual", label: "Annual · save 10%" },
];

export default function MarketingSite() {
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");

  return (
    <div style={{ width: "100%", maxWidth: 1280, margin: "0 auto", fontFamily: "var(--body-font)", color: "var(--ink)", background: "var(--ground)" }}>
      {/* Header */}
      <header style={{ padding: "20px 64px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--hairline)", background: "var(--ground-raised)" }}>
        <Wordmark size={18} />
        <nav style={{ display: "flex", gap: 28, alignItems: "center" }}>
          {["Coverage", "Product", "Pricing", "Security", "Customers"].map((l, i) => (
            <a key={i} href="#" onClick={(e) => e.preventDefault()} className="t-body" style={{ color: "var(--ink-mute)", fontSize: 14, fontWeight: 400 }}>
              {l}
            </a>
          ))}
        </nav>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <a href="#" onClick={(e) => e.preventDefault()} className="t-body" style={{ color: "var(--ink-mute)", fontSize: 13, padding: "6px 10px" }}>
            Sign in
          </a>
          <button className="btn btn-primary" style={{ fontSize: 13, whiteSpace: "nowrap" }}>
            Start 30-day trial →
          </button>
        </div>
      </header>

      {/* Hero */}
      <section style={{ padding: "112px 64px 80px", borderBottom: "1px solid var(--hairline)" }}>
        <div style={{ maxWidth: 980, margin: "0 auto", textAlign: "center" }}>
          <div className="t-caption-emph" style={{ color: "var(--signal)", marginBottom: 20 }}>
            Australian regulatory and political intelligence
          </div>
          <h1 style={{ margin: "0 auto 24px", fontFamily: "var(--display-font)", fontWeight: 500, fontSize: 60, lineHeight: "66px", letterSpacing: "-0.05em", color: "var(--ink)" }}>
            Every regulator, every bill, every committee — calibrated to your firm.
          </h1>
          <p className="t-body" style={{ margin: "0 auto 32px", maxWidth: 640, color: "var(--ink-mute)", fontSize: 18, lineHeight: "28px" }}>
            Sentry monitors six Australian regulators and the entire federal parliamentary apparatus, then delivers a single morning briefing, real-time alerts above your materiality threshold, and an agent that answers with citations.
          </p>
          <div style={{ display: "inline-flex", gap: 10, alignItems: "center" }}>
            <button className="btn btn-primary" style={{ padding: "12px 22px", fontSize: 14, whiteSpace: "nowrap" }}>
              Start your 30-day trial →
            </button>
            <button className="btn" style={{ padding: "12px 22px", fontSize: 14, whiteSpace: "nowrap" }}>
              Book a walkthrough
            </button>
          </div>
          <div className="t-caption" style={{ marginTop: 16, color: "var(--ink-faint)" }}>
            Card required · no procurement conversation · cancel in one click
          </div>
        </div>

        <div style={{ marginTop: 80, paddingTop: 32, borderTop: "1px solid var(--hairline)", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 32 }}>
          {[
            { stat: "6", unit: "regulators monitored", detail: "APRA, ASIC, AUSTRAC, TGA, AER, FRL" },
            { stat: "47 min", unit: "median alert latency", detail: "from publication to inbox" },
            { stat: "12,400+", unit: "briefings filed", detail: "across customer firms in 2025" },
            { stat: "0", unit: "procurement calls required", detail: "self-serve from card to first brief" },
          ].map((s, i) => (
            <div key={i}>
              <div style={{ fontFamily: "var(--display-font)", fontWeight: 500, fontSize: 32, letterSpacing: "-0.04em", color: "var(--ink)", lineHeight: 1 }}>{s.stat}</div>
              <div className="t-caption-emph" style={{ marginTop: 8, color: "var(--ink)" }}>{s.unit}</div>
              <div className="t-caption" style={{ marginTop: 2, color: "var(--ink-faint)" }}>{s.detail}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Coverage */}
      <section style={{ padding: "88px 64px", borderBottom: "1px solid var(--hairline)" }}>
        <div className="t-caption-emph" style={{ marginBottom: 12, textAlign: "center" }}>Coverage</div>
        <h2 className="t-title" style={{ margin: "0 auto 56px", fontSize: 36, lineHeight: "44px", letterSpacing: "-0.04em", textAlign: "center", maxWidth: 720 }}>
          Two surfaces of the Australian state. One product.
        </h2>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, maxWidth: 1120, margin: "0 auto" }}>
          <div style={{ background: "var(--ground-raised)", border: "1px solid var(--hairline)", padding: 40 }}>
            <div className="t-caption-emph" style={{ color: "var(--signal)", marginBottom: 16 }}>Regulatory & compliance</div>
            <h3 className="t-title" style={{ margin: "0 0 12px", fontSize: 22 }}>Six regulators, the day they publish.</h3>
            <p className="t-body" style={{ margin: "0 0 24px", color: "var(--ink-mute)" }}>
              Information sheets, regulatory guides, prudential standards, civil penalty proceedings, consultations, enforceable undertakings. Read, scored against your firm profile, and summarised before your auditor sees it.
            </p>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
              {[
                { name: "APRA", tag: "Prudential" },
                { name: "ASIC", tag: "Markets & credit" },
                { name: "AUSTRAC", tag: "AML / CTF" },
                { name: "TGA", tag: "Therapeutic goods" },
                { name: "AER", tag: "Energy retail" },
                { name: "Federal Register", tag: "Legislation" },
              ].map((r, i) => (
                <li key={i} style={{ display: "flex", alignItems: "baseline", gap: 8, padding: "6px 0" }}>
                  <span style={{ width: 3, height: 3, background: "var(--signal)", borderRadius: "50%", flexShrink: 0, transform: "translateY(-3px)" }} />
                  <span className="t-body" style={{ color: "var(--ink)", fontSize: 14 }}>{r.name}</span>
                  <span className="t-caption" style={{ color: "var(--ink-faint)", fontSize: 12 }}>{r.tag}</span>
                </li>
              ))}
            </ul>
          </div>

          <div style={{ background: "var(--ground-raised)", border: "1px solid var(--hairline)", padding: 40 }}>
            <div className="t-caption-emph" style={{ color: "var(--signal)", marginBottom: 16 }}>
              Political & government <span style={{ color: "var(--mat-elevated)", marginLeft: 6, fontWeight: 500 }}>NEW</span>
            </div>
            <h3 className="t-title" style={{ margin: "0 0 12px", fontSize: 22 }}>Parliament, in the same briefing.</h3>
            <p className="t-body" style={{ margin: "0 0 24px", color: "var(--ink-mute)" }}>
              Bills as they move through the chambers, committee inquiries, submissions, Hansard mentions of the regimes you advise on, and government press releases — surfaced inside the daily briefing and the Tracker.
            </p>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
              {[
                "Bill introduction → assent",
                "Committee inquiries",
                "Submissions register",
                "Hansard search",
                "PJC and Senate Economics",
                "Minister & shadow press",
              ].map((t, i) => (
                <li key={i} style={{ display: "flex", alignItems: "baseline", gap: 8, padding: "6px 0" }}>
                  <span style={{ width: 3, height: 3, background: "var(--signal)", borderRadius: "50%", flexShrink: 0, transform: "translateY(-3px)" }} />
                  <span className="t-body" style={{ color: "var(--ink)", fontSize: 14 }}>{t}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section style={{ padding: "88px 64px", borderBottom: "1px solid var(--hairline)" }}>
        <div className="t-caption-emph" style={{ marginBottom: 12 }}>The product</div>
        <h2 className="t-title" style={{ margin: "0 0 56px", fontSize: 36, lineHeight: "44px", letterSpacing: "-0.04em", maxWidth: 760 }}>
          Four surfaces. Habit, alert, conversation, horizon.
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 32 }}>
          {[
            { num: "01", label: "Daily briefing", title: "Every morning at 07:00", body: "Summary at the top, the action list, then the discrete items your regulators published in the last twenty-four hours — ranked, scored, and cited." },
            { num: "02", label: "Real-time alerts", title: "Inside fifteen minutes", body: "When a regulator or the Treasurer publishes something above your materiality threshold, the alert lands before your auditor sees it. Throttled to three per day." },
            { num: "03", label: "Home — Sentry chat", title: "Ask, with citations", body: "The agent answers from your firm's briefing history and every regulator and parliamentary publication. Every claim links to source." },
            { num: "04", label: "Tracker", title: "The forward horizon", body: "Bills in committee, consultations closing, inquiries with submissions open, sunsetting instruments. Filtered to what your firm actually cares about." },
          ].map((c, i) => (
            <div key={i}>
              <div className="t-mono" style={{ color: "var(--ink-faint)", fontSize: 12, marginBottom: 14, paddingBottom: 14, borderBottom: "1px solid var(--hairline)" }}>{c.num}</div>
              <div className="t-caption-emph" style={{ marginBottom: 8, color: "var(--signal)" }}>{c.label}</div>
              <h3 className="t-title" style={{ margin: "0 0 10px", fontSize: 19, lineHeight: "26px" }}>{c.title}</h3>
              <p className="t-body" style={{ margin: 0, color: "var(--ink-mute)", fontSize: 14, lineHeight: "22px" }}>{c.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Sample briefing */}
      <section style={{ padding: "88px 64px", borderBottom: "1px solid var(--hairline)" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto" }}>
          <div className="t-caption-emph" style={{ marginBottom: 12 }}>A briefing item · ASIC, this morning</div>
          <h2 className="t-title" style={{ margin: "0 0 40px", fontSize: 36, lineHeight: "44px", letterSpacing: "-0.04em" }}>
            What lands in your inbox.
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 48, alignItems: "start" }}>
            <div style={{ background: "var(--ground-raised)", border: "1px solid var(--hairline)", padding: "40px 48px" }}>
              <DigestItem b={sampleItem} />
            </div>
            <div>
              <div className="t-caption-emph" style={{ marginBottom: 16 }}>Anatomy</div>
              {[
                ["Materiality dot", "Red for high, amber for elevated. Calibrated against your firm profile."],
                ["Regulator & timestamp", "Source-of-truth metadata. Auditable, not editorial."],
                ["Plain-English summary", "Two to four sentences. Written by Sentry, not the regulator."],
                ["Firm-specific interpretation", "What this means for the firms and clients on your books — only on high and elevated items."],
                ["Citation block", "Every assertion grounded in a paragraph reference you can open."],
              ].map((row, i) => (
                <div key={i} style={{ padding: "12px 0", borderTop: "1px solid var(--hairline)" }}>
                  <div className="t-body" style={{ color: "var(--ink)", fontSize: 14, fontWeight: 500, marginBottom: 2 }}>{row[0]}</div>
                  <div className="t-caption" style={{ color: "var(--ink-mute)" }}>{row[1]}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Trusted by */}
      <section style={{ padding: "56px 64px", borderBottom: "1px solid var(--hairline)", background: "var(--ground-raised)" }}>
        <div className="t-caption-emph" style={{ textAlign: "center", marginBottom: 28, color: "var(--ink-faint)" }}>Trusted by regulated-industry teams</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 24, maxWidth: 1000, margin: "0 auto", alignItems: "center" }}>
          {["Halverson & Mead", "Cartwright Lyle", "Tindale Partners", "Northshore Counsel", "Marsden & Co", "Penley Advisory"].map((name, i) => (
            <div key={i} style={{ textAlign: "center", fontFamily: "var(--display-font)", fontWeight: 500, fontSize: 14, letterSpacing: "-0.02em", color: "var(--ink-mute)" }}>
              {name}
            </div>
          ))}
        </div>
      </section>

      {/* Customer quotes */}
      <section style={{ padding: "88px 64px", borderBottom: "1px solid var(--hairline)" }}>
        <div className="t-caption-emph" style={{ marginBottom: 12 }}>What customers say</div>
        <h2 className="t-title" style={{ margin: "0 0 56px", fontSize: 36, lineHeight: "44px", letterSpacing: "-0.04em", maxWidth: 760 }}>
          The morning ritual, rebuilt.
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
          {[
            { quote: "On the morning of the INFO 271 amendment, Sentry's alert reached my inbox before my associate had finished scrolling LinkedIn. The interpretation block flagged exactly which two clients on retainer were affected. That is the product, end to end.", attr: "Senior Partner", role: "Financial services regulation", firm: "Mid-market commercial firm · NSW" },
            { quote: "Tranche 2 is a once-in-a-decade shift. Sentry's Tracker shows us the bill, the committee, the submissions, the AUSTRAC pleadings, and the AML/CTF Act amendments in one place. I haven't opened ComLaw in two months.", attr: "Partner", role: "AML/CTF advisory", firm: "Boutique regulatory firm · VIC" },
            { quote: "We previously paid an enterprise vendor seventy thousand a year for a worse digest and no agent. Sentry costs less per seat, reads like it was written by a compliance professional, and now covers the parliamentary side too.", attr: "Head of compliance", role: "Regulated fintech", firm: "Sydney" },
          ].map((c, i) => (
            <blockquote key={i} style={{ margin: 0, background: "var(--ground-raised)", border: "1px solid var(--hairline)", padding: 28 }}>
              <p className="t-body" style={{ margin: "0 0 20px", fontSize: 15, lineHeight: "24px", color: "var(--ink)" }}>“{c.quote}”</p>
              <footer>
                <div className="t-body" style={{ color: "var(--ink)", fontSize: 13, fontWeight: 500 }}>{c.attr}</div>
                <div className="t-caption" style={{ marginTop: 2 }}>{c.role}</div>
                <div className="t-caption" style={{ color: "var(--ink-faint)" }}>{c.firm}</div>
              </footer>
            </blockquote>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section style={{ padding: "88px 64px", borderBottom: "1px solid var(--hairline)" }}>
        <div className="t-caption-emph" style={{ textAlign: "center", marginBottom: 12 }}>Pricing</div>
        <h2 className="t-title" style={{ margin: "0 0 16px", fontSize: 36, lineHeight: "44px", letterSpacing: "-0.04em", textAlign: "center" }}>
          Three plans. No procurement.
        </h2>
        <p className="t-body" style={{ margin: "0 auto 32px", maxWidth: 580, textAlign: "center", color: "var(--ink-mute)" }}>
          Start a 30-day trial with a card. Cancel any time before day 30 and you won't be billed. Annual billing saves 10% across every plan.
        </p>

        <div style={{ display: "flex", justifyContent: "center", marginBottom: 40 }}>
          <div style={{ display: "inline-flex", border: "1px solid var(--hairline-strong)", borderRadius: 4, background: "var(--ground-raised)", padding: 3 }}>
            {billingOptions.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setBilling(opt.id)}
                style={{
                  background: billing === opt.id ? "var(--signal)" : "transparent",
                  color: billing === opt.id ? "#fff" : "var(--ink-mute)",
                  border: "none",
                  padding: "6px 16px",
                  borderRadius: 3,
                  fontFamily: "inherit",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                  letterSpacing: "-0.011em",
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, maxWidth: 1120, margin: "0 auto" }}>
          {PRICING_PLANS.map((p) => (
            <PricingCard key={p.id} plan={p} billing={billing} featured={p.id === "standard"} />
          ))}
        </div>

        <div className="t-caption" style={{ textAlign: "center", marginTop: 24, color: "var(--ink-faint)" }}>
          All plans include five seats. Additional seats A$60 / month each. Prices in AUD, exclude GST.
        </div>
      </section>

      {/* Security */}
      <section style={{ padding: "88px 64px", borderBottom: "1px solid var(--hairline)" }}>
        <div className="t-caption-emph" style={{ marginBottom: 12 }}>Security & provenance</div>
        <h2 className="t-title" style={{ margin: "0 0 48px", fontSize: 36, lineHeight: "44px", letterSpacing: "-0.04em", maxWidth: 760 }}>
          Built to satisfy a partner-level audit.
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 32 }}>
          {[
            ["Hosted in Australia", "AWS Sydney (ap-southeast-2). Data never leaves region."],
            ["SOC 2 Type II", "Continuous control monitoring. Report available under NDA."],
            ["Single sign-on", "SAML / OIDC. Okta, Entra, Google. Included on all plans."],
            ["Audit-grade provenance", "Every claim Sentry surfaces links to a paragraph in the source publication."],
          ].map((r, i) => (
            <div key={i} style={{ borderTop: "1px solid var(--hairline)", paddingTop: 16 }}>
              <div className="t-body" style={{ color: "var(--ink)", fontWeight: 500, marginBottom: 6 }}>{r[0]}</div>
              <div className="t-caption" style={{ color: "var(--ink-mute)" }}>{r[1]}</div>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section style={{ padding: "88px 64px", borderBottom: "1px solid var(--hairline)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 64, maxWidth: 1120, margin: "0 auto" }}>
          <div>
            <div className="t-caption-emph" style={{ marginBottom: 12 }}>Common questions</div>
            <h2 className="t-title" style={{ margin: 0, fontSize: 32, lineHeight: "40px", letterSpacing: "-0.04em" }}>What teams ask before signing up.</h2>
          </div>
          <div>
            {[
              ["How does the 30-day trial work?", "You add a card and start using the full Standard plan immediately. We email you on day 23 and again on day 28. Cancel at any time before day 30 and you are not charged. There is no procurement conversation and no enterprise sales call."],
              ["Can I switch tiers later?", "Yes. Move up or down at any time. Mid-month changes are prorated to the day."],
              ["Where does Sentry get its political data?", "Federal parliamentary feeds: APH bills register, Hansard, committee submissions, ParlInfo. State coverage rolls out from H2 2026 — included for Government plan customers without a price change."],
              ["Do you sign customer paper?", "Standard and Government plans run on Sentry's short-form terms. Customers on the Government plan with bespoke legal review needs can move to an annual master agreement on request."],
              ["What about data residency and security?", "All data resides in AWS Sydney. We hold SOC 2 Type II. SSO and audit log export are included on all plans."],
            ].map((q, i) => (
              <details key={i} style={{ padding: "20px 0", borderTop: "1px solid var(--hairline)", borderBottom: i === 4 ? "1px solid var(--hairline)" : "none" }}>
                <summary className="t-body" style={{ color: "var(--ink)", fontSize: 16, fontWeight: 500, cursor: "pointer", listStyle: "none" }}>{q[0]}</summary>
                <p className="t-body" style={{ margin: "12px 0 0", color: "var(--ink-mute)" }}>{q[1]}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: "96px 64px", background: "var(--signal)", color: "#fff", textAlign: "center" }}>
        <h2 style={{ fontFamily: "var(--display-font)", fontWeight: 500, fontSize: 44, lineHeight: "52px", letterSpacing: "-0.04em", margin: "0 0 16px", color: "#fff" }}>
          Begin tomorrow's briefing tonight.
        </h2>
        <p style={{ margin: "0 auto 32px", maxWidth: 560, fontSize: 17, lineHeight: "26px", color: "rgba(255,255,255,0.75)" }}>
          Add a card, set your firm profile, and the first briefing lands at 07:00 the next morning. Cancel any time in the first thirty days at no cost.
        </p>
        <button style={{ background: "#fff", color: "var(--signal)", border: "none", padding: "14px 28px", fontSize: 15, fontWeight: 500, fontFamily: "inherit", cursor: "pointer", borderRadius: 4 }}>
          Start your 30-day trial →
        </button>
        <div className="t-caption" style={{ marginTop: 16, color: "rgba(255,255,255,0.55)" }}>
          Card required · no procurement conversation · cancel in one click
        </div>
      </section>

      {/* Footer */}
      <footer style={{ padding: "56px 64px 40px", background: "var(--ground-raised)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 48, marginBottom: 48 }}>
          <div>
            <Wordmark size={17} />
            <p className="t-caption" style={{ marginTop: 12, color: "var(--ink-mute)", maxWidth: 280 }}>
              Australian regulatory and political intelligence for risk, legal, and compliance teams.
            </p>
          </div>
          {[
            { h: "Product", items: ["Coverage", "Daily briefing", "Tracker", "Security", "Changelog"] },
            { h: "Company", items: ["About", "Customers", "Careers", "Press", "Contact"] },
            { h: "Resources", items: ["Documentation", "Status", "Privacy", "Terms", "DPA"] },
          ].map((col, i) => (
            <div key={i}>
              <div className="t-caption-emph" style={{ marginBottom: 12, color: "var(--ink)" }}>{col.h}</div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {col.items.map((l, j) => (
                  <li key={j} style={{ padding: "4px 0" }}>
                    <a href="#" onClick={(e) => e.preventDefault()} className="t-body" style={{ color: "var(--ink-mute)", fontSize: 13 }}>{l}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div style={{ borderTop: "1px solid var(--hairline)", paddingTop: 24, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div className="t-caption" style={{ color: "var(--ink-faint)" }}>© 2026 Sentry Pty Ltd · ABN 89 412 884 102 · Hosted in AWS Sydney</div>
          <div className="t-caption" style={{ color: "var(--ink-faint)" }}>SOC 2 Type II · ISO 27001 (in progress)</div>
        </div>
      </footer>
    </div>
  );
}