-- Migration 012: mulige aktiviteter per stopp
CREATE TABLE IF NOT EXISTS possible_activities (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stop_id     uuid NOT NULL REFERENCES stops(id) ON DELETE CASCADE,
  description text NOT NULL,
  url         text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE possible_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own possible activities"
  ON possible_activities
  USING (
    stop_id IN (
      SELECT s.id FROM stops s
      JOIN trips t ON t.id = s.trip_id
      WHERE t.owner_id = auth.uid()
    )
  );
