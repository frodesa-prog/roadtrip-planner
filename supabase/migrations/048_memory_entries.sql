-- ── memory_entries ───────────────────────────────────────────────────────────
-- Én dagbokinnføring per stoppested i minneboken. AI-generert, redigerbar.

create table memory_entries (
  id          uuid primary key default uuid_generate_v4(),
  memory_id   uuid not null references trip_memories(id) on delete cascade,
  stop_id     uuid not null references stops(id) on delete cascade,
  diary_text  text,
  highlight   text,     -- én setning – «Høydepunktet var…»
  mood_emoji  text,     -- f.eks. '🌟', '🥳', '🌄'
  stop_order  integer not null default 0,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create unique index memory_entries_memory_stop on memory_entries(memory_id, stop_id);
create index memory_entries_memory_id_idx on memory_entries(memory_id);

alter table memory_entries enable row level security;

-- Tilgang via minnebokens eierskap
create policy "Tilgang via minnebok"
  on memory_entries for select
  using (
    exists (
      select 1 from trip_memories tm
      where tm.id = memory_entries.memory_id
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
            where t.trip_id = tm.trip_id
              and t.linked_user_id = auth.uid()
          )
        )
    )
  );

create policy "Minnebokeier og turdeltakere kan skrive innlegg"
  on memory_entries for insert
  with check (
    exists (
      select 1 from trip_memories tm
      where tm.id = memory_entries.memory_id
        and (
          tm.created_by = auth.uid()
          or exists (
            select 1 from travelers t
            where t.trip_id = tm.trip_id and t.linked_user_id = auth.uid()
          )
        )
    )
  );

create policy "Minnebokeier og turdeltakere kan oppdatere innlegg"
  on memory_entries for update
  using (
    exists (
      select 1 from trip_memories tm
      where tm.id = memory_entries.memory_id
        and (
          tm.created_by = auth.uid()
          or exists (
            select 1 from travelers t
            where t.trip_id = tm.trip_id and t.linked_user_id = auth.uid()
          )
        )
    )
  );

-- Offentlig lesing hvis minneboken er offentlig
create policy "Offentlig lesing av innlegg"
  on memory_entries for select
  using (
    exists (
      select 1 from trip_memories tm
      where tm.id = memory_entries.memory_id
        and tm.is_public = true
    )
  );
