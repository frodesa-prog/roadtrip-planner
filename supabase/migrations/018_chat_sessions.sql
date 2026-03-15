-- Chat sessions (one per conversation thread)
CREATE TABLE IF NOT EXISTS chat_sessions (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id     uuid        REFERENCES trips(id) ON DELETE CASCADE NOT NULL,
  title       text        NOT NULL DEFAULT 'Ny chat',
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- Chat messages within a session
CREATE TABLE IF NOT EXISTS chat_messages (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  uuid        REFERENCES chat_sessions(id) ON DELETE CASCADE NOT NULL,
  role        text        NOT NULL CHECK (role IN ('user', 'assistant')),
  content     text        NOT NULL DEFAULT '',
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Sessions: full access for trip owner
CREATE POLICY "owner_all_chat_sessions"
  ON chat_sessions FOR ALL
  USING  (trip_id IN (SELECT id FROM trips WHERE owner_id = auth.uid()))
  WITH CHECK (trip_id IN (SELECT id FROM trips WHERE owner_id = auth.uid()));

-- Messages: access via session → trip → owner
CREATE POLICY "owner_select_chat_messages"
  ON chat_messages FOR SELECT
  USING (session_id IN (
    SELECT cs.id FROM chat_sessions cs
    JOIN trips t ON cs.trip_id = t.id
    WHERE t.owner_id = auth.uid()
  ));

CREATE POLICY "owner_insert_chat_messages"
  ON chat_messages FOR INSERT
  WITH CHECK (session_id IN (
    SELECT cs.id FROM chat_sessions cs
    JOIN trips t ON cs.trip_id = t.id
    WHERE t.owner_id = auth.uid()
  ));

CREATE POLICY "owner_delete_chat_messages"
  ON chat_messages FOR DELETE
  USING (session_id IN (
    SELECT cs.id FROM chat_sessions cs
    JOIN trips t ON cs.trip_id = t.id
    WHERE t.owner_id = auth.uid()
  ));
