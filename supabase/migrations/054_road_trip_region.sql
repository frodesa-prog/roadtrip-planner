-- Add road_trip_region to trips table
-- 'usa' = US road trip (count states), 'international' = non-US (count countries)
alter table trips
  add column if not exists road_trip_region text
    check (road_trip_region in ('usa', 'international'));
