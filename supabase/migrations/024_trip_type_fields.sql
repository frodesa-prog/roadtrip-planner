-- 024: Add trip type and extra fields to trips table
-- Run in Supabase SQL Editor

ALTER TABLE trips
  ADD COLUMN IF NOT EXISTS trip_type TEXT NOT NULL DEFAULT 'road_trip'
    CHECK (trip_type IN ('road_trip', 'storbytur', 'resort')),
  ADD COLUMN IF NOT EXISTS has_flight BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS has_car_rental BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS date_from DATE,
  ADD COLUMN IF NOT EXISTS date_to DATE,
  ADD COLUMN IF NOT EXISTS destination_city TEXT,
  ADD COLUMN IF NOT EXISTS destination_country TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT;

-- Add transport as a valid budget_items category (for trips without car rental)
ALTER TABLE budget_items
  DROP CONSTRAINT IF EXISTS budget_items_category_check;

ALTER TABLE budget_items
  ADD CONSTRAINT budget_items_category_check
    CHECK (category IN ('gas', 'car', 'flight', 'hotel', 'other', 'transport'));
