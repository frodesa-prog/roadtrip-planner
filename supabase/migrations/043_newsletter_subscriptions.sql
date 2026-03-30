-- Newsletter subscriptions
-- Each row represents a user's opt-in/out for a specific newsletter type on a specific trip.
-- Default behaviour (no row) = opted IN (sends email), enabled = false = opted OUT.

CREATE TABLE IF NOT EXISTS newsletter_subscriptions (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trip_id           uuid        NOT NULL REFERENCES trips(id)      ON DELETE CASCADE,
  newsletter_type   text        NOT NULL DEFAULT 'weekly_reminder'
                    CHECK (newsletter_type IN ('weekly_reminder')),
  enabled           boolean     NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, trip_id, newsletter_type)
);

ALTER TABLE newsletter_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can read and manage only their own subscriptions
CREATE POLICY "newsletter_subscriptions_own"
  ON newsletter_subscriptions
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Index for the weekly-reminder API query
CREATE INDEX IF NOT EXISTS newsletter_subscriptions_trip_type_idx
  ON newsletter_subscriptions (trip_id, newsletter_type, enabled);
