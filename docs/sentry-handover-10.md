# Sentry — Session handover #10

**Date:** 23 June 2026
**Covers:** Built the Chat surface (Surface one's fifth view) end to end: streaming endpoint, multi-turn Chat view, stable inline citations, and a live provenance pane. Plus the deferred consolidation refactor (`lib/home/briefings.ts` + `lib/home/bands.ts`) and a hand-seeded Level 1 dev-seed path for the DELOITTE firm.
**Previous handover:** sentry-handover-9.md (agentic home read views + Opus 4.8 summariser)

**Numbering note:** in-repo handover #10. The handover/session divergence noted since #6 still stands.

---

## What was done this session

Handover #9 left Chat and Tracker unbuilt, the briefings query/helpers triplicated across the three read views, and the test firm (DELOITTE) showing Bendigo-authored re-pointed briefings with no clean dev-seed path. This session: cleared the refactor, built a proper dev-seed, and built the entire Chat surface across four ordered single-purpose prompts plus a regression fix. Everything committed by hand and pushed at session close.

### Commits this session (in order)

1. **Consolidation refactor** (`Consolidate briefings query into shared lib/home module`)
   - Created `lib/home/briefings.ts` owning the four-table nested query, the `RawBriefing`/`one()`/`mapRows()` normalization helpers, and (initially) the `BAND_COLOR` map. Today/Alerts/Archive all repointed to import `fetchBriefings` from it; their local duplicated query/helpers deleted.
   - **Then** extracted `BAND_COLOR` out of `briefings.ts` into a new pure-UI module `lib/home/bands.ts`, because a `'use client'` component (`BriefingRow.tsx`) importing from a server-fetch module was safe only by incidental tree-shaking + type-only-import erasure. `bands.ts` has zero imports (pure UI tokens); `BriefingRow.tsx` now imports `BAND_COLOR` from it and no longer touches the server-fetch module. This is the structural boundary; the prior placement was fragile-but-working.
   - Committed as one commit (the consolidation + bands move are one logical "extract shared briefings module" unit; the broken intermediate never existed in history).

2. **Inventory doc** (`Add agentic home inventory doc`) — `docs/agentic-home-inventory.md`, a prior-turn artifact, committed on its own.

3. **Chat streaming endpoint** (`Add Chat streaming endpoint with substrate-bounded system prompt`) — `app/api/chat/route.ts`.

4. **Chat view** (`Add Chat view: streaming transcript, multi-turn, in-memory state`) — `app/home/chat/page.tsx`, `components/home/ChatView.tsx`, `components/home/LeftRail.tsx` (Chat rail item enabled).

5. **Inline citations** (`Render inline citations as stable per-conversation footnote markers`) — `components/home/ChatView.tsx`.

6. **Provenance pane + multi-turn fix** (`Add live provenance pane: cited-source trailer, numbered sources, click-to-focus`) — `app/api/chat/route.ts` + `components/home/ChatView.tsx`. This commit contains BOTH the prompt-4 provenance work AND the fix for the multi-turn regression it briefly introduced (see "The multi-turn regression" below); the corrected version is what was committed.

---

## The Chat surface (how it works)

**Substrate: Option A (settled).** Chat composes ONLY over the logged-in firm's own briefings — the same firm-scoped set the read views render — and cites only those. No vector store, no retrieval. The firm's entire (small) briefing set is stuffed into the system prompt. Model: `claude-opus-4-8`.

**Security boundary.** The streaming endpoint derives the firm from the SSR session (RLS `auth_firm_id()`). It reads ONLY `messages` from the request body and NEVER accepts a `firm_id` from the client. A user can only ever chat over their own firm's briefings; this is not bypassable via the request body.

**Streaming.** `app/api/chat/route.ts` is a POST taking `{ messages }` (the multi-turn array), calls `claude-opus-4-8` with `stream: true`, and returns a `ReadableStream` enqueuing text deltas as they arrive. Reuses the same inline `new Anthropic()` setup the summariser uses (no shared client module exists in `lib/llm/`; `ANTHROPIC_API_KEY` from env).

**Substrate-bounded system prompt.** Five hard rules: (1) use ONLY the supplied briefings, no outside knowledge; (2) never cite an id not in the supplied set; (3) say "I don't have a briefing on that" when the substrate is silent; (4) cite every claim with the token; (5) witness-register voice. Empty-substrate branch handled. **This was verified at runtime** — Chat correctly refused crypto licensing, stablecoin reserves, ATO R&D incentives (out of scope), and resisted a basic instruction-override nudge, in every case declining to invent rather than fabricating a plausible regulatory claim. This is the product's core thesis, and it holds under real model behaviour.

**Citation contract.** The model cites a briefing by `briefings.id` using the exact token `[[cite:BRIEFING_ID]]` (delimiter-based, regexable, documented in the route header). The model may only emit tokens for supplied ids.

**Inline citation rendering.** Tokens render as superscript footnote-style markers. Numbering is **per-conversation and stable**: each distinct briefing id gets a number the first time it is cited anywhere in the conversation, and keeps that number everywhere in every later message. The id→number map lives in conversation state (persistence-ready). Markers are clickable handles. Unknown/malformed tokens render nothing (silently dropped). Stream-safe: a token split across chunks never flashes a partial marker.

**Provenance pane (Option 1 — endpoint supplies cited-source detail).** After the text stream ends, the endpoint appends a sentinel-delimited JSON trailer (`\u001e` U+001E RECORD SEPARATOR + `{"sources":[...]}`) carrying the display detail of ONLY the briefings actually cited (not the whole set). The client demuxes on the sentinel (robust to chunk splits, never renders the sentinel/JSON as text), maps each cited source to its stable number, and renders the numbered source list in the right pane (agency, title, date, "View source document" link). **Timing (settled): the pane populates at stream COMPLETION**, not mid-stream — the marker numbers already appear live during streaming, and the source detail snaps in when the answer finishes. Clicking marker N focuses/scrolls to/highlights source N. The client fetches NO briefings and sends NO firm_id; all source detail rides the trailer.

**State: in-memory only (Decision 4a).** The message array and the citation-number map live in React state. Multi-turn works within a session (full history sent each turn). **Refresh OR navigating away from Chat wipes the conversation** — accepted for now. Everything is shaped to be persistence-ready (see Deferred).

**Verified in-browser:** streaming renders token-by-token; multi-turn holds past 2 turns; the substrate bound refuses out-of-scope questions; per-conversation numbering is stable across the whole conversation; the multi-source provenance pane shows exactly the cited briefings (4 in the financial-services synthesis test, not all 8) with numbers matching markers; click-to-focus highlights the correct source.

---

## IMPORTANT — the multi-turn regression (record prominently)

Prompt 4 (the provenance trailer) briefly broke multi-turn. **Turn 1 worked; every later turn returned 502 `{"error":"Upstream model error."}`.**

**Root cause:** the finalised assistant message was saved into conversation state using the FULL accumulated stream buffer, which included the `\u001e` sentinel and the `{"sources":...}` trailer JSON. On the next turn the client resends the full history, so that poisoned assistant message went back to the model. The Anthropic API rejects the embedded U+001E control character, so `messages.create` threw → endpoint returned 502. Turn 1 worked because there was no prior assistant message to resend.

**Fix:** finalise the assistant message into state using ONLY the clean text BEFORE the sentinel. The parsed `sources` are stored on the message object as a SEPARATE field (for the pane), never concatenated into `content`. The POST body sends only `{ role, content }` per message, so no control characters or extra data ever reach the model. Verified: a 4-turn conversation now succeeds, pane still populates per answer.

**Lesson (general):** a message that is BOTH displayed AND resent needs the clean version on both paths. Prompt 4's original verification tested DISPLAY correctness (the sentinel never appeared in shown text — true) but did NOT test a multi-turn ROUND TRIP where a finalised assistant message is resent. Testing display ≠ testing resend. When a value is persisted and replayed, test the replay.

---

## IMPORTANT — the dev-seed path is Level 1 (synthetic). Real-pipeline validation is OWED. (record prominently)

To unblock Chat, a dev-seed path was built creating firm-CORRECT briefings for DELOITTE (the logged-in firm, `fe739d35-7c79-47a9-9c5a-2f8ba43702b8`).

**These briefings are Level 1: hand-authored synthetic data. No model produced them.** They prove the rendering/composition plumbing (read views + Chat) against firm-appropriate data. **They prove NOTHING about the classifier (Haiku) or the summariser (`claude-opus-4-8`)** — those were not run. Validating the real classifier/summariser for DELOITTE is **Level 2 work, still owed**, and must be kept separate. Do not mistake seeded data for evidence the models work.

**Scripts (run BY HAND with the service-role key; founder executes, agent never mutates the DB):**
- `scripts/dev-seed-briefings.ts <firm_id>` — requires firm_id as a required arg (no default; exits non-zero without a valid UUID). Upserts a Deloitte-appropriate `firm_profiles.attributes` (conforms to the real base keys discovered from the live Bendigo row: name/size/type/sectors, extended with descriptive keys), then seeds 6–8 coherent `(publication, classification, briefing)` triples, all firm-scoped, materiality spread across bands (3 high ≥70, 3 elevated 40–69, 2 routine <40), agencies varied across existing `sources` rows (errors if an agency source is missing rather than inventing one). Idempotent: deletes its own prior synthetic rows first. `source_type='regulator'` only (no parliamentary).
- `scripts/dev-unseed-briefings.ts <firm_id>` — deletes the synthetic chain (briefings → classifications → publications) by marker, firm-scoped, FK-safe. Leaves the firm profile intact (a manual reset one-liner is in the header).

**Synthetic-data marker (canonical signal — use this to identify/purge seeded rows):**
`publications.url` prefixed `https://seed.local/<firm_id>/` AND `classifications.model_version = 'dev-seed'`. The `model_version = 'dev-seed'` value doubles as honest provenance: any inspection of these rows immediately shows they did not come from a real model run. **Purge all synthetic rows via the unseed script before any real pipeline run or before going near production data.**

**Run commands (service-role key from env, never committed):**
```
NEXT_PUBLIC_SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… \
  npx tsx scripts/dev-seed-briefings.ts fe739d35-7c79-47a9-9c5a-2f8ba43702b8
NEXT_PUBLIC_SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… \
  npx tsx scripts/dev-unseed-briefings.ts fe739d35-7c79-47a9-9c5a-2f8ba43702b8
```

### Cleanup of the session-9 re-pointed Bendigo rows (done this session)

Session 9 hand-re-pointed 8 Bendigo briefings + classifications onto DELOITTE for UI testing. The dev-seed's cleanup is marker-scoped, so it correctly did NOT touch those un-marked rows — after seeding, DELOITTE showed BOTH populations (8 seed + 8 old Bendigo), and Alerts showed too many. **The old re-pointed population was deleted by hand** (briefings + classifications where `model_version IS DISTINCT FROM 'dev-seed'` for DELOITTE's firm_id; the real `publications` rows were left, as they are genuine pipeline data other firms may reference). After deletion DELOITTE holds exactly 8 clean, marked, firm-correct seed briefings. Today shows 8, Alerts shows 3 (the 88/76/71).

