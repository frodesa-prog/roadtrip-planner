-- Arkivkolonne for notater (myk sletting)
alter table notes
  add column if not exists archived_at timestamptz;
