-- Migration 025: Trip Group Chat
-- Creates a persistent group chat table for all members of a trip.
-- Run this manually in the Supabase SQL Editor.

CREATE TABLE trip_group_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id     uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL,
  sender_name text NOT NULL,
  content     text NOT NULL,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE trip_group_messages ENABLE ROW LEVEL SECURITY;

-- Trip owner OR linked traveler can read messages
CREATE POLICY "trip members read chat"
  ON trip_group_messages FOR SELECT USING (
    EXISTS (SELECT 1 FROM trips WHERE id = trip_id AND owner_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM travelers
      WHERE trip_id = trip_group_messages.trip_id
        AND linked_user_id = auth.uid()
    )
  );

-- Only the sender (who is a trip member) can insert
CREATE POLICY "trip members insert chat"
  ON trip_group_messages FOR INSERT WITH CHECK (
    user_id = auth.uid() AND (
      EXISTS (SELECT 1 FROM trips WHERE id = trip_id AND owner_id = auth.uid())
      OR EXISTS (
        SELECT 1 FROM travelers
        WHERE trip_id = trip_group_messages.trip_id
          AND linked_user_id = auth.uid()
      )
    )
  );

-- Enable real-time for this table
ALTER PUBLICATION supabase_realtime ADD TABLE trip_group_messages;
