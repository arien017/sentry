# Sentry — Session handover #9

**Date:** 18 June 2026
**Covers:** Built the real agentic home read-views surface: the three-pane shell, and the Today, Alerts, and Archive views, all against live regulatory briefings. Plus the summariser model upgrade to claude-opus-4-8 (key access now confirmed).
**Previous handover:** sentry-handover-8.md (magic-link sign-in + webhook welcome email)

**Numbering note:** in-repo handover #9. The handover/session divergence noted since #6 still stands.

---

## What was done this session

Handover #8 left `/home` as a placeholder rendering only email + firm name, with the note that the platform UI begins next. This session built the read-views half of the agentic home: a three-pane shell and three of the five primary views (Today, Alerts, Archive). Chat and Tracker remain unbuilt by deliberate scoping decision (below). Five commits, each single-purpose, all committed by hand; **not yet pushed** as of writing (push the batch at session close).

### The five commits

1. **Shell** (`Add agentic home shell: layout, left rail, shared primitives`)
   - `app/home/layout.tsx`: SERVER component. Auth gate (SSR `getUser()` → redirect `/login`), firm-name lookup via `adminClient` (users.firm_id → firms.name), three-pane frame. Grid is `[220px rail | 1fr children]` — the layout owns ONLY the rail and the children slot. It does NOT own a right/provenance pane; each view supplies its own centre+right island (because the provenance pane is per-view focused-briefing client state).
   - `components/home/LeftRail.tsx`: CLIENT. Five primary views in order — Today, Alerts, Archive (live `next/link`s), Chat, Tracker (present but visibly DISABLED, `--ink-faint`; those views don't exist yet). `usePathname()` marks the active item.
   - Shared anatomy primitives EXTRACTED from `components/MarketingSite.tsx` into `components/home/` and parameterised off live rows: `SourceTag`, `MaterialityDot`, `CitationBlock`, `Interpretation`, `BriefingRow`, plus `components/home/types.ts` (the `BriefingRow` row-shape type matching the live DB join). `MarketingSite.tsx` was left BYTE-IDENTICAL (the originals are still private inner functions there; a later refactor can repoint it — see Deferred).
   - `lib/home/materiality.ts`: all tunable constants in one place — `ALERT_THRESHOLD = 70`, `BAND_HIGH_MIN = 70`, `BAND_ELEVATED_MIN = 40`, and `scoreToBand(score)`. Thresholds are PROVISIONAL, founder-confirmable.

2. **Today** (`Add Today view: firm briefings with provenance pane`)
   - `app/home/today/page.tsx`: SERVER. The four-table nested select (see Schema below), all the firm's briefings, sorted materiality DESC then recency. `app/home/page.tsx` now redirects to `/home/today`.
   - `components/home/BriefingView.tsx`: CLIENT island, prop `briefings: BriefingRow[]`. Named generically (NOT `TodayView`) on purpose — Alerts and Archive reuse it. Internal `[centre list | 340px provenance]` grid; owns `focusedId` state (defaults to first briefing). Centre maps `BriefingRow`s; right pane shows the focused briefing's provenance (agency, title, published date, "View source document" link, "Why this matters" rationale). Written empty/error states.

3. **Alerts** (`Add Alerts view: high-materiality briefings filtered by threshold`)
   - `app/home/alerts/page.tsx`: SERVER. Identical to Today's query/embed/mapping/sort, plus a JS filter `materialityScore >= ALERT_THRESHOLD` after fetch. Reuses `BriefingView`. Alerts-specific empty copy ("No active alerts" — briefings exist but none cleared threshold, distinct from Today's "nothing filed yet").

4. **Archive** (`Add Archive view: full history with search and pagination`)
   - `app/home/archive/page.tsx`: SERVER. Same query, plus search + pagination via URL search params (`?q=`, `?page=`). Current approach: fetch-all + JS filter (summary OR title, case-insensitive) + JS sort + JS paginate (`PAGE_SIZE = 20`). Distinct "No matches" search-empty state.
   - `components/home/ArchiveSearch.tsx`: CLIENT, the only new component. Controlled input + button/Enter (NO `<form>`), pushes `/home/archive?q=…` (resets to page 1), prefills from URL `q`, Clear affordance. Pagination is `next/link` anchors preserving `q`, hidden when `totalPages === 1`.

5. **Model sweep** (`Update summariser model to claude-opus-4-8`)
   - `lib/llm/summarise.ts:33`: `claude-opus-4-7` → `claude-opus-4-8`. The ONLY executable call-site (grep-confirmed). Classifier (`claude-haiku-4-5-20251001`) untouched. Doc/history mentions in CLAUDE.md and docs/ left as historical record.

### CLAUDE.md edit (this session)

