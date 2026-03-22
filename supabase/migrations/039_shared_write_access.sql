-- ── Skrivetilgang for delte turer med access_level = 'write' ─────────────────
--
-- Migration 009 ga kun lesetilgang (SELECT) til inviterte brukere.
-- Denne migrasjonen legger til INSERT / UPDATE / DELETE for brukere
-- som er invitert med access_level = 'write' og har status = 'accepted'.
--
-- Berørte tabeller: activities, dining, notes, possible_activities
-- (de tre tabellene bruker nevnte i feilmeldingen + possible_activities
--  for konsistens).
--
-- Kjøres i Supabase SQL Editor.

-- ── 1. activities ─────────────────────────────────────────────────────────────
--    Kjeden: activities.stop_id → stops.trip_id → trip_shares

create policy "Skrivetilgang aktiviteter via delt tur"
  on activities for all
  using (
    exists (
      select 1
      from   stops s
      join   trip_shares ts on ts.trip_id = s.trip_id
      where  s.id = activities.stop_id
        and  ts.shared_with_email = auth.email()
        and  ts.access_level = 'write'
        and  ts.status       = 'accepted'
    )
  )
  with check (
    exists (
      select 1
      from   stops s
      join   trip_shares ts on ts.trip_id = s.trip_id
      where  s.id = activities.stop_id
        and  ts.shared_with_email = auth.email()
        and  ts.access_level = 'write'
        and  ts.status       = 'accepted'
    )
  );

-- ── 2. dining ─────────────────────────────────────────────────────────────────
--    Kjeden: dining.stop_id → stops.trip_id → trip_shares

create policy "Skrivetilgang spisesteder via delt tur"
  on dining for all
  using (
    exists (
      select 1
      from   stops s
      join   trip_shares ts on ts.trip_id = s.trip_id
      where  s.id = dining.stop_id
        and  ts.shared_with_email = auth.email()
        and  ts.access_level = 'write'
        and  ts.status       = 'accepted'
    )
  )
  with check (
    exists (
      select 1
      from   stops s
      join   trip_shares ts on ts.trip_id = s.trip_id
      where  s.id = dining.stop_id
        and  ts.shared_with_email = auth.email()
        and  ts.access_level = 'write'
        and  ts.status       = 'accepted'
    )
  );

-- ── 3. notes ─────────────────────────────────────────────────────────────────
--    Kjeden: notes.trip_id → trip_shares

create policy "Skrivetilgang notater via delt tur"
  on notes for all
  using (
    exists (
      select 1
      from   trip_shares ts
      where  ts.trip_id            = notes.trip_id
        and  ts.shared_with_email  = auth.email()
        and  ts.access_level       = 'write'
        and  ts.status             = 'accepted'
    )
  )
  with check (
    exists (
      select 1
      from   trip_shares ts
      where  ts.trip_id            = notes.trip_id
        and  ts.shared_with_email  = auth.email()
        and  ts.access_level       = 'write'
        and  ts.status             = 'accepted'
    )
  );

-- ── 4. possible_activities ────────────────────────────────────────────────────
--    Kjeden: possible_activities.stop_id → stops.trip_id → trip_shares

create policy "Skrivetilgang mulige aktiviteter via delt tur"
  on possible_activities for all
  using (
    exists (
      select 1
      from   stops s
      join   trip_shares ts on ts.trip_id = s.trip_id
      where  s.id = possible_activities.stop_id
        and  ts.shared_with_email = auth.email()
        and  ts.access_level = 'write'
        and  ts.status       = 'accepted'
    )
  )
  with check (
    exists (
      select 1
      from   stops s
      join   trip_shares ts on ts.trip_id = s.trip_id
      where  s.id = possible_activities.stop_id
        and  ts.shared_with_email = auth.email()
        and  ts.access_level = 'write'
        and  ts.status       = 'accepted'
    )
  );

-- ── 5. note_images ────────────────────────────────────────────────────────────
--    Nødvendig for at delte skrivebrukere kan legge til bilder på notater.
--    Kjeden: note_images.note_id → notes.trip_id → trip_shares

create policy "Skrivetilgang notatbilder via delt tur"
  on note_images for all
  using (
    exists (
      select 1
      from   notes n
      join   trip_shares ts on ts.trip_id = n.trip_id
      where  n.id = note_images.note_id
        and  ts.shared_with_email = auth.email()
        and  ts.access_level = 'write'
        and  ts.status       = 'accepted'
    )
  )
  with check (
    exists (
      select 1
      from   notes n
      join   trip_shares ts on ts.trip_id = n.trip_id
      where  n.id = note_images.note_id
        and  ts.shared_with_email = auth.email()
        and  ts.access_level = 'write'
        and  ts.status       = 'accepted'
    )
  );
