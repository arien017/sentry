-- Make firms.stripe_subscription_id and firms.stripe_customer_id uniquely indexed.
-- The Stripe webhook's conflict-safe firm insert and the lifecycle handlers
-- (find-firm-by-subscription-id) both assume one Stripe subscription/customer maps
-- to at most one firm. Replaces the prior non-unique indexes.
-- Applied live in the Supabase dashboard on 2026-06-16; this file is the repo record.
-- Partial (WHERE NOT NULL) because both columns are nullable.
-- NOTE: CONCURRENTLY is omitted here intentionally — it cannot run inside the
-- transaction block that `supabase db push` / migration apply wraps statements in.
-- The live dashboard build used CONCURRENTLY; this file is for a fresh-DB rebuild
-- where a brief lock is harmless.

drop index if exists firms_stripe_customer_id_idx;
drop index if exists firms_stripe_subscription_id_idx;

create unique index if not exists firms_stripe_subscription_id_key
  on firms (stripe_subscription_id)
  where stripe_subscription_id is not null;

create unique index if not exists firms_stripe_customer_id_key
  on firms (stripe_customer_id)
  where stripe_customer_id is not null;
