# Sentry — Project handover

_Last updated: 26 May 2026. Written to hand off to a fresh chat that has no prior context._

---

## How to use this document

Paste this whole file into a new chat as the first message, with a note like: _"This is the current state of my project. I'm the founder, building solo on a Mac, and I want to continue from here."_ Then say what you want to work on next (see **Next step** at the bottom).

You're also working inside a Claude Project, so a new chat in the same project may be able to search past conversations — but this document is the reliable source of truth.

---

## 1. What Sentry is

Sentry is a monitoring service for Australian **risk, legal, and compliance teams**. It ingests publications, classifies how material each item is against a specific customer firm's profile, summarises material items in plain English with citations back to the source, and delivers via a daily email digest, real-time alerts, and an in-product chat ("the agentic home").

Customers self-serve on the website (card, no procurement call) and the product demonstrates itself on the firm's data during a short onboarding chat.

### Major scope decision (NEW — May 2026)

**Sentry now covers two surfaces of the Australian state, not one:**

1. **Regulatory & compliance** — six regulators: APRA, ASIC, AUSTRAC, TGA, AER, and the Federal Register of Legislation. _(This was the original scope.)_
2. **Political & parliamentary** — bills moving through Parliament, committee inquiries, submissions registers, Hansard mentions, and government/minister press. _(This is the new expansion and is now official.)_

This expansion is **not** reflected in the original build guide or the original design specification (both predate the decision). The marketing site already reflects it; the rest of the build does not yet. Reconciling this is a running theme in the updated plan below.

---

## 2. The stack (target architecture)

| Layer | Technology | Role |
|---|---|---|
| Frontend | Next.js (App Router) + React + TypeScript | All UI surfaces |
| Styling | Tailwind v4 + CSS design tokens | Design system |
| Hosting | Vercel | Deploy + serverless + cron |
| Database & auth | Supabase (Postgres) | Firm profiles, publications, classifications, billing state |
| LLM | Anthropic Claude API | Materiality classifier, summariser, chat |
| Job runner | Inngest | Scheduled polling + classification jobs |
| Email | Resend | Daily digest + real-time alerts |
| Billing | Stripe | Subscriptions, self-serve sign-up, customer portal |
| Monitoring | Vercel Analytics + Sentry (the error tool) | Errors + analytics |

---

## 3. Current state — what's built

**Position in the 8-week learning plan:** end of Week 3 (React & Next.js). The marketing site is done.

**Environment (Week 1):** Homebrew, Node, Git, SSH key to GitHub, VS Code, and Claude Code all installed and working on the Mac. Dev workflow is `npm run dev` from `~/code/sentry`, edit in VS Code, check `localhost:3000`.

**Repo:** `github.com/arien017/sentry`, cloned locally at `~/code/sentry`. Git identity is set to Arien Alam / ariena017@gmail.com. Default branch `main`.

