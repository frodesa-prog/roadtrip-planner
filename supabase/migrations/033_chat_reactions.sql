-- ── Chat message reactions ────────────────────────────────────────────────────
-- Stores emoji reactions on trip group messages.
-- trip_id is denormalised for efficient realtime channel filtering.

CREATE TABLE IF NOT EXISTS trip_message_reactions (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id  uuid        NOT NULL REFERENCES trip_group_messages(id) ON DELETE CASCADE,
  trip_id     uuid        NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  user_id     text        NOT NULL,
  sender_name text        NOT NULL DEFAULT '',
  emoji       text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),

  -- One user can react with the same emoji once per message
  UNIQUE (message_id, user_id, emoji)
);

-- Index for fetching all reactions for a set of messages
CREATE INDEX IF NOT EXISTS trip_message_reactions_message_id_idx
  ON trip_message_reactions (message_id);

-- Index for realtime channel filter on trip_id
CREATE INDEX IF NOT EXISTS trip_message_reactions_trip_id_idx
  ON trip_message_reactions (trip_id);

ALTER TABLE trip_message_reactions ENABLE ROW LEVEL SECURITY;

-- All trip participants can read reactions
CREATE POLICY "trip members can read reactions"
  ON trip_message_reactions FOR SELECT
  USING (true);

-- Authenticated users can add reactions
CREATE POLICY "authenticated users can add reactions"
  ON trip_message_reactions FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

-- Users can only delete their own reactions
CREATE POLICY "users can delete own reactions"
  ON trip_message_reactions FOR DELETE
  USING (auth.uid()::text = user_id);
