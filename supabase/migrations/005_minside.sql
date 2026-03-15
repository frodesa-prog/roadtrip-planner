-- ── Min Side: nye tabeller ─────────────────────────────────────────────────────

-- Personlige preferanser (global per bruker – brukes som kontekst i Ferietips-chat)
create table if not exists user_preferences (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  interests         text,
  food_preferences  text,
  mobility_notes    text,
  other_info        text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),
  unique(user_id)
);

-- Standard pakkeliste (global per bruker – mal som gjelder alle turer)
create table if not exists default_packing_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  item        text not null,
  category    text not null default 'other',
  -- 'documents' | 'electronics' | 'clothes' | 'hygiene' | 'other'
  created_at  timestamptz default now()
);

-- Dokumentarkiv (global per bruker – pass, forsikring, ESTA, osv.)
create table if not exists user_documents (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  name          text not null,
  document_type text not null default 'other',
  -- 'passport' | 'drivers_license' | 'insurance' | 'esta' | 'other'
  storage_path  text not null,
  file_type     text,
  created_at    timestamptz default now()
);

-- Deling av turer med andre brukere
create table if not exists trip_shares (
  id                 uuid primary key default gen_random_uuid(),
  trip_id            uuid not null references trips(id) on delete cascade,
  owner_id           uuid not null references auth.users(id) on delete cascade,
  shared_with_email  text not null,
  access_level       text not null default 'read',   -- 'read' | 'write'
  status             text not null default 'pending', -- 'pending' | 'accepted' | 'declined'
  created_at         timestamptz default now(),
  unique(trip_id, shared_with_email)
);

-- Aktivitetslogg (funksjonell endringer + DB-endringer)
create table if not exists activity_log (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  trip_id     uuid references trips(id) on delete set null,
  log_type    text not null,  -- 'functional' | 'database'
  action      text not null,  -- 'INSERT' | 'UPDATE' | 'DELETE' | 'lagret' | 'delt' osv.
  entity_type text,           -- 'stop' | 'activity' | 'trip' | 'preferences' | 'document' osv.
  entity_name text,           -- lesbar navn, f.eks. "Las Vegas" eller "Mitt pass"
  details     jsonb,
  created_at  timestamptz default now()
);

-- ── Row Level Security ──────────────────────────────────────────────────────────

alter table user_preferences      enable row level security;
alter table default_packing_items enable row level security;
alter table user_documents        enable row level security;
alter table trip_shares           enable row level security;
alter table activity_log          enable row level security;

create policy "Own preferences"    on user_preferences      for all using (auth.uid() = user_id);
create policy "Own packing items"  on default_packing_items for all using (auth.uid() = user_id);
create policy "Own documents"      on user_documents        for all using (auth.uid() = user_id);
create policy "Own trip shares"    on trip_shares           for all using (auth.uid() = owner_id);
create policy "Own activity log"   on activity_log          for all using (auth.uid() = user_id);
