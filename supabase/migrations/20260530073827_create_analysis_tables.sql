-- the per-firm analysis layer. all three carry firm_id and are RLS-scoped.

   -- classifications: one row per (publication, firm) — the bridge between the
   -- shared corpus and a firm's private assessment.
   create table classifications (
     id               uuid primary key default gen_random_uuid(),
     firm_id          uuid not null references firms(id) on delete cascade,
     publication_id   uuid not null references publications(id) on delete cascade,
     materiality_score smallint not null check (materiality_score between 0 and 100),
     rationale        text,
     model_version    text,
     created_at       timestamptz not null default now(),
     unique (firm_id, publication_id)
   );
   create index classifications_firm_id_idx        on classifications (firm_id);
   create index classifications_publication_id_idx on classifications (publication_id);

   -- briefings: one row per classification that crossed the threshold and got delivered.
   create table briefings (
     id                uuid primary key default gen_random_uuid(),
     firm_id           uuid not null references firms(id) on delete cascade,
     classification_id uuid not null references classifications(id) on delete cascade,
     channel           text not null check (channel in ('digest', 'alert')),
     summary           text not null,
     delivered_at      timestamptz,
     created_at        timestamptz not null default now()
   );
   create index briefings_firm_id_idx on briefings (firm_id);

   -- acknowledgements: one row when a user marks a briefing actioned.
   create table acknowledgements (
     id              uuid primary key default gen_random_uuid(),
     firm_id         uuid not null references firms(id) on delete cascade,
     briefing_id     uuid not null references briefings(id) on delete cascade,
     user_id         uuid not null references users(id),
     acknowledged_at timestamptz not null default now(),
     unique (briefing_id, user_id)
   );
   create index acknowledgements_firm_id_idx on acknowledgements (firm_id);

   alter table classifications   enable row level security;
   alter table briefings         enable row level security;
   alter table acknowledgements  enable row level security;

   create policy "read own classifications"
     on classifications for select to authenticated
     using (firm_id = auth_firm_id());

   create policy "read own briefings"
     on briefings for select to authenticated
     using (firm_id = auth_firm_id());

   create policy "read own acknowledgements"
     on acknowledgements for select to authenticated
     using (firm_id = auth_firm_id());