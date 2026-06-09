# Sentry — Design specification v0.2 (proposed amendments)

**Status:** DRAFT · proposed amendments for collaborator review · not yet canonical
**Date:** 26 May 2026
**Relationship to v0.1:** This document amends the existing design specification (`mark_design_specification.pdf`, v0.1). It does **not** replace it. Where a chapter is not mentioned here, v0.1 stands unchanged. The collaborator who authored v0.1 should review these deltas and fold the accepted ones into a canonical v0.2 of the specification.

---

## How to read this

v0.1 specified a narrow product: six regulators, one $500/month price, a deliberately minimal marketing site. Since then, the founder has decided to **expand the product to cover parliamentary and political monitoring as a second surface**, and the marketing/pricing model has grown accordingly. This document records those changes against the v0.1 chapter structure so they can be reviewed and merged deliberately, rather than absorbed silently from a prototype.

Each section below names the v0.1 chapter it amends, states the change, and — where the change conflicts with a stated v0.1 principle — flags it explicitly for a conscious decision.

---

## Summary of changes at a glance

1. **Scope:** product now covers two surfaces — regulatory/compliance (unchanged) and political/parliamentary (new).
2. **Product surfaces:** a new eighth surface, **the Tracker** (forward parliamentary/regulatory horizon); the agentic home gains a fifth view.
3. **Voice:** new discipline for political content — strict neutrality, factual reporting, no partisan framing.
4. **Pricing:** moves from a single $500/month price to **three tiers with a 30-day trial and monthly/annual billing**.
5. **Marketing site:** substantially expanded (nav, two-pillar coverage, tiers, FAQ, social proof). **This conflicts with v0.1's "restraint is the marketing" stance — see §XII for the flagged decision.**

**Unchanged from v0.1 (do not re-litigate):** the colour system, the type system, the spacing scale, the hairline structural grammar, the materiality scale, the witness register's core posture, and the no-gradient / no-shadow / two-weight disciplines. The visual system carries over wholesale; only scope, surfaces, voice-extensions, pricing, and marketing change.

---

## Amends Chapter I — Brand position and product premise

The premise widens. Sentry is no longer only a regulatory monitor; it is **an intelligence service covering two surfaces of the Australian state that bear on regulated firms: the regulators and the Parliament.**

Add to the premise: the same practitioner who cannot justify enterprise regulatory-intelligence spend is equally underserved on the political side — bills, committee inquiries, and Hansard mentions that affect their clients are tracked today via manual ParlInfo searches and ad-hoc alerts. Sentry brings both surfaces into one briefing.

The brand voice sentence is amended to: _Sentry is the witness. It reports what the regulators and the Parliament did, summarises it in the firm's working language, and cites its sources. It does not interpret beyond what the substrate supports, does not take political sides, and does not promote itself._

The "differs from adjacent products" framing is unchanged.

---

## Amends Chapter V — Voice and copy discipline

