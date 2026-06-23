-- 20260623090000_tracker_items.sql
-- Surface eight (Tracker): forward-horizon items. Firm-scoped, RLS-isolated.
-- Mutable by design (stage advances over time), unlike immutable briefings.
-- Fixture schema = the contract future parliamentary adapters must satisfy.

create table if not exists public.tracker_items (
  id            uuid primary key default gen_random_uuid(),
  firm_id       uuid not null references public.firms(id) on delete cascade,
  source_id     uuid references public.sources(id),
  source_type   text not null
                  check (source_type in ('regulator','parliamentary')),
  item_type     text not null
                  check (item_type in ('bill','inquiry','consultation','instrument')),
  stage         text not null
                  check (stage in (
                    'introduced','first_reading','second_reading','in_committee',
                    'third_reading','other_chamber','assent',
                    'consultation_open','submissions_open','inquiry_active',
                    'sunsetting','closed'
                  )),
  title         text not null,
  relevance     text not null,
  materiality_score smallint not null default 0
                  check (materiality_score >= 0 and materiality_score <= 100),
  horizon_date  date,
  window_opens  date,
  window_closes date,
  url           text,
  detail        jsonb not null default '{}'::jsonb,
  is_closed     boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists tracker_items_firm_idx        on public.tracker_items (firm_id);
create index if not exists tracker_items_firm_stage_idx   on public.tracker_items (firm_id, stage);
create index if not exists tracker_items_firm_horizon_idx on public.tracker_items (firm_id, horizon_date);

alter table public.tracker_items enable row level security;

drop policy if exists tracker_items_select_own on public.tracker_items;
create policy tracker_items_select_own
  on public.tracker_items
  for select
  to authenticated
  using (firm_id = public.auth_firm_id());

-- No insert/update/delete policy for `authenticated`: writes are service-role only
-- (seed script, and later the parliamentary adapters), exactly like briefings.