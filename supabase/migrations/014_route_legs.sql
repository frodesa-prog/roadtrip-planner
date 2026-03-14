-- Migration 014: Lagrer egendefinerte ruter (via-punkter per etappe)
-- Brukeren kan dra kjøreruten på kartet; via-punktene lagres her.

CREATE TABLE IF NOT EXISTS route_legs (
  id           uuid primary key default uuid_generate_v4(),
  trip_id      uuid references trips(id) on delete cascade not null,
  from_stop_id uuid references stops(id) on delete cascade not null,
  to_stop_id   uuid references stops(id) on delete cascade not null,
  waypoints    jsonb not null default '[]',
  updated_at   timestamptz default now(),
  UNIQUE (from_stop_id, to_stop_id)
);

ALTER TABLE route_legs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own route legs" ON route_legs;
CREATE POLICY "Users can manage own route legs" ON route_legs
  FOR ALL USING (
    trip_id IN (
      SELECT id FROM trips WHERE owner_id = auth.uid()
    )
  );
