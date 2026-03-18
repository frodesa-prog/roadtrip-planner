-- ─── Chat archive tables ──────────────────────────────────────────────────────

CREATE TABLE trip_chat_archives (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id       UUID        NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  archived_by   UUID        NOT NULL REFERENCES auth.users(id),
  name          TEXT        NOT NULL,
  archived_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  message_count INT         NOT NULL DEFAULT 0
);

ALTER TABLE trip_chat_archives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trip members can view archives"
  ON trip_chat_archives FOR SELECT
  USING (
    trip_id IN (
      SELECT id       FROM trips    WHERE user_id        = auth.uid()
      UNION ALL
      SELECT trip_id  FROM travelers WHERE linked_user_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can create archives"
  ON trip_chat_archives FOR INSERT
  WITH CHECK (archived_by = auth.uid());

-- ─── Archive messages ─────────────────────────────────────────────────────────

CREATE TABLE trip_chat_archive_messages (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  archive_id          UUID        NOT NULL REFERENCES trip_chat_archives(id) ON DELETE CASCADE,
  original_message_id UUID,
  user_id             UUID,
  sender_name         TEXT,
  content             TEXT,
  attachment_url      TEXT,
  attachment_name     TEXT,
  attachment_type     TEXT,
  original_created_at TIMESTAMPTZ NOT NULL
);

ALTER TABLE trip_chat_archive_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trip members can view archive messages"
  ON trip_chat_archive_messages FOR SELECT
  USING (
    archive_id IN (
      SELECT a.id FROM trip_chat_archives a
      WHERE a.trip_id IN (
        SELECT id      FROM trips    WHERE user_id        = auth.uid()
        UNION ALL
        SELECT trip_id FROM travelers WHERE linked_user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Archive creator can insert messages"
  ON trip_chat_archive_messages FOR INSERT
  WITH CHECK (
    archive_id IN (
      SELECT id FROM trip_chat_archives WHERE archived_by = auth.uid()
    )
  );
