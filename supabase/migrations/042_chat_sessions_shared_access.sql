-- ── Fix: Ferietips-chat fungerer ikke for brukere invitert via trip_shares ────
--
-- Diagnose: chat_sessions og chat_messages har kun SELECT-tilgang for
-- delte brukere (fra migration 009). INSERT / UPDATE / DELETE mangler,
-- så inviterte brukere kan ikke opprette chatsesjoner, sende meldinger
-- eller slette samtaler.
--
-- Fix: Legg til INSERT / UPDATE / DELETE for trip_shares-brukere.
-- (Eier-policyene fra migration 018 beholdes uendret.)
--
-- Kjøres i Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. chat_sessions ──────────────────────────────────────────────────────────

-- INSERT: invitert bruker kan opprette en sesjon på en delt tur
CREATE POLICY "shared insert chat_sessions"
  ON chat_sessions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM trip_shares
      WHERE trip_id           = chat_sessions.trip_id
        AND shared_with_email = auth.email()
    )
  );

-- UPDATE: invitert bruker kan oppdatere tittel / updated_at på egne sesjoner
CREATE POLICY "shared update chat_sessions"
  ON chat_sessions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM trip_shares
      WHERE trip_id           = chat_sessions.trip_id
        AND shared_with_email = auth.email()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM trip_shares
      WHERE trip_id           = chat_sessions.trip_id
        AND shared_with_email = auth.email()
    )
  );

-- DELETE: invitert bruker kan slette sesjoner på delte turer
CREATE POLICY "shared delete chat_sessions"
  ON chat_sessions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM trip_shares
      WHERE trip_id           = chat_sessions.trip_id
        AND shared_with_email = auth.email()
    )
  );

-- ── 2. chat_messages ──────────────────────────────────────────────────────────

-- INSERT: invitert bruker kan legge til meldinger i sesjoner på delte turer
CREATE POLICY "shared insert chat_messages"
  ON chat_messages FOR INSERT
  WITH CHECK (
    session_id IN (
      SELECT cs.id FROM chat_sessions cs
      JOIN trip_shares ts ON ts.trip_id = cs.trip_id
      WHERE ts.shared_with_email = auth.email()
    )
  );

-- DELETE: invitert bruker kan slette meldinger fra delte turer
CREATE POLICY "shared delete chat_messages"
  ON chat_messages FOR DELETE
  USING (
    session_id IN (
      SELECT cs.id FROM chat_sessions cs
      JOIN trip_shares ts ON ts.trip_id = cs.trip_id
      WHERE ts.shared_with_email = auth.email()
    )
  );