---

## Deferred items / next session

**Build:**
1. **Tracker** (Surface eight) — the only unbuilt agentic-home view. Forward-horizon view against HAND-SEEDED FIXTURE data (the fixture schema is the contract future parliamentary adapters must satisfy). Open bill-stage-taxonomy decision (owner: founder; provisional proposal: fine stages `introduced→first_reading→second_reading→in_committee→third_reading→other_chamber→assent` grouped into coarse bands Before Parliament / In Committee / Closing Soon / Sunsetting). Marketing-honesty boundary: nothing may imply live parliamentary coverage.

**Deferred — Chat conversation persistence (4a → 4c):** Currently in-memory client state only; refresh/navigation wipes the conversation. Owed follow-up: database-backed `conversations` + `messages` tables, firm-scoped, **each needing RLS policies** (we have been bitten by missing policies and by the four-table join dropping rows on inconsistent firm-scoping — design carefully). The message array and citation-number map are already persistence-ready (clean `{ role, content }` + a separate `sources` field per message + the id→number map in conversation state); persistence is "write this known-stable shape to a table and read it back on load," not a refactor. Also requires the migration-history repair (below) before any `supabase db push`.

**Deferred — Chat retrieval Option B:** Full-corpus semantic search / vector store, so Chat can answer about non-briefed publications (not just the firm's briefing set). Explicitly deferred until real usage demonstrates the non-briefed-publication gap is a genuine customer problem. Adding it later is "swap the retrieval function"; the streaming/citation/provenance primitives are substrate-agnostic.

**Deferred — Level 2 pipeline validation:** Run real ingested publications through the live classifier + summariser against DELOITTE's profile to produce genuine briefings. Separate from the Level 1 dev-seed. Purge synthetic rows first (marker above).

**Chat polish:**
2. **Markdown renders as literal asterisks.** The model emits `**bold**` headers; the transcript renders plain text, so asterisks show literally (pronounced on heavily-structured grouped answers). **Recommended fix: instruct the model in the system prompt to write plain declarative prose without markdown**, rather than adding a markdown renderer — the witness register favours plain prose over headers/bold anyway. (Note: this is the same family as the read-view stored-summary label issue from #9; this one is Chat-output-side.)
3. **Citation defensive edge (harmless, contained):** marker numbers are assigned live from any UUID-shaped `[[cite:ID]]` in the stream, while the pane lists only cited-AND-supplied briefings (the trailer). If the model ever cited a UUID-shaped id NOT in the supplied set (system prompt forbids it), its marker would show a number with no pane row → clicking focuses nothing. To close fully: assign marker numbers only to ids that survive into the trailer. Not worth it now.
4. **`max_tokens: 1024`** on the endpoint — fine for the small briefing set; bump if real firms' answers truncate.

**Scale limitations (carried from #9, still open — all three read views fetch full sets + filter/paginate in JS):**
5. **Alerts** JS-filters by threshold → should be a DB-side `.gte` or indexed query.
6. **Archive** fetches-all then JS-filters/paginates → should be Postgres full-text search + DB-side `.range()`.

**Carried from before (still open):**
- **Migration-history repair before any `supabase db push`** (includes `20260612100000`, `20260616090000`). Blocks the persistence tables and any other schema push. Nothing this session touched migrations.
- Stored `briefings.summary` text contains literal `SUMMARY:/CITATION:/Source:/Date:` labels duplicating the structured citation footer (display-cleanup or summariser-prompt fix). Seed summaries are clean of these; this is the real pipeline data.
- Owned Resend sending domain (sign-in delivery blocker — `resend.dev` shared sender dropped by Gmail).
- Customer portal (`Manage billing` → Stripe portal session) — still unbuilt.
- Welcome-email `firm_name` interpolated unescaped (small hardening).
- AUSTRAC deferred (RSS dead; needs HTML scrape adapter at `austrac.gov.au/business/updates?field_article_type_terms_target_id=186`).
- Summariser line-trace incomplete; one ambiguous classifier test.
- Marketing fabrications (stat strip, trusted-by, placeholder quotes) — spec-mandated removal before launch.

---

## Current state summary

- **Agentic home:** shell + Today + Alerts + Archive + **Chat** — BUILT and tested in-browser. Tracker is the only unbuilt view.
- **Chat:** streaming, multi-turn, substrate-bounded composition, stable inline citations, live provenance pane — COMPLETE and verified. In-memory state (persistence deferred).
- **Briefings query/helpers:** consolidated into `lib/home/briefings.ts`; band-colour map in pure-UI `lib/home/bands.ts`.
- **DELOITTE test firm:** 8 clean Level-1 synthetic briefings + a Deloitte-appropriate profile (marker: `seed.local` URL prefix + `model_version='dev-seed'`). Old Bendigo re-pointed rows deleted.
- **Summariser:** `claude-opus-4-8`. **Classifier:** `claude-haiku-4-5-20251001`. **Chat:** `claude-opus-4-8`.
- **All session commits pushed.** No `supabase db push` (migration repair still pending; no schema change this session).
- **Design spec:** v0.2 canonical. **Agent rules:** CLAUDE.md + AGENTS.md.

---

## Notion (Sentry HQ) — updated this session

- **Build sessions** → "Session 10 — Chat surface (streaming + citations + provenance), consolidation refactor, Level 1 dev-seed"
- **Decisions log** → "Session 10 decisions — Chat substrate Option A, per-conversation citation numbering, Option 1 provenance trailer, in-memory state (4a), Level 1 dev-seed"
- **Open items** → Tracker; Chat persistence (4c); Chat Option B semantic search; Level 2 pipeline validation; markdown-in-Chat polish; citation defensive edge; migration-history repair
- (Structured properties beyond the title — status/date/relations — set by hand in Notion; page bodies are complete.)
