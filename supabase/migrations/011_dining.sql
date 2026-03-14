-- Migration 011: spisestedsbooking
CREATE TABLE IF NOT EXISTS dining (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stop_id      uuid NOT NULL REFERENCES stops(id) ON DELETE CASCADE,
  name         text NOT NULL,
  url          text,
  booking_date date,
  booking_time time,
  map_lat      double precision,
  map_lng      double precision,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE dining ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own dining entries"
  ON dining
  USING (
    stop_id IN (
      SELECT s.id FROM stops s
      JOIN trips t ON t.id = s.trip_id
      WHERE t.owner_id = auth.uid()
    )
  );
