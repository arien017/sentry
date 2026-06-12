# Sentry — Session handover #5

**Date:** 12 June 2026
**Covers:** Week 7 start — Stripe billing foundation (schema, pricing config, checkout route)
**Previous handover:** sentry-handover-4.md (APRA adapter)

## What was done this session

Pivoted to Week 7 (Stripe). Treated design spec v0.2 three-tier pricing as final
(Essentials $250 / Standard $500 / Government $750 AUD/mo, annual −10%, 30-day
card-required trial). Built the forward checkout path end-to-end; webhook deferred
to next session.

### CLAUDE.md
- Expanded the repo-root CLAUDE.md (git/SQL/secrets/scope/models rules). Committed.
- First test of the git rule: Claude Code stopped without committing on every task
  this session. The rule held.

### Schema (firms billing columns)
- Added stripe_customer_id, stripe_subscription_id, tier, subscription_status,
  trial_ends_at to firms. All nullable. CHECK constraints on tier
  (essentials/standard/government) and subscription_status (Stripe's status strings).
- NOTE: three of these columns pre-existed from an earlier session (repo was ahead of
  handover #4 again). tier had been created NOT NULL by something earlier — dropped the
  NOT NULL this session. Seeded Bendigo firm was on tier='essentials'.
- Migration file: 20260611090000_add_firm_billing_columns.sql (idempotent).

### Stripe dashboard (sandbox, test mode, AUD)
- 4 Products created: Essentials, Standard, Government, Additional Seat.
- 8 Prices (each tier monthly+yearly, seat monthly+yearly). All AUD.
- 8 Price IDs added to .env.local by hand as STRIPE_PRICE_* vars.

### lib/stripe/pricing.ts (committed)
- Tier/Interval types, TIER_PRICE_IDS, SEAT_PRICE_IDS, and PRICE_ID_TO_TIER
  (reverse map DERIVED from TIER_PRICE_IDS so they can't drift; seat IDs excluded).
- Module-load validation throws if any of the 8 env vars missing.

### Schema (pending_signups table — committed)
- New table to hold captured firm profile between checkout and webhook. Keyed by uuid
  (the reference ID that rides in Stripe subscription metadata). Holds profile (jsonb),
  firm_name, email, tier, interval, status (pending/consumed/expired), timestamps.
- RLS enabled, NO policies (deny-all; service-role only). status column is the
  webhook idempotency guard.
- Migration file: 20260612090000_add_pending_signups.sql.

### lib/stripe/client.ts + app/api/checkout/route.ts (committed)
- client.ts: singleton Stripe client, loud-fails on missing STRIPE_SECRET_KEY.
- checkout route: POST accepts { profile, email, firmName, tier, interval }, inserts a
  pending_signups row via the admin (service-role) client, creates a Stripe customer,
  creates a subscription Checkout session with trial_period_days: 30 and the
  pending_signup_id on subscription_data.metadata (NOT session metadata — critical for
  the webhook). Returns the checkout URL.

## Verification done
- Checkout route tested via curl (needs Origin header — derives origin from it, 400 without).
- Returned a valid checkout.stripe.com URL for Standard monthly w/ 30-day trial.
- pending_signups row confirmed written (Test Firm Pty Ltd, status pending).
- STRIPE_SECRET_KEY env var: first call 500'd because dev server started before the key
  was added — restart fixed it. (Pattern: env changes need a dev server restart.)

## Decisions made
- Firm creation sequencing: Option A — create firm on checkout.session.completed (webhook
  is source of truth), NOT on a payment event. Trial means no payment for 30 days, so a
  payment-triggered webhook would never fire for trialing customers.
- Profile transport: reference-ID via pending_signups table (profile too large for Stripe
  metadata's 500-char limit). Only the UUID rides in metadata.
- Trial: applies to chosen tier; Standard-level features gated in-app during trial.
- Seats: separate per-seat Price w/ quantity (two line items), NOT graduated. (Seat line
  item NOT yet added to checkout — base 5 seats only for now.)

## Open items / next session
1. **Build the webhook** (app/api/stripe/webhook/route.ts) — the return path. Needs:
   - Stripe webhook signing secret in .env.local (new secret, by hand).
   - Stripe CLI installed + `stripe listen` to forward events to localhost (can't test
     webhooks with curl — needs a real signed event from Stripe).
   - Signature verification.
   - Idempotency: check pending_signups.status — if already 'consumed', return 200 and
     do nothing (Stripe redelivers events; naive handling = duplicate firms).
   - On checkout.session.completed: read pending_signup_id from subscription metadata →
     look up profile → create firms + firm_profiles + users rows in 'trialing' status →
     set tier (from subscription's actual Price ID via PRICE_ID_TO_TIER), subscription_status,
     stripe_customer_id, stripe_subscription_id, trial_ends_at → send welcome email (Resend)
     → mark pending_signup consumed (set status='consumed', consumed_at=now()).
2. Build the success (/signup/success) and cancelled (/signup/cancelled) redirect pages —
   currently 404 placeholders.
3. Seat add-on line item in checkout (deferred — base 5 seats only currently).
4. Cleanup cron for stale 'pending' pending_signups rows (orphaned when Stripe call fails
   after the insert — expected, not a bug).
5. Customer portal integration ("Manage billing" → Stripe portal session) — build guide
   Chapter X piece three, not yet started.

## Carried from before
- Summariser spot-check still incomplete: 4 of 6 APRA briefings not line-traced
  (ADI licensing consultation w/ "31 July 2026" date is the priority trace).
- Bendigo seeded firm on tier='essentials' — wrong tier to test parliamentary/Tracker
  features against later; consider bumping to 'standard' when feature-gating is built.
- Migration history table: these migrations were applied via dashboard, not `db push`, so
  Supabase's migration history doesn't have rows for them. `if not exists` guards make a
  re-run harmless, but `supabase migration repair --status applied <timestamp>` would make
  the history honest if you ever push.