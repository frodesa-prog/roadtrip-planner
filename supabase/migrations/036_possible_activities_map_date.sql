-- Add map coordinates and date to possible_activities
-- Also ensures notes column exists (added in a previous manual migration)

ALTER TABLE possible_activities
  ADD COLUMN IF NOT EXISTS notes        text,
  ADD COLUMN IF NOT EXISTS map_lat      double precision,
  ADD COLUMN IF NOT EXISTS map_lng      double precision,
  ADD COLUMN IF NOT EXISTS activity_date date;
