-- Migration 008: knytt notater til stopp og gi dem en valgfri dato
alter table notes
  add column if not exists stop_id  uuid references stops(id) on delete cascade,
  add column if not exists note_date date;
