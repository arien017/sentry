# Sentry — Project handover (Session 2 → 3)

_Last updated: 30 May 2026. Written to hand off to a fresh chat with no prior context. **Supersedes the previous handover** (`sentry-handover.md`)._

---

## How to use this document

Paste this whole file into a new chat as the first message, with a note like: _"This is the current state of my project. I'm the solo founder, building on a Mac, and I want to continue from here."_ Then say what you want to work on next (see **Next step** at the bottom).

You're working inside a Claude Project, so a new chat in the same project may be able to search past conversations — but this document is the reliable source of truth.

---

## 1. What Sentry is

Sentry is a monitoring service for Australian **risk, legal, and compliance teams**. It ingests publications, classifies how material each item is against a specific customer firm's profile, summarises material items in plain English with citations back to the source, and delivers via a daily email digest, real-time alerts, and an in-product chat ("the agentic home"), with a forward-looking **Tracker** view.

Customers self-serve on the website (card, no procurement call) and the product demonstrates itself on the firm's data during a short onboarding chat.

### Scope — two surfaces (official)

1. **Regulatory & compliance** — now **eight** sources: APRA, ASIC, AUSTRAC, TGA, AER, **ACCC**, **OAIC**, and the Federal Register of Legislation. _(ACCC + OAIC were added this session — see §4.)_
2. **Political & parliamentary** — bills moving through Parliament, committee inquiries, submissions registers, Hansard mentions, and government/minister press. _(Sources and adapters for this surface are deferred to Week 6.)_

This dual scope is **not** reflected in the original build guide or the v0.1 design spec (both predate the decision). The marketing site reflects it; a v0.2 spec amendment exists in draft for the collaborator to merge.

---

## 2. The stack (target architecture)

| Layer | Technology | Role |
|---|---|---|
| Frontend | Next.js 16 (App Router) + React + TypeScript | All UI surfaces |
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

**Position in the 8-week plan:** Week 4 core **complete**. Weeks 1–3 done (environment, JavaScript/terminal, React/Next.js + marketing site). The database schema is now designed and live.

### Environment & repo (Weeks 1–3, unchanged)
- Homebrew, Node, Git, SSH to GitHub, VS Code, Claude Code all working on the Mac.
- Repo: `github.com/arien017/sentry`, cloned at `~/code/sentry`. Default branch `main`. Git identity Arien Alam.
- Next.js 16 app (TypeScript, Tailwind v4, App Router, `app/` at root — no `src/`).
- Design system in `app/globals.css` (colour tokens, signal navy `#14365E`, four-colour materiality scale, type/button/citation classes). Fonts in `app/layout.tsx`: Space Grotesk (display, stand-in for Strichpunkt Sans), Inter (body), JetBrains Mono (citations). Weights locked to 400/500.
- Marketing site fully built at `app/page.tsx` → `components/MarketingSite.tsx`.
- Cleanup still pending: `components/Hero.tsx`, `HowItWorks.tsx`, `RegulatorStrip.tsx`, `SampleBriefing.tsx`, `BriefingCard.tsx` are superseded by `MarketingSite.tsx`, unused, safe to delete.

