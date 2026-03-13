-- Adresse på hotell
alter table hotels add column if not exists address text;

-- Klokkeslett for aktiviteter (HH:MM-format)
alter table activities add column if not exists activity_time text;
