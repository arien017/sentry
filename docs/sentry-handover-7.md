# Sentry — Session handover #7

**Date:** 16 June 2026
**Covers:** Week 7 return path: unique Stripe indexes, the Stripe webhook
(provisioning + lifecycle sync + idempotency), and the three post-checkout routes.
End-to-end tested against a real test-mode checkout and a replay.
**Previous handover:** sentry-handover-6.md (v0.2 adoption, pre-webhook decisions)

**Numbering note:** the handover/session divergence from #6 still stands (the TGA
adapter handover remains missing from the collated set). This is in-repo handover #7.

---

## What was done this session

The forward checkout path was already built and verified. This session built and
proved the **return path**: the webhook that consumes a paid checkout and provisions
a firm, plus the pages the buyer lands on afterward.

### Unique Stripe indexes (live + migration)
- Both `firms.stripe_customer_id` and `firms.stripe_subscription_id` had only
  NON-unique indexes. The webhook's conflict-safe firm insert and the lifecycle
  handlers' find-firm-by-subscription-id both assume one Stripe subscription/customer
  maps to at most one firm. Without uniqueness a retry race could double-insert.
- Built two PARTIAL unique indexes live in the dashboard, one statement at a time,
  with CONCURRENTLY (cannot run in a transaction block):
  `firms_stripe_subscription_id_key` and `firms_stripe_customer_id_key`, each
  `WHERE <col> IS NOT NULL`. Verified valid + unique, then dropped the old
  `_idx` indexes. Final state: exactly two indexes, both `_key`, both unique.
- Migration `20260616090000_unique_stripe_indexes.sql` committed. **CONCURRENTLY is
  omitted from the file deliberately** (it can't run inside the transaction that
  `supabase db push` wraps statements in); the file drops the old indexes and creates
  the unique ones plainly, for a fresh-DB rebuild where a brief lock is harmless.
  Add `20260616090000` to the `migration repair --status applied` list.

### The webhook (`app/api/stripe/webhook/route.ts`)
- **D1 resolved: all three events** — `checkout.session.completed`,
  `customer.subscription.updated`, `customer.subscription.deleted`. Completion-only
  would leave every firm `trialing` forever; lifecycle sync is the ~20 lines that keep
  `firms` in step with Stripe.
- **D2 resolved: provision now, sign-in later.** Recon proved Resend is NOT installed
  and there is NO auth-callback route, so option (a) (magic link + email in the
  webhook) was impossible. The webhook provisions the firm and the auth identity but
  sends NO email. Sign-in (Resend + auth-callback + magic link) is a separate task.
- **Provisioning ordering: BUILD-LAST.** Every write is conflict-safe and the
  `pending_signups` consume is the LAST write (step 9), after the users insert. If any
  step throws, the signup stays `pending`, the route returns 500, and Stripe's retry
  re-runs the whole handler cleanly. This is the opposite of consume-first; here we
  WANT the retry.
- Completion handler order: (1) retrieve subscription with price expanded; (2) resolve
  `pending_signup_id` — it lives on `subscription_data.metadata`, NOT session metadata
  (confirmed by reading the checkout route); the handler checks both, session branch is
  dead; (3) READ the signup without consuming (zero rows -> already consumed ->
  200 + stop, idempotent); (4) derive tier via `PRICE_ID_TO_TIER` re-derived from
  Stripe, fall back to the row's tier; `trial_ends_at = trial_end * 1000` (unix
  SECONDS -> ms, mandatory); (5) firm via PRE-SELECT-THEN-INSERT, not upsert — the
  partial unique index can't be matched by supabase-js `onConflict` (would throw
  42P10), so select-by-subscription-id then plain insert, and a concurrent-race unique
  violation propagates to the catch -> 500 -> retry finds the row; NOTE `firms` column
  is `name`, not `firm_name` (the captured name is `pending_signups.firm_name`);
  (6) `firm_profiles` upsert on the FULL unique `firm_id` (`attributes` = profile jsonb
  as-is, single blob); (7) auth identity via `supabaseAdmin.auth.admin.createUser`,
  TOLERATING already-exists (catch, then list-and-match by email) — required for
  build-last retry safety; (8) users row upsert on the PK `id` (= auth user id,
  `role='admin'`); (9) consume the signup LAST.
- Lifecycle handler: the payload IS the subscription. Find firm by
  `stripe_subscription_id`; **if no firm, 200 and do nothing** (a `subscription.updated`
  can race ahead of the completion that creates the firm; completion is the SOLE
  creator). Update `subscription_status`, conditionally `tier`, and **conditionally
  `trial_ends_at` only when `sub.trial_end` is present** — do NOT null it on convert,
  because once a trial converts Stripe sends `updated` with `trial_end = null` and
  nulling would wipe a durable fact (`subscription_status` is the live trialing flag).
  `deleted` sets status to `canceled`.

### Post-checkout routes (three files)
- `app/api/signup/status/route.ts` — public, unauthenticated poll endpoint. Retrieves
  the checkout session, reads its subscription id, service-role looks up the firm,
  returns ONLY `{ status: 'ready' | 'pending' | 'error' }`. Never returns firm id,
  email, or profile. Exists because the browser redirect races the webhook.
- `app/signup/success/page.tsx` — client component, polls `/api/signup/status` every
  2s up to 15 polls (~30s) then times out. States: pending / ready / error / timeout /
  missing (missing derived from absent session_id, not setState-in-effect). Wraps
  `useSearchParams` in `<Suspense>` (App Router requirement). Cleans up the interval on
  unmount. Success copy promises NO email and shows NO login button (neither exists
  yet). Witness-register voice.
- `app/signup/cancelled/page.tsx` — static server component, "no charge made", link
  home.
