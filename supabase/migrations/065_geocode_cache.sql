-- Persistent cache for reverse geocoding results (lat/lng → state, country, city)
-- Coordinates are rounded to 4 decimal places (~11 m precision) as the primary key.
-- This avoids repeated Google Geocoding API calls for the same location.

create table if not exists geocode_cache (
  lat      numeric(8,4) not null,
  lng      numeric(8,4) not null,
  state    text,
  country  text,
  city     text,
  cached_at timestamptz not null default now(),
  primary key (lat, lng)
);

alter table geocode_cache enable row level security;

-- API routes use the anon key – allow full read/write on this table
create policy "geocode_cache_select" on geocode_cache for select using (true);
create policy "geocode_cache_insert" on geocode_cache for insert with check (true);
create policy "geocode_cache_update" on geocode_cache for update using (true);
