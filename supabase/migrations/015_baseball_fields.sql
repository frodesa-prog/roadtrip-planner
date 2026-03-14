-- Baseball-spesifikke felt på activities
ALTER TABLE activities
  ADD COLUMN IF NOT EXISTS stadium  text,   -- stadionnavn
  ADD COLUMN IF NOT EXISTS section  text,   -- felt / seksjon
  ADD COLUMN IF NOT EXISTS seat_row text,   -- rad
  ADD COLUMN IF NOT EXISTS seat     text;   -- sete
