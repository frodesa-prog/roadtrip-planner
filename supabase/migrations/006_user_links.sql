-- ── Brukerprofiler (offentlig lesbar for innloggede brukere – brukes til e-post-oppslag) ──

create table if not exists user_profiles (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  email        text not null,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

alter table user_profiles enable row level security;

-- Alle innloggede brukere kan lese profiler (nødvendig for å slå opp e-post)
create policy "Auth read profiles"
  on user_profiles for select
  using (auth.role() = 'authenticated');

-- Kun egen profil kan skrives
create policy "Own profile insert"
  on user_profiles for insert
  with check (auth.uid() = user_id);

create policy "Own profile update"
  on user_profiles for update
  using (auth.uid() = user_id);

create policy "Own profile delete"
  on user_profiles for delete
  using (auth.uid() = user_id);

-- ── Tilgangsstyring for preferanser ───────────────────────────────────────────

create table if not exists preference_access (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  granted_to_email  text not null,
  created_at        timestamptz default now(),
  unique(user_id, granted_to_email)
);

alter table preference_access enable row level security;

-- Eier kan gjøre alt med sine egne tilganger
create policy "Own preference grants"
  on preference_access for all
  using (auth.uid() = user_id);

-- Den som har fått tilgang kan lese sin egen tilgang (for å sjekke om tilgang finnes)
create policy "Grantee read own grants"
  on preference_access for select
  using (granted_to_email = auth.email());

-- ── Oppdater RLS på user_preferences for å tillate lesing ved tildelt tilgang ──

-- Fjern gammel catch-all policy og erstatt med separate
drop policy if exists "Own preferences" on user_preferences;

create policy "Own preferences insert"
  on user_preferences for insert
  with check (auth.uid() = user_id);

create policy "Own preferences update"
  on user_preferences for update
  using (auth.uid() = user_id);

create policy "Own preferences delete"
  on user_preferences for delete
  using (auth.uid() = user_id);

-- Lesing: enten eier ELLER tilgang er gitt via preference_access
create policy "Own or granted preferences select"
  on user_preferences for select
  using (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM preference_access
      WHERE preference_access.user_id = user_preferences.user_id
        AND preference_access.granted_to_email = auth.email()
    )
  );

-- ── Koblede brukere i turfølge ────────────────────────────────────────────────

alter table travelers
  add column if not exists linked_user_id uuid references auth.users(id);

-- ── Interesser (fritekst-tillegg) i brukerpreferanser ────────────────────────

alter table user_preferences
  add column if not exists interests_extra text;
