-- per-firm identity & tenancy. these carry firm_id and are scoped by RLS.

create table firms (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  tier               text not null default 'essentials'
                       check (tier in ('essentials', 'standard', 'government')),
  stripe_customer_id text,
  trial_ends_at      timestamptz,
  created_at         timestamptz not null default now()
);

-- a user links a Supabase auth account to a firm. users.id IS the auth user's id.
create table users (
  id         uuid primary key references auth.users(id) on delete cascade,
  firm_id    uuid not null references firms(id) on delete cascade,
  email      text not null,
  role       text not null default 'member' check (role in ('member', 'admin')),
  created_at timestamptz not null default now()
);
create index users_firm_id_idx on users (firm_id);

-- one structured profile per firm; the classifier reads this to score materiality
create table firm_profiles (
  id         uuid primary key default gen_random_uuid(),
  firm_id    uuid not null unique references firms(id) on delete cascade,
  attributes jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- helper: the firm_id of the currently signed-in user.
-- security definer so it bypasses RLS on `users` — without that, a policy ON
-- users that READS users would recurse infinitely.
create or replace function auth_firm_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select firm_id from users where id = auth.uid()
$$;

alter table firms         enable row level security;
alter table users         enable row level security;
alter table firm_profiles enable row level security;

create policy "read own firm"
  on firms for select to authenticated
  using (id = auth_firm_id());

create policy "read firm members"
  on users for select to authenticated
  using (firm_id = auth_firm_id());

create policy "read own firm profile"
  on firm_profiles for select to authenticated
  using (firm_id = auth_firm_id());