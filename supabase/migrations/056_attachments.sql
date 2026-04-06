-- ── attachments ───────────────────────────────────────────────────────────────
-- Vedlegg (bilder og PDF-er) knyttet til stoppesteder, hoteller, aktiviteter,
-- spisesteder og mulige aktiviteter. Lagret i Cloudinary.

create table attachments (
  id                   uuid primary key default uuid_generate_v4(),
  trip_id              uuid not null references trips(id) on delete cascade,
  entity_type          text not null,   -- 'stop' | 'hotel' | 'activity' | 'dining' | 'possible_activity'
  entity_id            uuid not null,
  cloudinary_public_id text not null,
  cloudinary_url       text not null,
  file_type            text not null,   -- 'image' | 'pdf'
  file_name            text not null,
  uploaded_by          uuid not null references auth.users(id),
  created_at           timestamptz default now()
);

create index attachments_entity_idx on attachments(entity_type, entity_id);
create index attachments_trip_idx   on attachments(trip_id);

alter table attachments enable row level security;

-- Tureier og turdeltakere kan se vedlegg
create policy "Deltakere kan se vedlegg"
  on attachments for select
  using (
    exists (
      select 1 from trips t
      where t.id = attachments.trip_id
        and (
          t.owner_id = auth.uid()
          or exists (
            select 1 from travelers tv
            where tv.trip_id = t.id and tv.linked_user_id = auth.uid()
          )
        )
    )
  );

-- Tureier og turdeltakere kan laste opp vedlegg
create policy "Deltakere kan laste opp vedlegg"
  on attachments for insert
  with check (
    uploaded_by = auth.uid()
    and exists (
      select 1 from trips t
      where t.id = attachments.trip_id
        and (
          t.owner_id = auth.uid()
          or exists (
            select 1 from travelers tv
            where tv.trip_id = t.id and tv.linked_user_id = auth.uid()
          )
        )
    )
  );

-- Bare opplasteren kan slette
create policy "Opplaster kan slette vedlegg"
  on attachments for delete
  using (uploaded_by = auth.uid());
