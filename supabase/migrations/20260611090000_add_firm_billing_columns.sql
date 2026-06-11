-- Add Stripe billing + subscription columns to firms (Week 7 pricing model)
-- Three-tier model: essentials / standard / government, 30-day card-required trial.

alter table firms
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists tier text,
  add column if not exists subscription_status text,
  add column if not exists trial_ends_at timestamptz;

alter table firms
  alter column tier drop not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'firms_tier_check') then
    alter table firms add constraint firms_tier_check
      check (tier in ('essentials', 'standard', 'government'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'firms_subscription_status_check') then
    alter table firms add constraint firms_subscription_status_check
      check (subscription_status in
        ('trialing', 'active', 'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'unpaid'));
  end if;
end $$;

create index if not exists firms_stripe_customer_id_idx on firms (stripe_customer_id);
create index if not exists firms_stripe_subscription_id_idx on firms (stripe_subscription_id);