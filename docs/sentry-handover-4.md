# Sentry — Session handover #4

**Date:** 11 June 2026
**Covers:** Week 6 continuation — second source adapter (APRA HTML scrape)
**Previous handover:** sentry-handover-3.md (TGA adapter + Inngest pipeline)

---

## What was done this session

Built the **APRA source adapter** — the second regulator adapter and the first HTML-scrape adapter (TGA was clean RSS). The three-function Inngest pipeline (poll → classify → briefing) was reused unchanged; only the ingestion/poll step is APRA-specific. Committed locally as `79c80da` (6 files). **Not pushed** — confirm GitHub state next session (see open items).

### APRA adapter specifics

- **Source:** `https://www.apra.gov.au/news-and-publications` — server-rendered Drupal 10, full item list present in HTML, `www.` required. No RSS feed exists (email-only via MailChimp), so HTML scrape is the confirmed and only approach.
- **Parser:** `cheerio` (added as a dependency this session), not regex.
- **Listing selectors (verified against live page, 21 items parsed, zero incomplete):**
  - Item container: `div.views-row`
  - Title: `h4` text
  - Detail URL → `external_id`: `a.tile__link-cover` href (relative, percent-encoded; prefixed with `https://www.apra.gov.au`)
  - Date: `time[datetime]` attribute — full ISO 8601 with +10:00 offset (e.g. `2026-06-04T10:50:57+10:00`). Parsed from the ISO value directly; "D Month YYYY" display text kept only as fallback. **This sidesteps the day-first date-parsing trap entirely.**
  - Category: field block text ("Media Releases", "Speeches", "Opening statements", etc.) — stored in `detail.category`
