-- Migration 013: legg til kategorifelt på mulige aktiviteter
ALTER TABLE possible_activities ADD COLUMN IF NOT EXISTS category text;
