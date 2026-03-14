-- Parkeringskostnad per natt på hotell
ALTER TABLE hotels
  ADD COLUMN IF NOT EXISTS parking_cost_per_night integer;
