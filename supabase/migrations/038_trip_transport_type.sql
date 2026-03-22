-- Add transport_type to trips: 'fly' | 'tog' | 'ingen'
-- Backfills from has_flight: false → 'ingen', true → 'fly'
ALTER TABLE trips
  ADD COLUMN IF NOT EXISTS transport_type TEXT NOT NULL DEFAULT 'fly'
    CHECK (transport_type IN ('fly', 'tog', 'ingen'));

-- Backfill existing rows
UPDATE trips
  SET transport_type = CASE WHEN has_flight = false THEN 'ingen' ELSE 'fly' END
  WHERE transport_type = 'fly';