### Supabase database (Week 4 — done this session)
- **Project live.** Project ref `znmlehevixjdzefzbbos`, region **Sydney (ap-southeast-2)**, free tier, Postgres. Database password saved in password manager (no recovery if lost).
- **CLI set up.** `brew install supabase/tap/supabase`; logged in via `supabase login`; `supabase init` run **inside the repo**; `supabase link --project-ref znmlehevixjdzefzbbos` done. All `supabase` commands are run from `~/code/sentry`.
- **`.env.local`** in repo root holds three values: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. It is gitignored. **Using the LEGACY `anon`/`service_role` keys** (from the dashboard's "Legacy API Keys" tab) to match these variable names — valid until end of 2026. New `publishable`/`secret` keys exist but migration to them is deferred; not worth the friction now.
- **Schema designed and applied** via five migrations. **RLS enabled on every table.** Security Advisor shows **0 errors**.

#### The schema — eight tables

Architecture splits into two zones:

**Global / shared corpus** (one copy, every signed-in user reads the same rows, only the ingestion job writes):
- **`sources`** — the regulators and (later) parliamentary feeds. Columns include `agency`, `source_type` ('regulator' | 'parliamentary'), `ingestion_method` ('rss' | 'html_scrape' | 'api'), `base_url`, `active`.
- **`publications`** — one row per ingested item, **unified across both surfaces**. Columns: `source_id` (FK), `source_type` (denormalised for fast filtering), `external_id` (dedup key), `title`, `url`, `published_at`, `event_date` (date), `status`, `detail` (JSONB for type-specific fields), `ingested_at`. `unique (source_id, external_id)` is the dedup/upsert key. `event_date` and `status` are real indexed columns (not JSONB) to power the Week 8 Tracker.

**Per-firm / customer-private** (every row carries `firm_id`, RLS-scoped):
- **`firms`** — `name`, `tier` ('essentials' | 'standard' | 'government', default 'essentials'), `stripe_customer_id`, `trial_ends_at`.
- **`users`** — `id` **references `auth.users(id)`** (the user's id *is* the Supabase auth id), `firm_id` (FK), `email`, `role` ('member' | 'admin').
- **`firm_profiles`** — one per firm (`firm_id` unique), `attributes` (JSONB), `updated_at`. The classifier reads this.
- **`classifications`** — **the bridge**: carries both `publication_id` (into the shared corpus) and `firm_id` (makes it private). `materiality_score` (smallint 0–100), `rationale`, `model_version`. `unique (firm_id, publication_id)` — one score per (publication, firm), also the upsert key.
- **`briefings`** — one row per classification that crossed the threshold and was delivered. `classification_id` (FK), `channel` ('digest' | 'alert'), `summary`, `delivered_at`.
- **`acknowledgements`** — one row when a user marks a briefing actioned. `briefing_id` (FK), `user_id` (FK to `users`, so you capture *which* person), `acknowledged_at`. `unique (briefing_id, user_id)`.

#### RLS architecture (the security model)
- **Global tables** (`sources`, `publications`): RLS on, with a single read policy — `to authenticated using (true)`. No write policies; writes happen only via the ingestion service using the `service_role` key, which **bypasses RLS entirely**.
- **Per-firm tables**: RLS on, each with a read policy `using (firm_id = auth_firm_id())`. Read-only for now. Writes (creating firms/users at sign-up, the classifier, the briefing pipeline) all happen server-side with the `service_role` key. The one user-facing write — acknowledging a briefing — gets its own insert policy when that button is built in Week 8.
- **`auth_firm_id()` helper** — the hinge of the whole model. It returns the `firm_id` of the signed-in user (`select firm_id from users where id = auth.uid()`). It is `security definer` **on purpose**: a policy on `users` that reads `users` would recurse infinitely, and `security definer` breaks that loop. Its execute grant was tightened (revoked from `public`/`anon`, granted to `authenticated`).

#### Sources seeded — eight regulators
Seeded via migration. **Only AUSTRAC's `base_url` and `ingestion_method` are confirmed** (from documented recon). The other seven are sensible **provisional** values; the first step when building each adapter (Week 6) is to verify the real endpoint and whether it's RSS / scrape / API, then a one-line `update`. Federal Register is provisionally set to `api`; everything else to `html_scrape`. The seed uses `on conflict (base_url) do nothing` so it's safe to re-run.

#### Migrations applied (in order)
1. `create_sources_and_publications` — the two global tables + RLS read policies.
2. `seed_regulator_sources` — the eight regulator rows (includes ACCC + OAIC) + a `base_url` unique constraint.
3. `create_firm_tables` — `firms`, `users`, `firm_profiles` + the `auth_firm_id()` helper + RLS policies.
4. `fix_function_grants` — tightened `auth_firm_id()` execute grants.
5. `create_analysis_tables` — `classifications`, `briefings`, `acknowledgements` + RLS policies.

#### `rls_auto_enable()` — a Supabase guardrail, leave it alone
The Security Advisor flags a function called `rls_auto_enable()`. **This is not ours and not a problem** — it's Supabase's own recommended pattern (installed by the project-level "Enable RLS on new tables" toggle). It's an event trigger that auto-enables RLS on any new table in the `public` schema — defense in depth. **Do not add it to your migrations** (it's platform-managed; you'd risk fighting Supabase over the same object) and **do not drop it**.

#### Expected, benign Security Advisor warnings
After all migrations the advisor shows **0 errors** and **3 warnings**, all safe to accept:
- `auth_firm_id()` — "signed-in users can execute" (required; `authenticated` must call it).
- `rls_auto_enable()` ×2 — Supabase's guardrail, an event-trigger function nobody can call directly.

Don't chase these to zero; you'd only get there by breaking something that's meant to work.

---

## 4. Key decisions & deviations from the original docs

These contradict the build guide / design spec and a fresh chat won't know them.

**Carried over from before:**
- **Product name is "Sentry"**, which collides with the Sentry error tool in the stack. When monitoring is wired up (Week 8), namespace the import (e.g. `SentryMonitoring`).
- **AUSTRAC RSS feed is dead.** Media releases live at `austrac.gov.au/business/updates?field_article_type_terms_target_id=186`, server-rendered Drupal HTML, plain HTTP fetch enough. The Week 6 AUSTRAC adapter **scrapes HTML**, not RSS.
- **Claude Code installs via npm** (`npm install -g @anthropic-ai/claude-code`), not Homebrew. Authenticated via the Claude.ai subscription, so no `ANTHROPIC_API_KEY` set for it.
- **Marketing expanded beyond the v0.1 spec** (nav, trusted-by strip, quotes, stats, three tiers, 30-day trial, parliamentary line). The expanded direction is the real one; design spec needs a v0.2 (draft amendment exists).

**New this session:**
- **Unified `publications` table** — DECIDED and built (was "likely" in the old handover). One table, `source_type` discriminator, JSONB `detail` for type-specific fields, so the classifier and briefing pipeline stay uniform across both surfaces. Promote any hot field (e.g. a submission deadline) from `detail` to a real column later; `event_date` and `status` already promoted for the Tracker.
- **RLS with the `auth_firm_id()` helper** — the chosen multi-tenant pattern (see §3).
- **Added ACCC + OAIC** as the 7th/8th regulators on general-purpose grounds (apply across almost any regulated firm): ACCC = competition/consumer law (note: AER is constituted *within* the ACCC), OAIC = privacy/data-breach. Adding a regulator is cheap (one `insert` + one Week 6 adapter), so the list can grow as the customer base clarifies. Deferred candidates: AFCA (financial-only), ATO, RBA, ACMA.
- **`rls_auto_enable()` is Supabase-managed** — keep out of migrations, don't drop (see §3).
- **Using legacy Supabase keys** to match env var names (see §3).

---

## 5. Lessons learned this session (these contradict naive expectations)

- **Run every `supabase` command from `~/code/sentry`.** The CLI acts on whatever directory you're standing in. Running `supabase init` from `~` silently created the `supabase/` folder in the home directory, which is why VS Code (open on the repo) didn't show it. Habit: `pwd` before any supabase command.
- **`supabase db push` will happily apply an EMPTY migration and mark it done.** It logs the version with nothing to execute, so no tables appear. Always `cat supabase/migrations/*<name>.sql` to confirm the SQL is actually in the file **before** pushing. The terminal — not the VS Code sidebar — is the source of truth for file contents.
- **To re-run a migration that was logged but applied empty/wrong:** `supabase migration repair --status reverted <version>`, then `supabase db push` again.
- **Never paste secrets (especially the `service_role` key) into an agent's chat box.** Edit `.env.local` directly in the editor. The service_role key is full god-mode (bypasses RLS) and must never leak.
- **Check the Security Advisor after every schema change** (Database → Advisors → Security, or `…/advisors/security`). **0 errors** is the bar that matters for tenant isolation; the three `SECURITY DEFINER` warnings above are benign.
- **The build guide has known inaccuracies** (it assumed joining an existing repo, RSS for AUSTRAC, Homebrew for Claude Code). Treat it as a reference, not ground truth; correct deviations as they arise.

---

## 6. Open items still to decide / fix

- **Replace placeholder marketing content** before any real launch: the stats ("47 min median latency", "12,400+ briefings") and customer quotes/firm names are fabricated. The v0.2 spec amendment recommends removing the stat strip and trusted-by strip until they hold real, attributable figures.
- **Update the design specification to v0.2** (parliamentary scope, three-tier pricing, trial model, the marketing sections v0.1 excluded). Draft amendment is ready for the collaborator to merge.
- **Scope/verify the parliamentary data sources** (APH bills register, Hansard, committee submissions, ParlInfo) — done fresh at the top of Week 6 when their adapters are built, so the URLs are current rather than stale.
- **Verify the seven provisional regulator source URLs/methods** (all except AUSTRAC) when building each adapter.
- **Font licensing:** Strichpunkt Sans vs shipping permanently on the stand-in (Space Grotesk).
- **Geometric mark:** pick one (aperture, register, monogram, diamonds explored). Site uses a text-only wordmark.

---

## 7. The eight-week plan — where we are

Weeks 1–3 done. **Week 4 core done** (Supabase + schema). Remaining:

- **Week 4 (finish):** wire the Supabase client into Next.js (a server-side client for ingestion/admin work; an authenticated client for user-facing reads), then build the admin recent-publications page (`app/admin/recent/page.tsx`) as a server component reading from `publications`, to prove a read works end to end.
- **Week 5 — Claude API & classifier:** messages API, prompt structure; build the materiality classifier and the witness-register summariser. Both must handle parliamentary content (bill progress, committee inquiry, Hansard excerpt) as well as regulator publications. Substrate-bounded composition (only cite what was ingested) applies to both surfaces.
- **Week 6 — Inngest & first adapters:** the three-piece pattern (poll → insert new publications → classify against firms → write briefings). Build the *first* adapter against a clean feed (APRA / TGA / Federal Register) to learn the pattern before the harder AUSTRAC HTML scrape. Parliamentary feeds are a second category of adapter after the regulators. **Verify each source's real endpoint/method first** (seeded values are provisional except AUSTRAC).
- **Week 7 — Stripe:** three tiers (Essentials A$250, Standard A$500, Government A$750) × monthly/annual (annual −10%) + 30-day free trial. So 3 products × 2 intervals = 6 prices, plus trial logic and prorated tier-switching. Onboarding chat captures the firm profile and demonstrates before sign-up.
- **Week 8 — Agentic home & Tracker:** the four views (Today, Alerts, Archive, Chat) plus a fifth, **Tracker** — the forward-horizon view (bills in committee, consultations closing, open submission windows, sunsetting instruments), filtered to the firm and powered by the `event_date`/`status` columns already in `publications`. Chat view streams responses and renders inline citations into the provenance pane.

---

## 8. Next step

Finish Week 4. A good opening request for the new chat:

> _"Let's finish Week 4. Help me wire the Supabase client into my Next.js app and build the admin recent-publications page to prove a read works end to end. The schema is designed and applied (eight tables, RLS on everything), the Supabase project is linked, and `.env.local` has the keys."_

**Working habits to carry over:** keep `npm run dev` in one terminal tab and Git in another; run all `supabase` commands from `~/code/sentry` (`pwd` first); `cat` a migration file to confirm its SQL before `db push`; check the Security Advisor after schema changes; commit in small, single-purpose changes; read the terminal (it holds the real error) before refreshing; treat the design prototypes as references to translate, not code to paste.