The CLAUDE.md block describing the summariser model was updated by hand to state the summariser now runs on `claude-opus-4-8` (key access verified 18 June 2026 by direct curl, 200), replacing the old "targets 4.8 but runs on 4.7 due to access" text. The protective clause now guards against DOWNGRADING to 4.7. (CLAUDE.md describes current state, so it was corrected; the handover docs and the inventory doc keep saying 4.7 as point-in-time records and were NOT changed.)

---

## Key facts learned (schema + architecture)

**The briefings join is four tables, not one.** `briefings` carries no `source_type`, no materiality, no per-view status. The render data is spread:

- `briefings.classification_id → classifications.id` → `materiality_score` (smallint 0–100), `rationale`
- `classifications.publication_id → publications.id` → `title`, `url`, `published_at`, `source_type`
- `publications.source_id → sources.id` → `agency` (the source-tag label, e.g. "APRA")

The PostgREST nested embed (`classifications!inner ( … publications!inner ( … sources!inner ( agency ) ) )`) inferred all three FKs at runtime first-try — no explicit constraint hints needed. This is the proven query; Today/Alerts/Archive all use it identically.

**RLS topology allows SSR-client-only reads (no service-role for view data).** Confirmed policies:

- `briefings`: SELECT, `firm_id = auth_firm_id()`
- `classifications`: SELECT, `firm_id = auth_firm_id()`
- `publications`: SELECT, `true` (any authenticated user)
- `sources`: SELECT, `true` (any authenticated user)

So a single nested SSR select returns ONLY the firm's briefings + their firm-scoped classifications, joined to the readable corpus tables. RLS enforces firm isolation at the database; the views use NO `adminClient` and NO manual `firm_id` filter. (The layout still uses `adminClient` for the firm-NAME display lookup — a separate need.) Note: `briefings` RLS is SELECT-only; writing acknowledgements later will need an UPDATE policy or a service-role path.

**View definitions (these were design decisions, not in the data model):**

- Today = all firm briefings, materiality DESC + recency.
- Alerts = same, `materiality_score >= 70`.
- Archive = all, searchable (title + summary), paginated.
- The `70` threshold and band cuts (≥70 high, 40–69 elevated, <40 routine) are PROVISIONAL constants in `lib/home/materiality.ts`, founder-to-confirm.

**Data reality:** 8 briefings for the test firm. Seven score 72, one scores 62. So Alerts (≥70) shows 7; Today/Archive show 8. The filter was PROVEN live by the 62-row being correctly absent from Alerts and present in Today.

---

## IMPORTANT — the firm-ID / re-pointing situation (record prominently)

The 8 pipeline-seeded briefings belong to a **test firm** (`a545f6e5-46d1-4dcc-9829-2742461321f0`), classified against **Bendigo and Adelaide Bank**'s profile. The logged-in DELOITTE user (`ariena017@gmail.com`) resolves to a DIFFERENT firm (`fe739d35-7c79-47a9-9c5a-2f8ba43702b8`), created via Stripe checkout provisioning. Initially Today showed empty for DELOITTE — RLS correctly returning zero, because the briefings belonged to another firm. (This was POSITIVE evidence firm-isolation works.)

**For local UI testing, the 8 briefings AND their classifications were re-pointed to DELOITTE's firm_id by hand** (both tables — `classifications` is also firm-scoped, so re-pointing only `briefings` would have made the `!inner` join drop every row). The UPDATEs:

```sql
UPDATE briefings SET firm_id = 'fe739d35-…' WHERE firm_id = 'a545f6e5-…';
UPDATE classifications SET firm_id = 'fe739d35-…' WHERE firm_id = 'a545f6e5-…';
```

**Consequence:** DELOITTE now displays Bendigo-authored briefings (the summaries/rationales name Bendigo). The rendering path is proven, but these are NOT genuine DELOITTE briefings. DELOITTE's `firm_profiles.attributes` is the empty `{}` stub from Stripe signup, so the classifier has nothing to reason about for a real run yet.

**This flags a real need:** a clean dev-seed path that creates briefings for whatever firm you're testing as, rather than relying on pipeline data tied to a different firm.

---

## Deferred items / next session

**Build (the two unbuilt views — each its own session by design):**

1. **Chat view** — the most complex view: streaming responses, inline citation rendering, provenance pane that mutates AS the stream arrives, and an UNRESOLVED retrieval-architecture decision (firm-briefings-only substrate now vs full-corpus semantic search later; no vector store stood up). The build guide says pair on this. Model: `claude-opus-4-8` (Opus, customer-facing). Substrate-bounded composition is the core discipline.
2. **Tracker** (Surface eight) — forward-horizon view against HAND-SEEDED FIXTURE data (the fixture schema is the contract future parliamentary adapters must satisfy). Carries the open bill-stage-taxonomy decision (owner: founder; provisional proposal: fine stages `introduced→first_reading→second_reading→in_committee→third_reading→other_chamber→assent` grouped into coarse bands Before Parliament / In Committee / Closing Soon / Sunsetting). Marketing-honesty boundary: nothing may imply live parliamentary coverage.

