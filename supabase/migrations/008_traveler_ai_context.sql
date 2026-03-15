-- ── Skjult AI-kontekst på reisedeltakere ──────────────────────────────────────
-- Brukes til å sende mat/mobilitet/annen info til Ferietips-chatten
-- uten å vise det i turfølge-kortet i UI-et.

alter table travelers
  add column if not exists ai_context text;
