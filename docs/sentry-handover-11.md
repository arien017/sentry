# Sentry build session handover #11

**Date:** 24 June 2026
**Session focus:** Tracker (Surface 8), migration-history repair, Chat markdown discipline
**Branch state at close:** `main` == `origin/main` at `ec23554` (pushed, clean tree)

---

## What shipped this session (three deliverables, all verified against ground truth)

### 1. Tracker — Surface 8, the fifth and final agentic-home view

The home is now structurally complete across all five views (Today, Alerts, Archive, Chat, Tracker).

Built against a dedicated `tracker_items` table (decision below), seeded with hand-authored fixture data, browser-verified with all five bands rendering and the provenance pane working.

Commits, in order:
- `324191d` Add tracker_items table with stage constraint and RLS
- `221de49` Add Tracker dev-seed and unseed scripts
- `e139cf5` Add Tracker query module and label helpers
- `d80cea7` Add Tracker view, row, and client island (Surface 8)
- `cbdb402` Enable Tracker in home left rail

Files: `supabase/migrations/20260623090000_tracker_items.sql`, `scripts/dev-seed-tracker.ts`, `scripts/dev-unseed-tracker.ts`, `lib/home/tracker.ts`, `lib/home/tracker-labels.ts`, `components/home/TrackerRow.tsx`, `components/home/TrackerView.tsx`, `app/home/tracker/page.tsx`, `components/home/LeftRail.tsx` (modified).

Schema shape (the contract — see decisions): `tracker_items` carries firm_id (RLS via auth_firm_id, select-only for authenticated, writes service-role only), source_id (nullable: parliamentary rows null, regulator rows FK to sources), source_type, item_type, stage (12-value CHECK), title, relevance, materiality_score, horizon_date, window_opens, window_closes, url, detail (jsonb), is_closed, timestamps.

Verified live: 11 seeded rows for DELOITTE (firm fe739d35-7c79-47a9-9c5a-2f8ba43702b8), band spread Before Parliament 3 / In Progress 3 / Closing Soon 3 / Sunsetting 1 / Closed 1, materiality 38–82 with 4 rows >=70, zero em dashes in titles/relevance (cleaned), all 11 carrying the dev-seed-tracker marker, source-type discipline intact (6 parliamentary null source_id, 5 regulator with source_id).

### 2. Migration-history repair — db push unblocked

Diagnosed: the remote `supabase_migrations.schema_migrations` table recorded only the first five (`20260530...`) migrations. The five hand-applied-via-SQL-Editor migrations (`20260611090000` add_firm_billing_columns, `20260612090000` add_pending_signups, `20260612100000` widen_subscription_status_check, `20260616090000` unique_stripe_indexes, `20260623090000` tracker_items) existed as local files and as live schema but were absent from remote history, because hand-applying in the Editor does not write a schema_migrations row. That is what jammed `db push`.

Fixed non-destructively with `supabase migration repair --status applied` for the five missing versions — annotates history, does not re-run SQL, does not touch schema, no data risk. Verified: `migration list` shows all ten reconciled (both Local and Remote populated); `db push` reports "Remote database is up to date." Local files, remote history, and live schema are now one consistent truth.

### 3. Chat plain-prose rule — literal markdown suppressed

The Chat system prompt's VOICE rule governed tone but said nothing about format, so the Opus model was free to emit markdown (literal asterisks/hashes) that the Chat view renders raw (it has no markdown processor — only the citations.ts segmenter for `[[cite:ID]]` tokens). Added rule 6 to `buildSystemPrompt` in `app/api/chat/route.ts`: plain prose only, no markdown syntax, with an explicit carve-out preserving the `[[cite:BRIEFING_ID]]` citation token.

- `ec23554` Add plain-prose no-markdown rule to Chat system prompt

Tested empirically against a hostile prompt that demanded bullets, bold, a heading, and numbering — all four banned. Result: clean plain prose, zero markdown, citations preserved (superscripts 1–5 rendered, provenance pane populated all five cited briefings). The carve-out worked: formatting suppressed without suppressing the token.

**Note:** this rule is the INTERIM state. Chat formatting decision is Option A (render real markdown), deferred to next session. When Option A lands, rule 6 gets relaxed to permit markdown syntax in the same logical change as the renderer.

---

## Also done

- **Service-role key rotated.** The key was exposed in plaintext in a screenshot uploaded mid-session. Rotated in the Supabase dashboard. (Old key is dead; .env.local updated by hand.)
- **Two pieces of previously-uncommitted work recovered and committed.** A `git status` check at commit time revealed three finished files that had been sitting untracked since prior sessions: the briefings seed scripts (`78f9d3e` Add briefings dev-seed and unseed scripts) and the Chat citation parser (`8cec3ab` Add Chat citation token parser). Until tonight these existed nowhere but the local disk.

---

## Design decisions settled this session (Decisions log)

