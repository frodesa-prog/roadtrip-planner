-- Sikre at linked_user_id-kolonnen finnes på travelers-tabellen.
-- Migration 006 forsøkte å legge til kolonnen, men travelers-tabellen
-- ble først opprettet i 017, så 006 kan ha feilet i noen miljøer.

ALTER TABLE travelers
  ADD COLUMN IF NOT EXISTS linked_user_id uuid REFERENCES auth.users(id);
