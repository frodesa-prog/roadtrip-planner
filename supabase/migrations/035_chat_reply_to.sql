-- Add reply-to fields to trip_group_messages
-- Allows users to reply to a specific message, storing a snapshot
-- of the original sender/content so replies still make sense if the
-- original message is later deleted.

ALTER TABLE trip_group_messages
  ADD COLUMN IF NOT EXISTS reply_to_id      uuid REFERENCES trip_group_messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reply_to_content text,
  ADD COLUMN IF NOT EXISTS reply_to_sender  text;