1. **Tracker data lives in a dedicated `tracker_items` table, not a fixture file.** Rationale: a Tracker item is a genuinely different data model from a briefing — mutable by design (stage advances over time), forward-dated, and it spawns a briefing in Today when its process completes. Overloading publications/briefings would be fragile. A dedicated RLS-scoped table reads exactly like the other views and makes the contract explicit. **The table schema IS the contract future parliamentary adapters must satisfy.**

2. **Bill-stage taxonomy: two-level, 12 fine stages + 5 derived bands.**
   Fine stages (CHECK constraint): introduced, first_reading, second_reading, in_committee, third_reading, other_chamber, assent, consultation_open, submissions_open, inquiry_active, sunsetting, closed.
   Item types: bill, inquiry, consultation, instrument.
   Bands (derived in query helper, NOT stored): Closed (is_closed OR stage in assent/closed) → Closing Soon (date-driven: window_closes ?? horizon_date within 14 days, OVERRIDES stage bands) → Sunsetting (stage=sunsetting) → Before Parliament (introduced/first_reading/consultation_open) → In Progress (everything else). Order matters: Closed overrides all; Closing Soon overrides remaining stage bands.
   Soft edge flagged: inquiry_active vs submissions_open can overlap; both kept to represent an inquiry past its submission deadline but still hearing evidence. Revisit once real parliamentary adapters exist.
   Display: band is the group header, fine stage is the row indicator (both shown). How much of the fine stage to collapse vs surface remains a display-level call, not a schema call.

3. **Chat formatting: Option A chosen (render real markdown), DEFERRED to next session as its primary task.** Option B's plain-prose rule shipped as the interim. Rationale for deferring A: it is a streaming-parser composition task (markdown renderer must coexist with the citations.ts stream-safe segmenter — partial markers mid-stream, citation superscripts inside formatted runs) — the riskiest code in the area, wants a fresh session with full focus and a clean opening verification pass, not the tail of a long session.

---

## Next session — headline task (scoped)

**Option A: render markdown in the Chat stream.**

Design context to carry (do not re-derive):
- The renderer must compose with the existing `components/home/citations.ts` stream-safe segmenter WITHOUT conflict. citations.ts holds back trailing partial `[[cite:` tokens so half-formed markers never render; a markdown parser expects complete documents and is not stream-safe by default. The two parsers share one delta-by-delta token stream.
- Edge cases to design for: a `**` arriving split across two deltas; a citation superscript landing inside a bolded or list-item run; the U+001E source trailer at stream end must not be fed to the markdown parser.
- When the renderer lands, RELAX rule 6 in `app/api/chat/route.ts` to permit markdown syntax — do this in the SAME logical change as the renderer, so the prompt and the render path move together.
- This is the riskiest streaming work in the Chat surface. Open the session with a verification pass, scope it carefully, pair on it.

---

## Open items carried forward (priority order)

1. **Em-dash cleanup in the Chat system prompt string.** Two em dashes remain in `app/api/chat/route.ts` prompt text (rule 5 trailing paragraph, and the one carried into rule 6). Shipped prompt content; founder discipline is no em dashes. Quick fix, fold into the Option A commit or do standalone.
2. Resend domain setup.
3. Customer portal.
4. Alerts/Archive DB-side filtering — still JS-side. Fine at current volume; must move before real data volume.
5. AUSTRAC adapter — first real-pipeline ingestion. Unlocks Level-2 pipeline validation (real Haiku classifier + Opus summariser end-to-end, not synthetic dev-seed).
6. Em-dash cleanup verification in seeded Tracker titles (now done in seed; confirm no regression if re-seeded).

On the horizon (unchanged): Chat persistence (conversations/messages tables with RLS), Chat retrieval Option B (full-corpus semantic search / vector store), Level-2 pipeline validation, parliamentary ingestion adapters (the tracker_items schema is their contract).

---

## Process lessons (worth recording)

1. **Session close needs a `git status` check.** Three finished files (briefings seed, unseed, Chat citation parser) sat untracked from prior sessions and surfaced only because we looked at commit time. Add `git status` (confirm nothing finished is untracked) to the session-close ritual alongside the handover commit and Notion update.

2. **Hand-applied migrations need a `migration repair --status applied <version>` afterward, or remote history re-drifts.** This is the new standing rule paired with "all SQL is hand-applied in the Editor then saved as a migration file." Hand-apply, save the file, AND repair-mark the version — otherwise `db push` jams again over time.

3. **Ground truth over handover docs, again proven.** The session-open verification caught `classifications.materiality_score` (not `materiality`) before it entered any query, and the `git status` check caught the three uncommitted files and the wrong file-path assumption in the commit plan (TrackerView.tsx lives in components/home/, not app/home/tracker/). Verify, do not assume — every session.

---

## State summary at close

- All five agentic-home surfaces built. Home structurally complete.
- `tracker_items` table live, RLS-scoped, 11 fixture rows for DELOITTE, schema is the parliamentary-adapter contract.
- Migration history reconciled; `db push` available and accurate.
- Chat emits plain prose (interim); Option A markdown rendering is next session's headline.
- Service-role key rotated.
- 8 commits this session, all pushed; `main` == `origin/main` at `ec23554`; working tree clean.
