-- ── Fødselsdato og kjønn på brukerprofil ─────────────────────────────────────
-- Fødselsdato brukes til å beregne alder som vises i turfølge.
-- Kjønn samsvarer med verdiene på travelers-tabellen ('mann' | 'kvinne' | 'annet').

alter table user_profiles
  add column if not exists birth_date date,
  add column if not exists gender    text;