- **Detail-page body extraction:** selector `.block-field-blocknodenews-itembody`. Chosen because it occurs exactly once per page and is in the same Drupal layout-builder field-naming family as the listing's field blocks (structural CMS field name, not a brittle theme class). Verified clean on two different detail pages: pure release content, no breadcrumb/nav/Print-Email chrome/related-links/sidebar. `<p>` elements joined with blank lines so the classifier/summariser get readable paragraph breaks (cheerio `.text()` otherwise runs paragraphs together). Body stored in `detail.body`.
- **Ingestion scope:** first (unparam'd) listing page only — most recent items. Pagination is `?page=1`, `?page=2` etc. No backfill.
- **Politeness:** descriptive browser-like User-Agent (default SentryBot UA is blocked by APRA); small delay between detail-page fetches. Low-frequency poll.

### Change to shared pipeline code

`classifyNewPublication` and `createBriefing` (in `lib/inngest/functions.ts`) were extended to **prefer `detail.body`, fall back to `detail.description`**. The TGA path (which uses `detail.description` from RSS) is unaffected — a TGA item with no `body` still classifies on its `description`. One-line change in each. Confirmed working: TGA continued ingesting/classifying through this session with no regression.

---

## Verification results

All three planned checks passed on the IRB test case:

1. **IRB item `detail.body`** — clean and complete (1,508 chars, proper paragraphs, no chrome). Confirms the body selector generalises beyond the single page tested during inspection. `published_at` 2026-06-04 (correct AEST→UTC conversion from the datetime attr).
2. **Classification crossed threshold** — IRB scored **72/100** against the seeded Bendigo profile (vs ~82 from the Week 5 hard-coded profile; the seeded profile is leaner, no "growth-focused" context — this accounts for the gap and is expected). Crossed 60, produced a real briefing. **This is the first time the threshold-crossed → summariser path ran on relevant content** — the gap carried since the TGA build is now closed.
3. **Briefing summary substrate check** — traced every concrete claim in the IRB summary back to `detail.body`. No fabricated dates, no invented specifics, no editorialising. The summariser even declined to repeat the source's own "boost competition" framing. **The fabricated-date failure mode caught earlier today did not recur.**

### Second briefing verified (System Risk Outlook, 21 May 2026)

Manually traced summary-vs-body. **Clean.** Notably: the source gave vague timing ("next edition... towards the end of the year") and the summariser **preserved the vagueness rather than inventing a date** — the exact good behaviour that was failing this morning. Lonsdale's attributed commitments traced near-verbatim to the body (the highest-fabrication-risk element, and it held).

### Outstanding verification gap (carried forward)

**6 briefings fired on this run**, only **2 are fully verified** (IRB, System Risk Outlook). The other 4 — ADI licensing consultation, macroprudential settings, three-tiered proportionality, APS 221 FAQs — read as consistently sourced on a spot-check but were **not** line-traced. Do not treat the summariser as confirmed-clean across all content types yet. **Best next check: the ADI licensing consultation** (contains a hard "31 July 2026 submissions" deadline — a hard date is more fabrication-prone than the System Risk Outlook's soft "end of year" timing).

---

## DECISION MADE THIS SESSION: Git workflow enforcement

Claude Code has now **auto-committed twice** against the standing hand-commit rule (TGA session: `4ab54c1`; this session: `79c80da`). Both bundled multiple file groups into one commit, violating the single-purpose rule too. Restating the rule per-prompt has not worked — it does not persist across sessions.

**Decision: enforce it durably via a `CLAUDE.md` file in the repo root**, which Claude Code reads every session. Prompt-by-prompt instruction is abandoned as ineffective.

**First action next session — create `~/code/sentry/CLAUDE.md` containing (at minimum):**

```
# Working rules for Claude Code on this repo

## Git — STRICT
- NEVER run git add, git commit, git push, or any git command that writes.
- Git is done by hand by the founder, after reviewing diffs.
- Commits are single-purpose: one logical change per commit, file groups committed separately.
- When work is complete, STOP. Report what changed and let the founder commit. Do not offer to commit; do not commit "as a convenience."

## Database / SQL
- NEVER run SQL against the database. Output SQL for the founder to run in the Supabase dashboard.

## Scope
- Do not make architectural decisions. If a pattern in the repo seems wrong, flag it — do not change it unilaterally.
```

(Expand as needed — this is the floor, not the ceiling.)

---

## Current pipeline state

- **Two live adapters:** TGA (RSS, clean) and APRA (HTML scrape). Both run through the same poll → classify → briefing chain.
- **`publications` table ~71 rows** — mostly TGA, because the TGA hourly cron backfills its feed whenever the dev servers are up. Dedup holds (no duplicates). Expected behaviour. **Note for later:** a bank-only firm ingesting/classifying TGA pharma alerts is the first concrete instance of the per-firm source-filtering problem flagged in the design spec — not a now-problem, but the table is now mostly noise relative to the one seeded firm.
- **Seeded test firm:** Bendigo and Adelaide Bank (firm + firm_profile rows, inserted via dashboard). Profile is leaner than the Week 5 hard-coded one — scores will differ from Week 5 numbers; hold the profile constant if comparing scores across runs.
- **Firm-specificity confirmed in the mid-range too:** Xinja FAR disqualification scored 42, monthly ADI statistics 35 — i.e. the classifier discriminates, not just pass/fail at the threshold.

---

## Open items / next session

1. **Create `CLAUDE.md`** (above) — first thing, before any new Claude Code work.
2. **Confirm GitHub state** — this session's commit reportedly not pushed; verify with `git log origin/main` what's actually on the remote vs local.
3. **Finish the summariser spot-check** — line-trace at least the ADI licensing consultation briefing (the "31 July 2026" date); ideally 2–3 of the remaining 4.
4. **Decide direction:** either a third HTML-scrape adapter to keep hardening the pattern, or pivot to **Week 7 (Stripe three-tier pricing + sign-up/auth)**. AUSTRAC remains deprioritised — its updates page carries a live "changes to how updates are delivered are coming soon" notice, so selectors written now are likely to break; revisit once its new delivery format ships (it may even become a clean feed/API, which would make any scraper written now wasted work).

---

## Model note (unchanged from #3)

Summariser targets `claude-opus-4-8` per spec; running on `claude-opus-4-7` because the API key lacks 4.8 access. **4.8 exists** — this is an access constraint, not a "model doesn't exist" situation (Claude Code asserted the latter; it was wrong, its training predates 4.8). Do not edit the spec to call 4.7 the latest Opus. Upgrade to 4.8 if/when the key gains access.

## Source-feed reference (verified this session)

- **APRA:** no RSS, email-only (MailChimp). HTML scrape, Drupal 10. Confirmed working.
- **TGA:** clean RSS (combined alerts feed `https://tga.gov.au/feeds/alert.xml`). Confirmed working.
- **AUSTRAC:** HTML scrape (`https://www.austrac.gov.au/business/updates`, note `www.`, drop the `?field_article_type_terms_target_id=186` filter from old notes). Server-rendered, scrapable — BUT redesign of update delivery announced. Deprioritised.
- **Federal Register of Legislation (AU):** machine-readability still unconfirmed. The clean REST API that web searches surface is the US `federalregister.gov` — wrong country. Verify the Australian `legislation.gov.au` separately before building; do not let an agent wire up the US endpoint.
- **ASIC, AER, ACCC, OAIC:** unverified. Check each when built.
- **Parliament (`aph.gov.au`):** has RSS — relevant when the parliamentary surface (design spec v0.2) is built.
