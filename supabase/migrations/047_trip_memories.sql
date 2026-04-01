-- ── trip_memories ────────────────────────────────────────────────────────────
-- Én minnebok per tur. Genereres på forespørsel etter at turen er ferdig.

create table trip_memories (
  id              uuid primary key default uuid_generate_v4(),
  trip_id         uuid not null references trips(id) on delete cascade,
  created_by      uuid not null references auth.users(id),
  title           text,                          -- tilpasset tittel, default = trip.name
  summary         text,                          -- AI-generert helhetsoversikt, redigerbar
  cover_image_url text,                          -- Cloudinary URL for forsidebilde/kollasj
  public_slug     text unique not null,          -- nanoid(10) – brukes i offentlig URL
  is_public       boolean not null default false,
  total_km        numeric(8,1),
  total_nights    integer,
  total_stops     integer,
  generated_at    timestamptz,                   -- siste gang AI-generering kjørte
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create unique index trip_memories_trip_id_unique on trip_memories(trip_id);
create index trip_memories_slug_idx on trip_memories(public_slug);

alter table trip_memories enable row level security;

-- Turens eier kan lese og skrive
create policy "Eier kan lese egne minner"
  on trip_memories for select
  using (
    created_by = auth.uid()
    or exists (
      select 1 from trip_shares ts
      where ts.trip_id = trip_memories.trip_id
        and ts.shared_with_email = (select email from auth.users where id = auth.uid())
        and ts.status = 'accepted'
    )
  );

create policy "Eier kan opprette minnebok"
  on trip_memories for insert
  with check (created_by = auth.uid());

create policy "Eier kan oppdatere minnebok"
  on trip_memories for update
  using (created_by = auth.uid());

create policy "Eier kan slette minnebok"
  on trip_memories for delete
  using (created_by = auth.uid());

-- Offentlig tilgang via slug (anon role)
create policy "Offentlig lesing via slug"
  on trip_memories for select
  using (is_public = true);
