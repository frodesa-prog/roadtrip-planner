-- ── Fix: Delt skrivetilgang fungerer ikke for inviterte brukere ───────────────
--
-- Diagnose: Migration 039 krevde at ts.status = 'accepted' for å tillate
-- skriving. Auto-accept-mekanismen i useTrips.ts er ikke pålitelig (race
-- conditions, timing, mulig e-post-mismatch) og lar status stå som 'pending',
-- noe som blokkerer alle INSERT/UPDATE/DELETE for delte brukere.
--
-- Fix: Slett de gamle policyene og opprett nye uten status-kravet.
-- Eneste krav for skrivetilgang: access_level = 'write'.
-- Status-feltet beholdes men håndheves ikke lenger i RLS.
--
-- I tillegg: auto-aksepter alle eksisterende pending invitasjoner.
--
-- Kjøres i Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 0. Auto-aksepter alle ventende invitasjoner ───────────────────────────────
UPDATE trip_shares
SET    status = 'accepted'
WHERE  status = 'pending';

-- ── 1. activities ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Skrivetilgang aktiviteter via delt tur" ON activities;

CREATE POLICY "Skrivetilgang aktiviteter via delt tur"
  ON activities FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM   stops s
      JOIN   trip_shares ts ON ts.trip_id = s.trip_id
      WHERE  s.id                    = activities.stop_id
        AND  ts.shared_with_email   = auth.email()
        AND  ts.access_level        = 'write'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM   stops s
      JOIN   trip_shares ts ON ts.trip_id = s.trip_id
      WHERE  s.id                    = activities.stop_id
        AND  ts.shared_with_email   = auth.email()
        AND  ts.access_level        = 'write'
    )
  );

-- ── 2. dining ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Skrivetilgang spisesteder via delt tur" ON dining;

CREATE POLICY "Skrivetilgang spisesteder via delt tur"
  ON dining FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM   stops s
      JOIN   trip_shares ts ON ts.trip_id = s.trip_id
      WHERE  s.id                    = dining.stop_id
        AND  ts.shared_with_email   = auth.email()
        AND  ts.access_level        = 'write'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM   stops s
      JOIN   trip_shares ts ON ts.trip_id = s.trip_id
      WHERE  s.id                    = dining.stop_id
        AND  ts.shared_with_email   = auth.email()
        AND  ts.access_level        = 'write'
    )
  );

-- ── 3. notes ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Skrivetilgang notater via delt tur" ON notes;

CREATE POLICY "Skrivetilgang notater via delt tur"
  ON notes FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM   trip_shares ts
      WHERE  ts.trip_id           = notes.trip_id
        AND  ts.shared_with_email = auth.email()
        AND  ts.access_level      = 'write'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM   trip_shares ts
      WHERE  ts.trip_id           = notes.trip_id
        AND  ts.shared_with_email = auth.email()
        AND  ts.access_level      = 'write'
    )
  );

-- ── 4. possible_activities ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Skrivetilgang mulige aktiviteter via delt tur" ON possible_activities;

CREATE POLICY "Skrivetilgang mulige aktiviteter via delt tur"
  ON possible_activities FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM   stops s
      JOIN   trip_shares ts ON ts.trip_id = s.trip_id
      WHERE  s.id                    = possible_activities.stop_id
        AND  ts.shared_with_email   = auth.email()
        AND  ts.access_level        = 'write'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM   stops s
      JOIN   trip_shares ts ON ts.trip_id = s.trip_id
      WHERE  s.id                    = possible_activities.stop_id
        AND  ts.shared_with_email   = auth.email()
        AND  ts.access_level        = 'write'
    )
  );

-- ── 5. note_images ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Skrivetilgang notatbilder via delt tur" ON note_images;

CREATE POLICY "Skrivetilgang notatbilder via delt tur"
  ON note_images FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM   notes n
      JOIN   trip_shares ts ON ts.trip_id = n.trip_id
      WHERE  n.id                    = note_images.note_id
        AND  ts.shared_with_email   = auth.email()
        AND  ts.access_level        = 'write'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM   notes n
      JOIN   trip_shares ts ON ts.trip_id = n.trip_id
      WHERE  n.id                    = note_images.note_id
        AND  ts.shared_with_email   = auth.email()
        AND  ts.access_level        = 'write'
    )
  );

-- ── 6. todo_items – sjekk at delte brukere har skrivetilgang ──────────────────
-- Eksisterende policy fra migration 011 tillater allerede aksepterte delte
-- brukere å skrive. Oppdater for å inkludere alle (uavhengig av status).
DROP POLICY IF EXISTS "Trip members todo access" ON todo_items;

CREATE POLICY "Trip members todo access"
  ON todo_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM trips
      WHERE trips.id = todo_items.trip_id
        AND trips.owner_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM trip_shares
      WHERE trip_shares.trip_id          = todo_items.trip_id
        AND trip_shares.shared_with_email = auth.email()
        AND trip_shares.access_level      = 'write'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM trips
      WHERE trips.id = todo_items.trip_id
        AND trips.owner_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM trip_shares
      WHERE trip_shares.trip_id          = todo_items.trip_id
        AND trip_shares.shared_with_email = auth.email()
        AND trip_shares.access_level      = 'write'
    )
  );

-- ── 7. trip_packing_items – skrivetilgang for delte brukere ───────────────────
DROP POLICY IF EXISTS "Trip members packing access" ON trip_packing_items;

CREATE POLICY "Trip members packing access"
  ON trip_packing_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM trips
      WHERE trips.id = trip_packing_items.trip_id
        AND trips.owner_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM trip_shares
      WHERE trip_shares.trip_id          = trip_packing_items.trip_id
        AND trip_shares.shared_with_email = auth.email()
        AND trip_shares.access_level      = 'write'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM trips
      WHERE trips.id = trip_packing_items.trip_id
        AND trips.owner_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM trip_shares
      WHERE trip_shares.trip_id          = trip_packing_items.trip_id
        AND trip_shares.shared_with_email = auth.email()
        AND trip_shares.access_level      = 'write'
    )
  );
