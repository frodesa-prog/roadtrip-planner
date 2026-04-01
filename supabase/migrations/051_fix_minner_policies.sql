-- Fjern alle eksisterende policyer på minnebok-tabellene
-- og erstatt med enklere, fungerende versjoner.
-- auth.users kan ikke spørres direkte i policyer – bruker auth.email() i stedet.

-- ── trip_memories ─────────────────────────────────────────────────────────────

drop policy if exists "Eier kan lese egne minner"      on trip_memories;
drop policy if exists "Eier kan opprette minnebok"     on trip_memories;
drop policy if exists "Eier kan oppdatere minnebok"    on trip_memories;
drop policy if exists "Eier kan slette minnebok"       on trip_memories;
drop policy if exists "Offentlig lesing via slug"      on trip_memories;

create policy "trip_memories_select"
  on trip_memories for select
  to authenticated
  using (
    created_by = auth.uid()
    or exists (
      select 1 from trip_shares ts
      where ts.trip_id = trip_memories.trip_id
        and ts.shared_with_email = auth.email()
        and ts.status = 'accepted'
    )
  );

create policy "trip_memories_insert"
  on trip_memories for insert
  to authenticated
  with check (created_by = auth.uid());

create policy "trip_memories_update"
  on trip_memories for update
  to authenticated
  using (created_by = auth.uid());

create policy "trip_memories_delete"
  on trip_memories for delete
  to authenticated
  using (created_by = auth.uid());

create policy "trip_memories_public_read"
  on trip_memories for select
  to anon
  using (is_public = true);

-- ── memory_entries ────────────────────────────────────────────────────────────

drop policy if exists "Tilgang via minnebok"                        on memory_entries;
drop policy if exists "Minnebokeier og turdeltakere kan skrive innlegg"  on memory_entries;
drop policy if exists "Minnebokeier og turdeltakere kan oppdatere innlegg" on memory_entries;
drop policy if exists "Offentlig lesing av innlegg"                 on memory_entries;

create policy "memory_entries_select"
  on memory_entries for select
  to authenticated
  using (
    exists (
      select 1 from trip_memories tm
      where tm.id = memory_entries.memory_id
        and (
          tm.created_by = auth.uid()
          or exists (
            select 1 from trip_shares ts
            where ts.trip_id = tm.trip_id
              and ts.shared_with_email = auth.email()
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

create policy "memory_entries_insert"
  on memory_entries for insert
  to authenticated
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

create policy "memory_entries_update"
  on memory_entries for update
  to authenticated
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

create policy "memory_entries_public_read"
  on memory_entries for select
  to anon
  using (
    exists (
      select 1 from trip_memories tm
      where tm.id = memory_entries.memory_id and tm.is_public = true
    )
  );

-- ── memory_photos ─────────────────────────────────────────────────────────────

drop policy if exists "Deltakere kan se bilder"            on memory_photos;
drop policy if exists "Deltakere kan laste opp bilder"     on memory_photos;
drop policy if exists "Opplaster kan oppdatere bilde"      on memory_photos;
drop policy if exists "Opplaster kan slette bilde"         on memory_photos;
drop policy if exists "Offentlig lesing av bilder"         on memory_photos;

create policy "memory_photos_select"
  on memory_photos for select
  to authenticated
  using (
    exists (
      select 1 from trip_memories tm
      where tm.id = memory_photos.memory_id
        and (
          tm.created_by = auth.uid()
          or exists (
            select 1 from trip_shares ts
            where ts.trip_id = tm.trip_id
              and ts.shared_with_email = auth.email()
              and ts.status = 'accepted'
          )
          or exists (
            select 1 from travelers t
            where t.trip_id = tm.trip_id and t.linked_user_id = auth.uid()
          )
        )
    )
  );

create policy "memory_photos_insert"
  on memory_photos for insert
  to authenticated
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

create policy "memory_photos_update"
  on memory_photos for update
  to authenticated
  using (uploaded_by = auth.uid());

create policy "memory_photos_delete"
  on memory_photos for delete
  to authenticated
  using (uploaded_by = auth.uid());

create policy "memory_photos_public_read"
  on memory_photos for select
  to anon
  using (
    exists (
      select 1 from trip_memories tm
      where tm.id = memory_photos.memory_id and tm.is_public = true
    )
  );

-- Grants (kjøres på nytt for sikkerhets skyld)
grant select, insert, update, delete on trip_memories  to authenticated;
grant select, insert, update, delete on memory_entries to authenticated;
grant select, insert, update, delete on memory_photos  to authenticated;
grant select on trip_memories  to anon;
grant select on memory_entries to anon;
grant select on memory_photos  to anon;