**Codebase so far:**
- Next.js 16 app scaffolded (TypeScript, Tailwind v4, App Router, `app/` at root — no `src/`).
- Design system wired into `app/globals.css`: the full colour token set (ground/ink, signal navy `#14365E`, four-colour materiality scale) plus type/button/citation classes. Fonts loaded in `app/layout.tsx`: **Space Grotesk** (display, a stand-in for the spec's Strichpunkt Sans / Söhne Breit), **Inter** (body), **JetBrains Mono** (citations). Weights locked to 400/500 only.
- **Marketing site is fully built** at `app/page.tsx` → `components/MarketingSite.tsx` (one self-contained client component). Sections: header/nav, hero + stat strip, two-pillar coverage (regulatory + political), four-surface product section, sample briefing with anatomy panel, trusted-by row, customer quotes, three-tier pricing with working monthly/annual toggle, security, FAQ, CTA, footer.

**Practice (Week 2):** a separate `~/code/js-practice` folder holds an RSS-reader script (`rss-reader.js`, uses `fast-xml-parser`) that fetches and prints feed items. Proven working against a test feed. This is the seed of the Week 6 ingestion adapter.

**Cleanup pending:** `components/Hero.tsx`, `HowItWorks.tsx`, `RegulatorStrip.tsx`, `SampleBriefing.tsx`, `BriefingCard.tsx` were hand-built earlier and are now superseded by `MarketingSite.tsx`. They're unused and safe to delete.

---

## 4. Key decisions & deviations from the original docs

These are things a fresh chat won't know and that contradict the build guide / design spec:

- **Product name is "Sentry."** Note: this collides with the Sentry error-monitoring tool that's in the stack. When monitoring is wired up (Week 8), namespace that import clearly (e.g. import it as `SentryMonitoring`).
- **AUSTRAC RSS feed is dead.** The build guide's URL 404s; AUSTRAC is retiring the feed. Reconnaissance done: media releases live at `austrac.gov.au/business/updates?field_article_type_terms_target_id=186`, content is **server-rendered HTML** (no JSON API), the site runs on Drupal, and each release exposes date / title / link / summary. The Week 6 AUSTRAC adapter must **scrape HTML**, not parse RSS.
- **Claude Code installs via npm**, not Homebrew (the build guide is wrong here): `npm install -g @anthropic-ai/claude-code`. It's authenticated via the Claude.ai subscription (browser login), so no `ANTHROPIC_API_KEY` env var is set for it.
- **Marketing direction expanded beyond the design spec.** The original spec (v0.1) was deliberately minimal: single declarative hero, no nav bar, no trusted-by strip, single $500/month price with a demo-before-pay model. The live site (from the friend's later prototype) instead has a nav bar, trusted-by strip, customer quotes, stats, three pricing tiers with a 30-day trial, and the parliamentary product line. **The expanded direction is now the real one.** The design spec needs updating to v0.2 to match.

---

## 5. Open items still to decide / fix

- **Replace placeholder content** before any real launch: the stats (e.g. "47 min median latency", "12,400+ briefings") and the customer quotes/firm names in the marketing site are fabricated placeholders.
- **Update the design specification to v0.2** to reflect: parliamentary scope, three-tier pricing, the trial model, and the marketing sections the v0.1 spec said to exclude.
- **Scope the parliamentary data sources** (see updated plan): APH bills register, Hansard, committee submissions, ParlInfo.
- **Font licensing:** decide on Strichpunkt Sans vs shipping permanently on a stand-in (currently Space Grotesk).
- **Geometric mark:** pick one (concepts explored: aperture, register, monogram, diamonds). Site currently uses a text-only wordmark.

---

## 6. Assets the founder has on hand

- The original **build guide** (PDF) — the 8-week learning plan. Now partly out of date (see deviations and the updated plan).
- The **design specification** (PDF, v0.1) — authoritative on colour, type, spacing, voice, and the seven surfaces. Predates the parliamentary expansion.
- **Design prototypes** from a collaborator: `.jsx`/`.html` files (`index.html` = agentic home, `canvas.html` = design board, marketing site, emails, onboarding chat) + `tokens.css`. Built with CDN React / browser-compiled JSX — **cannot be dropped into the Next.js app directly**; they're a reference to translate from. All named "Sentry."
- A **design-tokens cheat sheet** (HTML) rendering the colour + type system.

---

## 7. The updated eight-week plan (with parliamentary scope folded in)

Weeks 1–3 are done (environment, JavaScript/terminal, React/Next.js + marketing site). The remaining weeks, updated:

### Week 4 — Supabase & the database _(next up)_
Learn Supabase/Postgres and design the schema. **Updated for parliamentary scope:** the data model must cover both surfaces. Beyond the original tables (firms, users, firm_profiles, sources, publications, classifications, briefings, acknowledgements), add a way to represent parliamentary entities — bills, committee inquiries, submissions, and Hansard mentions. Cleanest approach is likely a single `publications` table with a `source_type` discriminator (`regulator` vs `parliamentary`) plus type-specific detail, so the classifier and briefing pipeline stay uniform. The `sources` concept expands from 6 regulators to 6 regulators + the parliamentary feeds.

### Week 5 — Claude API & substrate-bounded composition
Learn the messages API, prompt structure, and the classifier/summariser. **Updated:** the classifier and summariser must handle parliamentary content (a bill's progress, a committee inquiry, a Hansard excerpt) as well as regulator publications, scoring both against the firm profile and summarising both in the witness register. Substrate-bounded composition (only cite what was actually ingested) applies equally to parliamentary sources.

### Week 6 — Job runner & first source adapters
Build the first end-to-end ingestion path with Inngest. **Updated:** (a) the AUSTRAC adapter must **scrape HTML**, not RSS — and given that, consider building the *first* adapter against a regulator with a clean, stable feed (APRA, TGA, or the Federal Register) to learn the three-piece pattern before the harder AUSTRAC scrape; (b) parliamentary feeds (APH bills register, Hansard, committee submissions, ParlInfo) become a **second category of adapter** to build after the regulatory ones. Each adapter still follows the same three pieces: poll → insert new publications → classify against firms → write briefings.

### Week 7 — Stripe billing & sign-up
**Updated significantly:** pricing is no longer a single $500/month card. It's **three tiers** — Essentials A$250, Standard A$500, Government A$750 — each with **monthly and annual** billing (annual −10%) and a **30-day free trial**. Stripe setup therefore needs 3 products × 2 intervals = 6 prices, plus trial logic and tier-switching (prorated). The onboarding chat still captures the firm profile and demonstrates the product before sign-up.

### Week 8 — Agentic home & polish
Build the authenticated home. **Updated:** in addition to the four views in the original spec (Today, Alerts, Archive, Chat), add a fifth — **Tracker** — the forward-horizon view of bills in committee, consultations closing, inquiries with open submissions, and sunsetting instruments, filtered to the firm. The chat view streams responses and renders inline citations into the provenance pane.

---

## 8. Next step

The natural next move is **Week 4: design the database schema in Supabase**, now that it must model both regulatory publications and parliamentary entities. A good opening request for the new chat:

> _"Let's start Week 4. Help me set up Supabase and design the database schema for Sentry, including both the regulatory publications and the new parliamentary entities (bills, committees, submissions, Hansard). I'm the founder, building solo, and I've got the marketing site done."_

Working habits to carry over: keep `npm run dev` running in one terminal tab and Git in another; when something breaks, read the terminal (it holds the real error) before refreshing; commit in small, single-purpose changes; and treat the design prototypes as references to translate, not code to paste.