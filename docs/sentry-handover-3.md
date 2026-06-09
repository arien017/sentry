# Sentry — Project handover (Session 3 → 4)

_Last updated: 9 June 2026. Written to hand off to a fresh chat with no prior context. **Supersedes the previous handover** (`sentry-handover-2.md`)._

---

## How to use this document

Paste this whole file into a new chat as the first message, with a note like: _"This is the current state of my project. I'm the solo founder, building on a Mac, and I want to continue from here."_ Then say what you want to work on next (see **Next step** at the bottom).

You're working inside a Claude Project, so a new chat in the same project may be able to search past conversations, but this document is the reliable source of truth.

**Workflow note (changed this session):** decisions and prompt-authoring happen in the Project chat; execution happens in Claude Code. The chat does not run code or Git. When a task needs building, the chat writes a self-contained, paste-ready prompt for Claude Code. Database operations (SQL) are run by hand in the Supabase dashboard, and Git commits are made by hand in the terminal, neither through Claude Code.

---

## 1. What Sentry is

Sentry is a monitoring service for Australian **risk, legal, and compliance teams**. It ingests publications, classifies how material each item is against a specific customer firm's profile, summarises material items in plain English with citations back to the source, and delivers via a daily email digest, real-time alerts, and an in-product chat ("the agentic home"), with a forward-looking **Tracker** view.

Customers self-serve on the website (card, no procurement call) and the product demonstrates itself on the firm's data during a short onboarding chat.

### Scope — two surfaces

1. **Regulatory & compliance** — eight sources: APRA, ASIC, AUSTRAC, TGA, AER, ACCC, OAIC, and the Federal Register of Legislation.
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

**Position in the 8-week plan:** Weeks 1–4 **complete**. Week 5 (Claude API classifier + summariser) **complete**. Week 6 (Inngest + first source adapters) is next.

### Environment & repo (Weeks 1–3, unchanged)
- Homebrew, Node, Git, SSH to GitHub, VS Code, Claude Code all working on the Mac.
- Repo: `github.com/arien017/sentry`, cloned at `~/code/sentry`. Default branch `main`. Git identity Arien Alam.
- Next.js 16 app (TypeScript, Tailwind v4, App Router, `app/` at root — no `src/`).
- Design system in `app/globals.css` (colour tokens, signal navy `#14365E`, four-colour materiality scale, type/button/citation classes). Fonts in `app/layout.tsx`: Space Grotesk (display, stand-in for Strichpunkt Sans), Inter (body), JetBrains Mono (citations). Weights locked to 400/500.
- Marketing site fully built at `app/page.tsx` → `components/MarketingSite.tsx`.
- Cleanup still pending: `components/Hero.tsx`, `HowItWorks.tsx`, `RegulatorStrip.tsx`, `SampleBriefing.tsx`, `BriefingCard.tsx` are superseded by `MarketingSite.tsx`, unused, safe to delete.

