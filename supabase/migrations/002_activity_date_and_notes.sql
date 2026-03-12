-- ─── Migration 002: activity_date + notes ─────────────────────────────────────
-- Run this in Supabase → SQL Editor

-- 1. Add activity_date column to activities
ALTER TABLE activities ADD COLUMN IF NOT EXISTS activity_date date;

-- 2. Notes table (scratchpad per trip)
CREATE TABLE IF NOT EXISTS notes (
  id          uuid primary key default uuid_generate_v4(),
  trip_id     uuid references trips(id) on delete cascade not null,
  title       text,
  content     text not null default '',
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own notes" ON notes;
CREATE POLICY "Users can manage own notes" ON notes
  FOR ALL USING (
    trip_id IN (SELECT id FROM trips WHERE owner_id = auth.uid())
  );
