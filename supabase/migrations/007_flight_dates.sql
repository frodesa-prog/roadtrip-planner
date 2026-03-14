-- Add flight_date column to flights table
-- Stores the departure date for each flight direction (outbound / return)
alter table flights
  add column if not exists flight_date date;
