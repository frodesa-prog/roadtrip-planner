-- Sporer når hver bruker sist leste chat for en tur (server-side, for e-postvarsler)
CREATE TABLE IF NOT EXISTS trip_chat_read_receipts (
  user_id     uuid NOT NULL,
  trip_id     uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, trip_id)
);

ALTER TABLE trip_chat_read_receipts ENABLE ROW LEVEL SECURITY;

-- Brukeren kan lese og oppdatere sine egne lesekvitteringer
CREATE POLICY "users manage own read receipts"
  ON trip_chat_read_receipts
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Logg over når siste e-postvarsel ble sendt (kun service role kan endre)
CREATE TABLE IF NOT EXISTS trip_chat_notification_log (
  user_id          uuid NOT NULL,
  trip_id          uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  last_notified_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, trip_id)
);

ALTER TABLE trip_chat_notification_log ENABLE ROW LEVEL SECURITY;
-- Ingen tilgang via anon/bruker-nøkkel – kun service role
