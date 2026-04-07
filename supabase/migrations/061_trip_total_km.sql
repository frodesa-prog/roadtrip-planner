-- Lagre faktisk kjørelengde (fra Google Directions API) på selve turen.
-- Brukes av minneboken i stedet for den unøyaktige Haversine-beregningen.
alter table trips
  add column if not exists total_km numeric(8,1);
