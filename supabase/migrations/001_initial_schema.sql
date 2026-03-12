-- =============================================
-- Roadtrip Planner – Database Schema
-- Kjør denne i Supabase SQL Editor
-- =============================================

-- Aktiver UUID-generering
create extension if not exists "uuid-ossp";

-- =============================================
-- TURER
-- =============================================
create table trips (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  year        integer not null,
  status      text not null default 'planning' check (status in ('planning', 'archived')),
  owner_id    uuid references auth.users(id) on delete cascade,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- =============================================
-- STOPPESTEDER
-- =============================================
create table stops (
  id            uuid primary key default uuid_generate_v4(),
  trip_id       uuid references trips(id) on delete cascade,
  city          text not null,
  state         text not null,
  lat           double precision not null,
  lng           double precision not null,
  "order"       integer not null default 0,
  arrival_date  date,
  nights        integer not null default 1,
  notes         text,
  created_at    timestamptz default now()
);

-- =============================================
-- HOTELLER
-- =============================================
create table hotels (
  id                    uuid primary key default uuid_generate_v4(),
  stop_id               uuid references stops(id) on delete cascade,
  name                  text not null,
  url                   text,
  status                text not null default 'not_booked' check (status in ('not_booked', 'confirmed')),
  cost                  numeric(10,2),
  confirmation_number   text,
  created_at            timestamptz default now()
);

-- =============================================
-- AKTIVITETER
-- =============================================
create table activities (
  id          uuid primary key default uuid_generate_v4(),
  stop_id     uuid references stops(id) on delete cascade,
  name        text not null,
  url         text,
  cost        numeric(10,2),
  notes       text,
  created_at  timestamptz default now()
);

-- =============================================
-- BILDER
-- =============================================
create table photos (
  id            uuid primary key default uuid_generate_v4(),
  trip_id       uuid references trips(id) on delete cascade,
  stop_id       uuid references stops(id) on delete set null,
  storage_path  text not null,
  lat           double precision,
  lng           double precision,
  taken_at      timestamptz,
  caption       text,
  created_at    timestamptz default now()
);

-- =============================================
-- BUDSJETT
-- =============================================
create table budget_items (
  id          uuid primary key default uuid_generate_v4(),
  trip_id     uuid references trips(id) on delete cascade,
  category    text not null check (category in ('gas', 'car', 'flight', 'hotel', 'other')),
  amount      numeric(10,2) not null,
  notes       text,
  created_at  timestamptz default now()
);

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- Kun eieren ser sine egne turer
-- =============================================
alter table trips        enable row level security;
alter table stops        enable row level security;
alter table hotels       enable row level security;
alter table activities   enable row level security;
alter table photos       enable row level security;
alter table budget_items enable row level security;

-- Trips: eier ser alt
create policy "Eier kan se egne turer"     on trips for select using (auth.uid() = owner_id);
create policy "Eier kan opprette turer"    on trips for insert with check (auth.uid() = owner_id);
create policy "Eier kan oppdatere turer"   on trips for update using (auth.uid() = owner_id);
create policy "Eier kan slette turer"      on trips for delete using (auth.uid() = owner_id);

-- Stops, hotels, activities, photos, budget_items: tilgang via trip-eier
create policy "Tilgang via tur" on stops for all
  using (exists (select 1 from trips where trips.id = stops.trip_id and trips.owner_id = auth.uid()));

create policy "Tilgang via tur" on hotels for all
  using (exists (select 1 from stops join trips on trips.id = stops.trip_id
    where stops.id = hotels.stop_id and trips.owner_id = auth.uid()));

create policy "Tilgang via tur" on activities for all
  using (exists (select 1 from stops join trips on trips.id = stops.trip_id
    where stops.id = activities.stop_id and trips.owner_id = auth.uid()));

create policy "Tilgang via tur" on photos for all
  using (exists (select 1 from trips where trips.id = photos.trip_id and trips.owner_id = auth.uid()));

create policy "Tilgang via tur" on budget_items for all
  using (exists (select 1 from trips where trips.id = budget_items.trip_id and trips.owner_id = auth.uid()));

-- =============================================
-- STORAGE BUCKET for bilder
-- =============================================
insert into storage.buckets (id, name, public)
values ('trip-photos', 'trip-photos', false)
on conflict do nothing;

create policy "Autentiserte brukere kan laste opp bilder" on storage.objects
  for insert with check (bucket_id = 'trip-photos' and auth.role() = 'authenticated');

create policy "Brukere ser egne bilder" on storage.objects
  for select using (bucket_id = 'trip-photos' and auth.uid()::text = (storage.foldername(name))[1]);