- All three use existing design tokens (`--ground`, `--ground-raised`, `--hairline`,
  `--ink`, `--ink-mute`, `--display-font`, `.t-title`, `.t-body`) — all confirmed
  present in `app/globals.css`.

### End-to-end test (the real proof)
- No UI calls `/api/checkout` yet (the marketing pricing button is an inert
  placeholder), so the test was curl-driven: curl the checkout route -> it writes a
  `pending_signups` row, creates the Stripe customer, returns a hosted checkout URL ->
  open URL, pay with `4242 4242 4242 4242` -> webhook fires.
- Provisioning verified: one firm row, `name='Webhook Test Pty Ltd'`, `tier=standard`,
  `subscription_status=trialing`, `trial_ends_at` exactly 30 days out (confirms the
  `*1000`), `has_customer/has_sub/has_user` all true, `profile_attrs` populated,
  `role=admin`. Signup flipped to `consumed`.
- Idempotency verified: `stripe events resend <completed event>` returned 200 and did
  NOT create a second firm (hit the already-consumed branch).
- Status route verified by curl: `{"status":"ready"}` with the session id,
  `{"status":"error"}` without one.

### Repo cleanup
- Committed a stray migration `20260612100000_widen_subscription_status_check.sql`
  (the `paused`-status fix from session #6 that the handover claimed was committed but
  was actually still untracked — third repo-vs-handover divergence this session).
- Renamed `docs/handover_1.md` -> `docs/sentry-handover-1.md` (staged both halves
  together so git recorded a rename).

---

## Decisions made

- **D1 = all three webhook events** (above).
- **D2 = provision now, sign-in as a separate task** (above), forced by Resend-absent
  and no auth-callback route.
- **Provisioning ordering = build-last** (consume the signup last; retries self-heal).
- **Firm write = pre-select-then-insert, not upsert** (partial unique index can't be
  matched by supabase-js `onConflict`; would throw 42P10).
- **`trial_ends_at` is a durable fact** — lifecycle handler writes it only when a
  trial_end is present, never nulls it on convert.

---

## Open items / next session

1. **Wire the marketing pricing button to `/api/checkout`.** It is currently an inert
   `<button>` with no onClick/handler/fetch (recon-confirmed). Until this is wired the
   flow is only curl-driven, not clickable end-to-end. This is the gap between "webhook
   proven" and Week 7's stated "testable end-to-end on staging." Small frontend task:
   collect tier/interval/email/firmName/profile (the onboarding chat normally provides
   profile), POST to `/api/checkout`, redirect to the returned `url`.
2. **Sign-in path (deferred from D2):** install Resend SDK, add RESEND_* env keys by
   hand, build an auth-callback route, send a magic-link welcome email from the webhook
   (email failure must stay non-fatal — log and still 200). A `users` row is not a
   login; the auth identity already exists, but there is no way to sign in yet.
3. **Customer portal** (`Manage billing` -> Stripe portal session) — still on the
   backlog, build guide Week 7 piece three.
4. **Seat add-on line item**, `pending_signups` cleanup cron, gate `/admin/*` — all
   still on the Notion backlog, unchanged.

---

## Carried from before (unchanged)

- **Summariser line-trace incomplete:** 4 of 6 APRA briefings untraced; the ADI
  licensing consultation (hard "31 July 2026" date) is the priority. Also owed: eyeball
  TGA summaries for fabricated specifics, and one genuinely ambiguous classifier test.
- **Marketing fabrications** (stat strip, trusted-by strip, placeholder quotes):
  spec-mandated for removal before any real launch.
- **AUSTRAC** still deferred pending its delivery-format redesign; RSS is dead, requires
  HTML scrape.
- **Migration history repair** before any future `supabase db push`: now includes both
  `20260612100000` and `20260616090000`.

---

## Lessons this session (the time-sinks, so they don't recur)

- **`stripe listen` rotates its `whsec_` on every restart.** The signing secret printed
  when `stripe listen` starts is regenerated each time. Restarting that tab invalidates
  the secret in `.env.local`; every event then 400s on signature verification and the
  handler never runs. RULE: whenever you restart `stripe listen`, immediately re-copy
  its `whsec_` into `.env.local` AND restart the dev server. (Cost ~20 min this session.)
- **Edit -> SAVE -> restart, in that order.** A `.env.local` edit left unsaved in the
  editor does nothing; and an edit saved but with the dev server not restarted does
  nothing (Next.js reads `.env.local` only at boot). Both failure modes produced the
  same 400 wall. Verify with `grep STRIPE_WEBHOOK_SECRET .env.local` after saving, then
  restart. (Cost ~15 min.)
- **Webhooks cannot be tested with curl directly** — they need a real Stripe signature.
  curl the *checkout* route to stage the signup and get a URL; the webhook only fires on
  a real browser payment (or `stripe events resend`).
- **Repo is ground truth, again.** `20260612100000` was "committed" per handover #6 but
  was actually untracked. Third divergence. In handovers, "committed" should be read as
  "verify with `git log` before trusting."
- **`session.subscription` is a string OR an expanded object** — handle both shapes
  when reading the subscription id (the status route does).

---

## Current state summary

- **Forward checkout path:** built, tested, committed, verified.
- **Return path (webhook):** BUILT, tested end-to-end, idempotency proven, committed,
  pushed. `firms` kept in sync via three events.
- **Post-checkout pages:** all three built, styled against the real tokens, committed.
- **Not yet clickable end-to-end:** the marketing pricing button is still a placeholder
  (item 1 above).
- **Sign-in:** not built (item 2). Auth identities are created; no login route or email.
- **Design spec:** v0.2 canonical. **Agent rules:** CLAUDE.md + AGENTS.md.
- **Pipeline:** TGA + APRA adapters unchanged and live.
- **Repo synced to origin/main** (after this session's commits + push).