### Supabase database (Week 4 — done in the previous session)
- **Project live.** Project ref `znmlehevixjdzefzbbos`, region **Sydney (ap-southeast-2)**, free tier, Postgres. Database password in password manager (no recovery if lost).
- **CLI set up.** Logged in; `supabase init` run inside the repo; linked to the project ref. All `supabase` commands run from `~/code/sentry`.
- **`.env.local`** in repo root holds `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and now `ANTHROPIC_API_KEY` (see §5). Gitignored. **Using the LEGACY `anon`/`service_role` keys** (valid until end of 2026); migration to new publishable/secret keys deferred.
- **Schema designed and applied** via five migrations. **RLS enabled on every table.** Security Advisor shows **0 errors**.

#### The schema — eight tables

**Global / shared corpus** (every signed-in user reads the same rows; only the ingestion job writes):
- **`sources`** — `agency`, `source_type` ('regulator' | 'parliamentary'), `ingestion_method` ('rss' | 'html_scrape' | 'api'), `base_url`, `active`.
- **`publications`** — one row per ingested item, unified across both surfaces. `source_id` (FK), `source_type`, `external_id` (dedup key), `title`, `url`, `published_at`, `event_date` (date), `status`, `detail` (JSONB), `ingested_at`. `unique (source_id, external_id)` is the dedup/upsert key. `event_date` and `status` are real indexed columns (not JSONB) for the Week 8 Tracker.

**Per-firm / customer-private** (every row carries `firm_id`, RLS-scoped):
- **`firms`** — `name`, `tier` ('essentials' | 'standard' | 'government', default 'essentials'), `stripe_customer_id`, `trial_ends_at`.
- **`users`** — `id` references `auth.users(id)`, `firm_id` (FK), `email`, `role` ('member' | 'admin').
- **`firm_profiles`** — one per firm (`firm_id` unique), `attributes` (JSONB), `updated_at`. The classifier reads this.
- **`classifications`** — the bridge: `publication_id` + `firm_id`, `materiality_score` (smallint 0–100), `rationale`, `model_version`. `unique (firm_id, publication_id)`, also the upsert key.
- **`briefings`** — one per classification that crossed the threshold and was delivered. `classification_id` (FK), `channel` ('digest' | 'alert'), `summary`, `delivered_at`.
- **`acknowledgements`** — one when a user marks a briefing actioned. `briefing_id` (FK), `user_id` (FK), `acknowledged_at`. `unique (briefing_id, user_id)`.

#### RLS architecture
- **Global tables** (`sources`, `publications`): RLS on, single read policy `to authenticated using (true)`. No write policies; writes happen via the `service_role` key, which bypasses RLS.
- **Per-firm tables**: RLS on, each with read policy `using (firm_id = auth_firm_id())`. Read-only for now; writes happen server-side with `service_role`. The one user-facing write (acknowledging a briefing) gets its own insert policy when that button is built in Week 8.
- **`auth_firm_id()` helper** — returns the signed-in user's `firm_id` (`select firm_id from users where id = auth.uid()`). It is `security definer` on purpose, to break the infinite recursion a policy on `users` reading `users` would cause. Execute grant revoked from `public`/`anon`, granted to `authenticated`.
- **`rls_auto_enable()`** — Supabase-managed event trigger (the project "Enable RLS on new tables" toggle). Not ours: do not add to migrations, do not drop.

#### Sources seeded — eight regulators
Only AUSTRAC's `base_url` and `ingestion_method` are confirmed. The other seven are provisional; verify each real endpoint/method when building its Week 6 adapter, then a one-line `update`. Federal Register provisionally `api`; everything else `html_scrape`. Seed uses `on conflict (base_url) do nothing` so it's safe to re-run.

#### Migrations applied (in order)
1. `create_sources_and_publications`
2. `seed_regulator_sources` (eight rows incl. ACCC + OAIC + a `base_url` unique constraint)
3. `create_firm_tables` (`firms`, `users`, `firm_profiles` + `auth_firm_id()` + RLS)
4. `fix_function_grants`
5. `create_analysis_tables` (`classifications`, `briefings`, `acknowledgements` + RLS)

### Supabase client wiring (Week 4 finish — done this session)
- Installed `@supabase/ssr` and `@supabase/supabase-js`.
- Three client helpers under `lib/supabase/`:
  - **`client.ts`** — browser client via `createBrowserClient` (URL + anon key). Built but **unused until auth exists (Week 7)**.
  - **`server.ts`** — cookie-based server client via `createServerClient`, reading cookies from `next/headers` (URL + anon key). Built but **unused until auth exists (Week 7)**.
  - **`admin.ts`** — service-role client via `createClient` from `@supabase/supabase-js` (URL + service-role key), `autoRefreshToken: false`, `persistSession: false`. **Server-only — never import into a client component.** This is the one in active use.
- **Admin page** at `app/admin/recent/page.tsx`: a server component using the **service-role admin client** (decision: it bypasses RLS, which is correct because there is no auth/login yet, so a cookie-based client would return zero rows). Reads the 10 most recent `publications`, renders a plain inline-styled HTML table, handles error and empty states, `export const dynamic = "force-dynamic"`. `/admin/*` is **deliberately ungated for now**; gate it once auth exists (Week 7+).
- **Read proven end to end.** Page showed the empty state, then a hand-inserted test row appeared correctly, then the test row was deleted. Full write→read loop confirmed.

### Week 5 — Claude API classifier + summariser (done this session)
Two standalone terminal scripts under `scripts/`, run by hand. **Neither touches the database yet and neither is part of the Next.js app** — they prove the LLM logic in isolation before Week 6 wires it into the pipeline.

- **`scripts/classify.ts`** — the materiality classifier.
  - Model: **`claude-haiku-4-5-20251001`** (Haiku 4.5). Decision: the classifier is the highest-volume job (every publication × every firm), so it runs on the cheapest current model. Tested-and-kept, not assumed — see results below.
  - Calls the Anthropic API via `@anthropic-ai/sdk`. Reads `ANTHROPIC_API_KEY` from env.
  - Hard-codes the test publication and two firm profiles. Returns, per firm, JSON: `{ "materiality_score": <int 0-100>, "rationale": "<one sentence>" }` — shape chosen to map straight onto the `classifications` columns.
  - Run: `npx tsx scripts/classify.ts`
- **`scripts/summarise.ts`** — the witness-register summariser.
  - Model: **`claude-opus-4-8`** (Opus 4.8). Decision: customer-facing, low-volume, quality-critical, so the strongest model.
  - Same SDK and env key. Hard-codes the same test publication. Outputs three sentences of summary prose plus a citation line (source URL + publication date). Plain text, no JSON.
  - Run: `npx tsx scripts/summarise.ts`

#### Test case used
A real APRA media release: "APRA finalises new IRB accreditation pathway for banks" (4 June 2026). The release makes IRB accreditation more attainable for **medium-sized** banks; the six banks already IRB-accredited are the four majors, Macquarie, and ING. Two firm profiles tested against it:
- **Commonwealth Bank** — major, already IRB-accredited. Expected low (this helps rivals, not them).
- **Bendigo and Adelaide Bank** — mid-size ADI on the standardised approach, the exact target of the new pathway. Expected high.

#### Results (classifier working as designed)
- **CBA — 15/100.** Already accredited; pathway doesn't apply; minor competitive noise only.
- **Bendigo — 82/100.** Directly in scope; pathway opens a capital-efficiency and pricing opportunity.

The high/low split from the same document is strong evidence the classifier reasons about **firm-specific materiality**, not surface keywords. Haiku is kept on this evidence; upgrade to Sonnet 4.6 only if a future case produces a visibly wrong or mushy score.

#### Summariser result
Produced a faithful three-sentence witness-register summary: reports rather than interprets, keeps APRA's vocabulary intact ("internal ratings-based (IRB) approach", "standardised approach", "credit risk-weighted assets", "accreditation"), no filler, no editorialising, date (4 June 2026) and CFR Review (Action 2) correctly grounded in the source. Substrate-bounded composition holds on prose. Open editorial taste point (not a defect): the third sentence spends the budget on the already-accredited-banks roster (background) rather than on what the pathway changes (the news); could be tuned for content priority later.

---

## 4. The witness register (canonical, from design spec v0.1 Chapter V)

The product writes in the **witness register**: observational, precise, unembellished, matching the buyer's working language. Three rules:
1. **Report, don't interpret.** State what the regulator published. Interpretation is confined to a separately-labelled "What this means for [firm]" block, always traceable to the source. Write "ASIC published INFO 271 today", not "ASIC has issued important new guidance".
2. **Match the regulator's language.** Use the regulator's own terms and identifiers exactly; never soften into plainer English the buyer wouldn't recognise.
3. **Refuse filler.** No "excited to announce", "introducing", "the future of", "AI-powered", "transform". No exclamation marks, no emoji. Never call regulatory content "easy" or "simple".

Structural note for later: the spec separates a **lead summary** (2–4 sentences, pure report — what `scripts/summarise.ts` now produces) from an **interpretation block** ("What this means for [firm]", where firm-specific reasoning is allowed). The summariser currently builds the lead only; the interpretation block is a deliberate later output.

---

## 5. Key decisions & deviations from the original docs

These contradict the build guide / design spec; a fresh chat won't know them.

**Carried over:**
- **Product name is "Sentry"**, which collides with the Sentry error tool. When monitoring is wired up (Week 8), namespace the import (e.g. `SentryMonitoring`).
- **AUSTRAC RSS feed is dead.** Media releases live at `austrac.gov.au/business/updates?field_article_type_terms_target_id=186`, server-rendered Drupal HTML. The Week 6 AUSTRAC adapter scrapes HTML, not RSS.
- **Claude Code installs via npm** (`npm install -g @anthropic-ai/claude-code`), authenticated via the Claude.ai subscription (no `ANTHROPIC_API_KEY` for Code itself).
- **Marketing expanded beyond v0.1 spec** (nav, trusted-by strip, quotes, stats, three tiers, 30-day trial, parliamentary line). Expanded direction is the real one; spec needs a v0.2 (draft amendment exists).
- **Unified `publications` table** with `source_type` discriminator + JSONB `detail`.
- **RLS with the `auth_firm_id()` helper** — the multi-tenant pattern.
- **ACCC + OAIC** added as 7th/8th regulators (broadly applicable). Deferred candidates: AFCA, ATO, RBA, ACMA.
- **Legacy Supabase keys** to match env var names.

**New this session:**
- **Workflow split** — decisions/prompts in the Project chat; building in Claude Code; SQL by hand in the Supabase dashboard; Git commits by hand. Trigger phrase for a paste-ready instruction: _"give me a Claude Code prompt for that."_
- **Admin page uses the service-role client**, deliberately, because there's no auth yet. `/admin/*` ungated until Week 7+.
- **All three Supabase client helpers built**; two (`client.ts`, `server.ts`) are intentionally unused until auth.
- **Model split for Week 5:** Haiku 4.5 classifier (high-volume, cheap, tested-and-kept), Opus 4.8 summariser (customer-facing, quality-critical). Current API model strings: `claude-haiku-4-5-20251001`, `claude-opus-4-8`, plus `claude-sonnet-4-6` as the upgrade option if Haiku underperforms.
- **`ANTHROPIC_API_KEY` is set in the environment** for the Week 5 scripts (Arien has a paid API account separate from the Claude.ai subscription). Never hard-coded; never pasted into an agent chat box.
- **JSON contract for the classifier:** `{ materiality_score, rationale }`, mapping onto the `classifications` columns.

---

## 6. Lessons learned (carried + new)

- **Run every `supabase` command from `~/code/sentry`** (`pwd` first); the CLI acts on the current directory.
- **`supabase db push` will apply an EMPTY migration and mark it done** — `cat` the migration file to confirm its SQL before pushing. To redo one applied empty/wrong: `supabase migration repair --status reverted <version>`, then push again.
- **Never paste secrets into an agent's chat box.** Edit `.env.local` directly. The `service_role` key bypasses RLS (god-mode) and the `ANTHROPIC_API_KEY` is billable.
- **Check the Security Advisor after every schema change.** 0 errors is the bar; the three `SECURITY DEFINER` warnings are benign.
- **A wrong `NEXT_PUBLIC_SUPABASE_URL` returns the Supabase dashboard's HTML, not a clean error.** Symptom this session: the admin page rendered `<title>Supabase</title>` / "Supabase Studio" markup. The correct value is the project API endpoint `https://znmlehevixjdzefzbbos.supabase.co` (no "dashboard", no "api.supabase.com", no trailing path). After editing `.env.local`, **restart `npm run dev`** — Next.js only reads env files at server startup.
- **Not every step is a Claude Code step.** SQL runs in the Supabase dashboard's SQL Editor; Git commits run in a free terminal tab at `~/code/sentry`. Claude Code is only for writing/editing files.
- **Terminal tabs:** one runs `npm run dev` (occupied), one is free for Git/supabase commands, one runs `claude` when in use. Cmd-T for a new tab; `pwd` to confirm location.
- **Watch the LLM for confabulated specifics in prose.** Dates/identifiers are the classic hallucination point; always verify a generated date against the source. (This session: a flagged date turned out to be genuinely in the source — verify against the actual document, not a lossy copy.)
- **Australian dates are day-first (DD/MM/YYYY).** Worth telling any date-parsing logic explicitly when Week 6 adapters start extracting `published_at` from regulator pages.
- **The build guide has known inaccuracies** (assumed joining an existing repo, RSS for AUSTRAC, Homebrew for Claude Code). Reference, not ground truth.

---

## 7. Open items still to decide / fix

- **Replace placeholder marketing content** before launch: fabricated stats ("47 min median latency", "12,400+ briefings") and customer quotes/firm names. The v0.2 amendment recommends removing the stat strip and trusted-by strip until they hold real, attributable figures.
- **Update the design specification to v0.2** (parliamentary scope, three-tier pricing, trial model, the marketing sections v0.1 excluded). Draft amendment ready for the collaborator to merge.
- **Summariser content-priority tuning** (the third-sentence taste point above) — optional, later.
- **Run one genuinely ambiguous classifier test case** before trusting it in production — the two-bank test proved it reasons on a clean case, not on the hard middle.
- **Delete the superseded marketing components** listed in §3.
- **Scope/verify parliamentary data sources** (APH bills register, Hansard, committee submissions, ParlInfo) fresh at the top of Week 6.
- **Verify the seven provisional regulator source URLs/methods** (all except AUSTRAC) when building each adapter.
- **Gate `/admin/*`** once auth exists (Week 7+).
- **Font licensing:** Strichpunkt Sans vs shipping permanently on Space Grotesk.
- **Geometric mark:** pick one. Site uses a text-only wordmark.

---

## 8. The eight-week plan — where we are

Weeks 1–5 **done**. Remaining:

- **Week 6 — Inngest & first adapters:** the three-piece pattern (poll → insert new publications → classify against firms → write briefings). Build the *first* adapter against a clean feed (APRA / TGA / Federal Register) to learn the pattern before the harder AUSTRAC HTML scrape. This is where the Week 5 scripts get wired into a real pipeline: `classify.ts`'s logic becomes the classification step, writing to `classifications`; the summariser feeds `briefings`. Parliamentary feeds are a second category of adapter after the regulators. **Verify each source's real endpoint/method first** (seeded values provisional except AUSTRAC).
- **Week 7 — Stripe:** three tiers (Essentials A$250, Standard A$500, Government A$750) × monthly/annual (annual −10%) + 30-day free trial = 6 prices, plus trial logic and prorated tier-switching. Onboarding chat captures the firm profile and demonstrates before sign-up. Auth/login also lands around here, after which the cookie-based Supabase clients become live and `/admin/*` should be gated.
- **Week 8 — Agentic home & Tracker:** four views (Today, Alerts, Archive, Chat) plus a fifth, **Tracker** (forward-horizon: bills in committee, consultations closing, open submission windows, sunsetting instruments), filtered to the firm and powered by the `event_date`/`status` columns in `publications`. Chat view streams responses and renders inline citations into the provenance pane. Namespace the Sentry error-tool import here.

---

## 9. Next step

Start Week 6. A good opening request for a new chat:

> _"Let's start Week 6. I want to build the first source adapter and the Inngest job pattern: poll a regulator feed, insert new rows into `publications`, classify them against firm profiles, and write briefings. The Week 5 classifier (Haiku 4.5) and summariser (Opus 4.8) work as standalone scripts and need wiring into this pipeline. I want to build the first adapter against a clean feed before tackling the AUSTRAC HTML scrape."_

Before writing any adapter, decide/confirm: which regulator to build first (recommend a clean RSS/API feed — APRA, TGA, or Federal Register — not AUSTRAC); whether to verify that source's real endpoint and ingestion method first (yes); and how the standalone Week 5 scripts get refactored into pipeline steps that read from and write to the database rather than hard-coded test data.

**Working habits to carry over:** decisions and prompts in the Project chat, building in Claude Code, SQL by hand in the Supabase dashboard, Git commits by hand; keep `npm run dev` in one terminal tab and Git in another; run all `supabase` commands from `~/code/sentry` (`pwd` first); `cat` a migration file before `db push`; check the Security Advisor after schema changes; never paste secrets into an agent; commit in small single-purpose changes; read the terminal (it holds the real error) before refreshing; treat design prototypes as references to translate, not code to paste.
