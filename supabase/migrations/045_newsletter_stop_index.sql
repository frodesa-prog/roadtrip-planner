-- Track which stop index was last featured per newsletter subscription
-- Increments after each send so each email covers the next stop in rotation
ALTER TABLE newsletter_subscriptions
  ADD COLUMN IF NOT EXISTS current_stop_index INTEGER NOT NULL DEFAULT 0;
