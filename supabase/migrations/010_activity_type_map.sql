-- Migration 010: aktivitetstype og kart-koordinater
ALTER TABLE activities
  ADD COLUMN IF NOT EXISTS activity_type text,
  ADD COLUMN IF NOT EXISTS map_lat       double precision,
  ADD COLUMN IF NOT EXISTS map_lng       double precision;