**Refactor (now ripe — all read views exist):**

3. **Consolidation:** the query + `RawBriefing`/`one()`/`mapRows()` normalization helpers are DUPLICATED across all three page files (Today/Alerts/Archive), plus `BAND_COLOR` (the score→colour map) is duplicated in `BriefingRow` separate from `MarketingSite.tsx`'s `matColor`. A shared `lib/home/briefings.ts` should own the query, the mapping helpers, and the band-colour map, imported by all three views. (Deferred each commit to keep them single-purpose; the consolidation requires touching Today + Alerts + Archive together, so it's its own commit.) Repointing `MarketingSite.tsx` at the shared `components/home/` primitives is the related cleanup.

**Scale limitations (all three read views fetch full sets + work in JS — fine at 8 rows, wrong at thousands):**

4. **Alerts** JS-filters the full set by threshold → should become a DB-side `.gte` on the embedded column (once embedded-filter semantics are runtime-verified) or an indexed query.
5. **Archive** fetches-all then JS-filters/paginates → should become Postgres full-text search (a `tsvector`/`websearch_to_tsquery` index spanning summary+title) with DB-side `.range()` pagination.

**Data / content:**

6. **Inline summary labels:** stored `briefings.summary` text contains literal "SUMMARY:/CITATION:/Source:/Date:" labels that DUPLICATE the structured citation footer in the UI. Fix is summariser-prompt (stop emitting inline labels) or display-cleanup (strip them). Not a view bug.
7. **Dev-seed path** (above) — create briefings for the firm under test.

**Carried from before (still open):**

- Welcome-email `firm_name` interpolated unescaped (small hardening).
- Owned Resend sending domain (sign-in delivery blocker — `resend.dev` shared sender is dropped by Gmail; code path proven via Resend dashboard link).
- Customer portal (`Manage billing` → Stripe portal session) — still unbuilt.
- Summariser line-trace incomplete (4/6 APRA briefings untraced; ADI licensing "31 July 2026" date priority); TGA summary eyeball; one ambiguous classifier test.
- Marketing fabrications (stat strip, trusted-by, placeholder quotes) — spec-mandated removal before launch.
- AUSTRAC deferred (RSS dead; needs HTML scrape adapter).
- Migration history repair before any `supabase db push` (includes `20260612100000`, `20260616090000`).

---

## UX observation (not an action)

When most of a firm's briefings are high-materiality, **Today and Alerts look near-identical** — they share the same high-score top of list, and the only visible difference is the lower-materiality items at the bottom of Today that Alerts excludes. With the current data (7×72, 1×62), Alerts shows 7 and Today shows 8; the distinction is only visible on scroll. This is semantically correct (Alerts is the high-materiality filter), but worth knowing: the "everything vs high-materiality" distinction is only legible when there's a materiality spread.

---

## Tooling change this session

- **Supabase connector** is now connected (consumer connector). DECISION: the SQL-by-hand rule is DELIBERATELY RETAINED — Sentry's SQL still runs by hand in the dashboard, not through the connector (mutating SQL through an agent erodes the boundary; verification-by-hand is how repo/DB drift gets caught). Read-only one-off reads are the only permissible exception, and only when explicitly stated.
- (Considered but note: a read-only, project-scoped Supabase MCP for Claude Code's schema INSPECTION is fine if wired with `--read-only --project-ref=znmlehevixjdzefzbbos`; it must never run mutating SQL/DDL/migrations. Update CLAUDE.md if added.)

---

## Current state summary

- **Agentic home read views:** shell + Today + Alerts + Archive — BUILT, tested in-browser, all five commits made by hand. Render live regulatory briefings via SSR + RLS four-table join. **Push pending** (batch at session close).
- **Summariser:** now on `claude-opus-4-8` (key access confirmed).
- **NOT yet built:** Chat view, Tracker, customer portal.
- **Next session:** Chat OR the consolidation refactor OR Tracker — recommend Chat (the platform's primary surface) or the consolidation (cheap, ripe) first.
- **Design spec:** v0.2 canonical. **Agent rules:** CLAUDE.md (summariser-model line updated this session) + AGENTS.md.
- **Pipeline:** TGA + APRA adapters unchanged and live.

---

## Notion (Sentry HQ) — updated this session

- **Build sessions** → "Session 9 — agentic home read views (shell + Today/Alerts/Archive) + Opus 4.8"
- **Decisions log** → "Session 9 decisions — agentic home read views, SSR+RLS, Opus 4.8, SQL-by-hand retained"
- (Structured properties beyond the title — status/date/relations, if the databases have them — may need setting by hand; the page bodies are complete.)