The three v0.1 rules (report not interpret; match the regulator's language; refuse filler) all stand and now apply to parliamentary content as well. **Add a fourth rule, governing political content specifically:**

**Rule four: report parliament without partisanship.** When Sentry reports on bills, committees, Hansard, or ministerial statements, it states what happened in procedural, factual terms and what it means for the firm — never who is right, who is winning, or whether a measure is good or bad policy. Write "The Treasury Laws Amendment (Tranche 2 reforms) Bill passed its second reading in the House on 14 May" — not "the government's controversial AML overhaul cleared a key hurdle." Sentry monitors the political surface for its regulatory consequence, not for political commentary. The product never characterises a party, member, or policy as good, bad, popular, or controversial. Materiality is measured by impact on the firm, not by political salience.

Extend the "what the product never says" list accordingly: no partisan adjectives, no horse-race framing ("a blow to", "a win for"), no editorialising on the merits of legislation.

---

## Amends Chapter VI — Product architecture at the surface level

**Sources expand.** The `sources` concept grows from six regulators to six regulators plus a parliamentary source group. The parliamentary group comprises: the federal bills register, committee inquiries and submissions, Hansard, and ministerial/government press. (Data origins are listed in the new Appendix A.)

**Surfaces grow from seven to eight.** Add **Surface eight — the Tracker** (specified below). The order of buyer-facing importance is unchanged for the original seven; the Tracker sits alongside the agentic home as part of the authenticated product.

A briefing item may now carry a `source_type` of either `regulator` or `parliamentary`. All downstream surfaces (digest, alert, briefing reader, archive, agentic home) render both types using the same anatomy, with the parliamentary additions noted in the amended chapters below.

---

## Amends Chapter VII — Surface one, the agentic home

The left-rail navigation gains a **fifth primary view: Tracker**, placed after Chat. The home's four content views (Today, Alerts, Archive, Chat) are unchanged in structure; they now include parliamentary briefings inline alongside regulatory ones, distinguished by the regulator/source tag in the caption row (e.g. "PARLIAMENT · BILLS" rendered in the same caption-emphasis-uppercase style as a regulator tag).

The provenance pane is unchanged in structure. For a parliamentary item, "Source publication" points to the bill page / Hansard entry / committee page rather than a regulator URL; "Cited passages" cite the relevant clause, Hansard paragraph, or submission section.

---

## NEW — Surface eight, the Tracker

**Purpose.** The Tracker is the forward-horizon view. Where Today and Alerts report what *has* happened, the Tracker shows what is *coming*: bills currently in committee, consultations with closing dates, inquiries with open submission windows, and instruments due to sunset. It is filtered to the firm profile, so a firm sees only the forward items that bear on it.

**Layout.** Three-pane, consistent with the agentic home. Centre pane renders the horizon as a chronological forward list grouped by stage. Right pane shows provenance for the focused item.

**Item anatomy.** Each Tracker row carries: a stage indicator (e.g. "Second reading", "Submissions close", "Sunsets"), a date or date-range, the source tag, the title, a one-line plain-English note on relevance to the firm, and a citation. Materiality colour applies as elsewhere.

**Interaction.** Filterable by source, stage, and date range. Items move through stages as the underlying process advances; when a tracked bill is passed or an instrument sunsets, the item transitions to a closed state and a corresponding briefing is generated in Today.

**Open for the collaborator:** the precise stage taxonomy for bills (introduction → first reading → second reading → committee → third reading → other chamber → assent) and how much of it to surface vs. collapse.

---

## Amends Chapters VIII & IX — Daily digest and real-time alert emails

Both emails now include parliamentary items, interleaved with regulatory items and ordered by materiality exactly as before. A parliamentary item renders with the same anatomy (dot, source tag, title, summary, interpretation, citation); the source tag reads e.g. "PARLIAMENT · COMMITTEES". No structural change to either email. The empty-state and throttling rules are unchanged.

The digest's "What to watch this week" forward-look section is now populated partly from the Tracker, giving it richer parliamentary content (upcoming readings, closing submission windows).

---

## Amends Chapter XI — Surface five, the briefing reader and archive

Parliamentary briefings use the same reader layout. The detail-section headings adapt to the source: for a bill, typical sections are "What the bill does", "Where it is in the process", "Why it matters to the firm", and "What to watch next"; for a committee inquiry, "Scope of the inquiry", "Submission window", and "Relevance to the firm". The acknowledgement primitive and archive search/export are unchanged and now span both source types.

---

## Amends Chapter XII — Surface six, the marketing site

**This is the chapter with the most change, and it carries a flagged conflict.**

v0.1 specified a single-page site of deliberate restraint: one declarative hero, a regulator strip, three how-it-works columns, a sample briefing, three case studies, a single pricing card, and a footer — and explicitly **no** nav bar, **no** trusted-by logo strip, **no** feature comparison, **no** tiered pricing. The stated principle was "the restraint is the marketing."

The current built site (translated from the later prototype) departs from this on several points: it has a top nav, a two-pillar coverage section (regulatory + political), a four-surface product section, a "trusted by" firm-name strip, a stat strip, customer quotes, a three-tier pricing section with a billing toggle, a security section, and an FAQ.

**Recommended reconciliation — for the collaborator to rule on:**

- **Keep:** the two-pillar coverage section (it's the clearest way to communicate the new dual scope), the four-surface product section, the security section, and the FAQ. These earn their place now that the product is larger and the buyer has more to understand.
- **Keep but make honest:** the three-tier pricing section is necessary given the new pricing model (below). It belongs.
- **Reconsider against the brand:** the **fabricated stat strip** ("47 min median latency", "12,400+ briefings filed") and the **"trusted by" firm-name strip** both assert social proof the product does not yet have. v0.1's credibility-through-restraint stance is right here: inventing metrics and customer logos is exactly the regtech-marketing posture the brand defines itself against. **Recommendation: remove both until they can be populated with real, attributable figures and consenting customers.** The customer-quote section should likewise carry only real, sourced quotes (pseudonymised if requested), not placeholders.
- **Decision needed:** whether a persistent top nav is consistent with the single-page discipline, or whether the nav links should simply be in-page anchors. Minor, but worth a conscious call.

The hero copy is updated to carry the dual scope. The v0.1 hero ("Regulatory monitoring for risk, legal, and compliance teams. Six regulators. Daily intelligence.") becomes, in the expanded direction: a single declarative line conveying both the regulatory and parliamentary surfaces. The "one declarative sentence" discipline should be preserved even as the content widens — resist letting the hero sprawl.

---

## NEW — Pricing model (supersedes the pricing portion of Chapter XII)

v0.1: a single price, AUD $500/month (or $5,000/year), five seats, all six regulators, no tiers, no toggle.

v0.2: **three tiers, monthly or annual (annual −10%), with a 30-day card-required trial.**

| Tier | Monthly (AUD) | Includes |
|---|---|---|
| Essentials | $250 | Six regulators, daily briefing, real-time alerts, agentic home, archive + export, five seats |
| Standard | $500 | Everything in Essentials **plus** the political/parliamentary surface, the Tracker, Slack/Teams forwarding, SSO |
| Government | $750 | Everything in Standard plus a monthly analyst-authored political landscape briefing, custom watches, audit-log export, priority support |

All tiers include five seats; additional seats $60/month. The trial gives full Standard access for 30 days, card required, cancel anytime before day 30 at no charge.

**Note the model shift:** v0.1's "demonstrate on the firm's data *before* taking payment" onboarding is now paired with a *trial* model (card up front, demonstrate, then 30 days free). The onboarding chat's demonstration phase (Chapter X) still applies; the difference is the card is captured at sign-up rather than after the demo. **The collaborator should confirm this is the intended commercial model**, since it changes the onboarding's final phase.

---

## NEW — Appendix A, parliamentary data sources

For implementation reference (Week 6 ingestion). The political/parliamentary surface draws from federal sources: the Australian Parliament House bills register, Hansard, committee inquiry pages and submission registers, and ParlInfo. State coverage is explicitly deferred (the prototype FAQ commits to state coverage from H2 2026 for Government-tier customers — **flag: this is a commitment that should be confirmed before it appears in marketing**). These are structured public sources; the adapter strategy (API vs. scrape) is a Week 6 engineering question, not a design one.

---

## Amends Chapter XVI — Open design decisions

Add to the open-decisions list:
- The Tracker's bill-stage taxonomy and how much to surface (above).
- The marketing-site reconciliation: which prototype additions to keep, which to remove (above).
- The pricing/trial commercial model confirmation (above).
- The state-coverage commitment in marketing (above).
- How the parliamentary source tags render in the caption row (proposed: "PARLIAMENT · BILLS / COMMITTEES / HANSARD" in the existing caption-emphasis style).

Carried over unresolved from v0.1: Strichpunkt Sans licensing (shipping on a stand-in until resolved), and the geometric mark selection.

---

## Things deliberately NOT changed

To be explicit, so the collaborator can review quickly: the colour tokens, the type scale and pairing, the nine-value spacing scale, the 1px-hairline structural grammar, the 4px-radius-on-controls-only rule, the single shadow, the no-gradient rule, the two-weight discipline, the materiality scale and its meanings, the 150ms motion primitive, and the written (not illustrated) empty-state discipline all carry over from v0.1 unchanged. The expansion is in **scope, surfaces, voice-extension, pricing, and marketing** — not in the visual system.