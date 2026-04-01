-- ── memory_photos ────────────────────────────────────────────────────────────
-- Cloudinary-bilder knyttet til en minnebok og valgfritt et stoppested.
-- Alle turdeltakere med linked_user_id kan laste opp bilder.

create table memory_photos (
  id                   uuid primary key default uuid_generate_v4(),
  memory_id            uuid not null references trip_memories(id) on delete cascade,
  stop_id              uuid references stops(id) on delete set null,
  uploaded_by          uuid not null references auth.users(id),
  cloudinary_public_id text not null,
  cloudinary_url       text not null,
  thumbnail_url        text,
  caption              text,
  taken_at             timestamptz,       -- fra EXIF eller brukerinput
  exif_lat             double precision,
  exif_lng             double precision,
  is_favorite          boolean not null default false,
  sort_order           integer not null default 0,
  created_at           timestamptz default now()
);

create index memory_photos_memory_id_idx on memory_photos(memory_id);
create index memory_photos_stop_id_idx   on memory_photos(stop_id);

alter table memory_photos enable row level security;

-- Eier + turdeltakere med konto kan se bilder
create policy "Deltakere kan se bilder"
  on memory_photos for select
  using (
    exists (
      select 1 from trip_memories tm
      where tm.id = memory_photos.memory_id
        and (
          tm.created_by = auth.uid()
          or exists (
            select 1 from trip_shares ts
            where ts.trip_id = tm.trip_id
              and ts.shared_with_email = (select email from auth.users where id = auth.uid())
              and ts.status = 'accepted'
          )
          or exists (
            select 1 from travelers t
            where t.trip_id = tm.trip_id and t.linked_user_id = auth.uid()
          )
        )
    )
  );

-- Eier + turdeltakere kan laste opp
create policy "Deltakere kan laste opp bilder"
  on memory_photos for insert
  with check (
    uploaded_by = auth.uid()
    and exists (
      select 1 from trip_memories tm
      where tm.id = memory_photos.memory_id
        and (
          tm.created_by = auth.uid()
          or exists (
            select 1 from travelers t
            where t.trip_id = tm.trip_id and t.linked_user_id = auth.uid()
          )
        )
    )
  );

-- Bare opplasteren kan endre og slette
create policy "Opplaster kan oppdatere bilde"
  on memory_photos for update
  using (uploaded_by = auth.uid());

create policy "Opplaster kan slette bilde"
  on memory_photos for delete
  using (uploaded_by = auth.uid());

-- Offentlig lesing
create policy "Offentlig lesing av bilder"
  on memory_photos for select
  using (
    exists (
      select 1 from trip_memories tm
      where tm.id = memory_photos.memory_id
        and tm.is_public = true
    )
  );
