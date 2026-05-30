-- sources: the regulators and parliamentary feeds Sentry ingests from
create table sources (
  id               uuid primary key default gen_random_uuid(),
  agency           text not null,
  source_type      text not null check (source_type in ('regulator', 'parliamentary')),
  ingestion_method text not null check (ingestion_method in ('rss', 'html_scrape', 'api')),
  base_url         text not null,
  active           boolean not null default true,
  created_at       timestamptz not null default now()
);

-- publications: one row per ingested item, unified across both surfaces
create table publications (
  id           uuid primary key default gen_random_uuid(),
  source_id    uuid not null references sources(id),
  source_type  text not null check (source_type in ('regulator', 'parliamentary')),
  external_id  text not null,
  title        text not null,
  url          text,
  published_at timestamptz,
  event_date   date,
  status       text,
  detail       jsonb not null default '{}',
  ingested_at  timestamptz not null default now(),
  unique (source_id, external_id)
);

create index publications_published_at_idx on publications (published_at desc);
create index publications_event_date_idx   on publications (event_date);
create index publications_source_type_idx  on publications (source_type);

alter table sources      enable row level security;
alter table publications enable row level security;

create policy "authenticated can read sources"
  on sources for select to authenticated using (true);

create policy "authenticated can read publications"
  on publications for select to authenticated using (true);