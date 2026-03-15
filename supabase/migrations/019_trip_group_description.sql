-- Add a free-text description for the travel group to the trips table.
-- This is used by the Ferietips chat to give context about who is travelling.
ALTER TABLE trips ADD COLUMN IF NOT EXISTS group_description TEXT;
