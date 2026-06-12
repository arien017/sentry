-- Pending sign-ups: holds the captured firm profile between checkout and the
-- Stripe webhook that creates the firm. Referenced by id in subscription metadata.

create table if not exists pending_signups (
  id uuid primary key default gen_random_uuid(),
  profile jsonb not null,
  firm_name text not null,
  email text not null,
  tier text,
  interval text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  consumed_at timestamptz,
  constraint pending_signups_status_check
    check (status in ('pending', 'consumed', 'expired')),
  constraint pending_signups_tier_check
    check (tier is null or tier in ('essentials', 'standard', 'government')),
  constraint pending_signups_interval_check
    check (interval is null or interval in ('monthly', 'yearly'))
);

create index if not exists pending_signups_status_created_idx
  on pending_signups (status, created_at);

-- RLS enabled with NO policies: deny-all to authenticated/anon. This is a pre-auth
-- table with no firm to scope by; only the service-role client (which bypasses RLS)
-- accesses it. Do not add policies — deny-all is the intended posture.
alter table pending_signups enable row level security;