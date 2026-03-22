-- ── Fix: Ferietips-chat fungerer ikke for brukere invitert via trip_shares ────
--
-- Diagnose: Alle chat-policyer sjekker kun travelers.linked_user_id = auth.uid()
-- for å avgjøre turmedlemskap. Brukere invitert via trip_shares finnes ikke i
-- travelers-tabellen, og blokkeres dermed fra å lese eller sende meldinger.
--
-- Fix: Legg til trip_shares-sjekk i alle relevante policyer.
-- Tilgang gis til: eier | linked traveler | delt bruker (uansett access_level)
--
-- Kjøres i Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

-- Hjelpemakro: returner true dersom auth.uid()/auth.email() er turmedlem
-- (brukes inline i hver policy)

-- ── 1. trip_group_messages ────────────────────────────────────────────────────

DROP POLICY IF EXISTS "trip members read chat"   ON trip_group_messages;
DROP POLICY IF EXISTS "trip members insert chat" ON trip_group_messages;
DROP POLICY IF EXISTS "Trip members can delete messages" ON trip_group_messages;

CREATE POLICY "trip members read chat"
  ON trip_group_messages FOR SELECT
  USING (
    -- Eier
    EXISTS (SELECT 1 FROM trips WHERE id = trip_group_messages.trip_id AND owner_id = auth.uid())
    -- Linked traveler
    OR EXISTS (
      SELECT 1 FROM travelers
      WHERE trip_id = trip_group_messages.trip_id
        AND linked_user_id = auth.uid()
    )
    -- Invitert via trip_shares
    OR EXISTS (
      SELECT 1 FROM trip_shares
      WHERE trip_id           = trip_group_messages.trip_id
        AND shared_with_email = auth.email()
    )
  );

CREATE POLICY "trip members insert chat"
  ON trip_group_messages FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND (
      EXISTS (SELECT 1 FROM trips WHERE id = trip_group_messages.trip_id AND owner_id = auth.uid())
      OR EXISTS (
        SELECT 1 FROM travelers
        WHERE trip_id = trip_group_messages.trip_id
          AND linked_user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM trip_shares
        WHERE trip_id           = trip_group_messages.trip_id
          AND shared_with_email = auth.email()
      )
    )
  );

CREATE POLICY "Trip members can delete messages"
  ON trip_group_messages FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM trips WHERE id = trip_group_messages.trip_id AND owner_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM travelers
      WHERE trip_id = trip_group_messages.trip_id
        AND linked_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM trip_shares
      WHERE trip_id           = trip_group_messages.trip_id
        AND shared_with_email = auth.email()
    )
  );

-- ── 2. trip_chat_read_receipts ────────────────────────────────────────────────

DROP POLICY IF EXISTS "trip members read receipts" ON trip_chat_read_receipts;

CREATE POLICY "trip members read receipts"
  ON trip_chat_read_receipts FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM trips WHERE id = trip_chat_read_receipts.trip_id AND owner_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM travelers
      WHERE trip_id = trip_chat_read_receipts.trip_id
        AND linked_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM trip_shares
      WHERE trip_id           = trip_chat_read_receipts.trip_id
        AND shared_with_email = auth.email()
    )
  );

-- INSERT og UPDATE-policyer (kun egne lesekvitteringer) endres ikke

-- ── 3. trip_chat_archives ─────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Trip members can view archives" ON trip_chat_archives;
DROP POLICY IF EXISTS "Authenticated users can create archives" ON trip_chat_archives;

CREATE POLICY "Trip members can view archives"
  ON trip_chat_archives FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM trips WHERE id = trip_chat_archives.trip_id AND owner_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM travelers
      WHERE trip_id = trip_chat_archives.trip_id
        AND linked_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM trip_shares
      WHERE trip_id           = trip_chat_archives.trip_id
        AND shared_with_email = auth.email()
    )
  );

CREATE POLICY "Trip members can create archives"
  ON trip_chat_archives FOR INSERT
  WITH CHECK (
    archived_by = auth.uid()
    AND (
      EXISTS (SELECT 1 FROM trips WHERE id = trip_chat_archives.trip_id AND owner_id = auth.uid())
      OR EXISTS (
        SELECT 1 FROM travelers
        WHERE trip_id = trip_chat_archives.trip_id
          AND linked_user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM trip_shares
        WHERE trip_id           = trip_chat_archives.trip_id
          AND shared_with_email = auth.email()
      )
    )
  );

-- ── 4. trip_chat_archive_messages ─────────────────────────────────────────────

DROP POLICY IF EXISTS "Trip members can view archive messages" ON trip_chat_archive_messages;

CREATE POLICY "Trip members can view archive messages"
  ON trip_chat_archive_messages FOR SELECT
  USING (
    archive_id IN (
      SELECT a.id FROM trip_chat_archives a
      WHERE
        EXISTS (SELECT 1 FROM trips WHERE id = a.trip_id AND owner_id = auth.uid())
        OR EXISTS (
          SELECT 1 FROM travelers
          WHERE trip_id = a.trip_id AND linked_user_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1 FROM trip_shares
          WHERE trip_id = a.trip_id AND shared_with_email = auth.email()
        )
    )
  );

-- ── 5. trip_message_reactions ─────────────────────────────────────────────────
-- Eksisterende "true"-policy for SELECT er allerede åpen nok.
-- Oppdater INSERT for å tillate delte brukere også.

DROP POLICY IF EXISTS "authenticated users can add reactions" ON trip_message_reactions;
DROP POLICY IF EXISTS "users can delete own reactions"        ON trip_message_reactions;

CREATE POLICY "authenticated users can add reactions"
  ON trip_message_reactions FOR INSERT
  WITH CHECK (
    auth.uid()::text = user_id
    AND (
      EXISTS (
        SELECT 1 FROM trips WHERE id = trip_message_reactions.trip_id AND owner_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM travelers
        WHERE trip_id = trip_message_reactions.trip_id AND linked_user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM trip_shares
        WHERE trip_id           = trip_message_reactions.trip_id
          AND shared_with_email = auth.email()
      )
    )
  );

CREATE POLICY "users can delete own reactions"
  ON trip_message_reactions FOR DELETE
  USING (auth.uid()::text = user_id);
