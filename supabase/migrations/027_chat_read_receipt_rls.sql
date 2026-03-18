-- Oppdater RLS på trip_chat_read_receipts slik at alle turmedlemmer
-- kan se hverandres lesekvitteringer (nødvendig for "Lest"-indikatoren i chat).

-- Fjern den gamle kombinerte policyen
DROP POLICY IF EXISTS "users manage own read receipts" ON trip_chat_read_receipts;

-- Alle turmedlemmer (eier + reisende med linked_user_id) kan lese
-- lesekvitteringer for turer de er med på
CREATE POLICY "trip members read receipts"
  ON trip_chat_read_receipts FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM trips WHERE id = trip_id AND owner_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM travelers
      WHERE trip_id = trip_chat_read_receipts.trip_id
        AND linked_user_id = auth.uid()
    )
  );

-- Brukeren kan kun sette inn sin egen lesekvittering
CREATE POLICY "users insert own read receipt"
  ON trip_chat_read_receipts FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Brukeren kan kun oppdatere sin egen lesekvittering
CREATE POLICY "users update own read receipt"
  ON trip_chat_read_receipts FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Aktiver sanntidsoppdateringer for lesekvitteringer
ALTER PUBLICATION supabase_realtime ADD TABLE trip_chat_read_receipts;
