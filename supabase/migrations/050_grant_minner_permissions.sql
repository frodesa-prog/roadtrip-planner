-- Gir authenticated-rollen tilgang til alle minnebok-tabeller.
-- RLS-policiene styrer hvem som faktisk får lese/skrive hva,
-- men GRANT må ligge i bunnen for at Supabase REST API skal slippe inn.

grant select, insert, update, delete on table trip_memories  to authenticated;
grant select, insert, update, delete on table memory_entries to authenticated;
grant select, insert, update, delete on table memory_photos  to authenticated;

-- anon-rollen får kun SELECT (for offentlige minnebøker via public slug)
grant select on table trip_memories  to anon;
grant select on table memory_entries to anon;
grant select on table memory_photos  to anon;
