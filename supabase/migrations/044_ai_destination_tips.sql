-- Add 'ai_destination_tips' newsletter type and frequency tracking
-- 1. Expand the CHECK constraint on newsletter_type
-- 2. Add frequency_days (how often to send, in days) and last_sent_at (per user+trip+type)

-- Drop the existing check constraint (auto-named by Postgres as <table>_<col>_check)
ALTER TABLE newsletter_subscriptions
  DROP CONSTRAINT IF EXISTS newsletter_subscriptions_newsletter_type_check;

-- Add new check constraint that includes the new type
ALTER TABLE newsletter_subscriptions
  ADD CONSTRAINT newsletter_subscriptions_newsletter_type_check
  CHECK (newsletter_type IN ('weekly_reminder', 'ai_destination_tips'));

-- Add frequency column (default 3 days, only meaningful for ai_destination_tips)
ALTER TABLE newsletter_subscriptions
  ADD COLUMN IF NOT EXISTS frequency_days INTEGER NOT NULL DEFAULT 3;

-- Add last_sent_at so the cron job can track when to send next
ALTER TABLE newsletter_subscriptions
  ADD COLUMN IF NOT EXISTS last_sent_at TIMESTAMPTZ;

-- Index to make the cron query fast (filter by type + check last_sent_at)
CREATE INDEX IF NOT EXISTS newsletter_subscriptions_type_sent_idx
  ON newsletter_subscriptions (newsletter_type, last_sent_at);
