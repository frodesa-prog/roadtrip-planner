-- Link notes to specific activities, dining entries, or possible activities
ALTER TABLE notes
  ADD COLUMN IF NOT EXISTS activity_id         uuid REFERENCES activities(id)          ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS dining_id           uuid REFERENCES dining(id)              ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS possible_activity_id uuid REFERENCES possible_activities(id) ON DELETE CASCADE;

-- Index for fast lookup of notes by entity
CREATE INDEX IF NOT EXISTS notes_activity_id_idx          ON notes(activity_id)          WHERE activity_id          IS NOT NULL;
CREATE INDEX IF NOT EXISTS notes_dining_id_idx            ON notes(dining_id)            WHERE dining_id            IS NOT NULL;
CREATE INDEX IF NOT EXISTS notes_possible_activity_id_idx ON notes(possible_activity_id) WHERE possible_activity_id IS NOT NULL;
