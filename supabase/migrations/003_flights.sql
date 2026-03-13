-- =============================================
-- FLYINFORMASJON
-- =============================================
create table if not exists flights (
  id               uuid primary key default uuid_generate_v4(),
  trip_id          uuid references trips(id) on delete cascade not null,
  direction        text not null check (direction in ('outbound', 'return')),

  -- Etappe 1
  leg1_from        text,                  -- avreiseflyplass / -by
  leg1_departure   text,                  -- avgangstid HH:MM
  leg1_flight_nr   text,                  -- flightnummer
  leg1_to          text,                  -- mellomlanding ELLER endelig destinasjon
  leg1_arrival     text,                  -- ankomsttid HH:MM

  -- Mellomlanding
  has_stopover     boolean not null default false,
  stopover_duration text,                 -- tid på flyplass, f.eks. «1t 30min»

  -- Etappe 2 (etter mellomlanding)
  leg2_flight_nr   text,
  leg2_departure   text,                  -- avgangstid HH:MM
  leg2_to          text,                  -- endelig destinasjon
  leg2_arrival     text,                  -- ankomsttid HH:MM

  created_at       timestamptz default now(),

  unique (trip_id, direction)             -- maks én utreise og én hjemreise per tur
);

alter table flights enable row level security;

create policy "Tilgang via tur" on flights for all
  using (exists (
    select 1 from trips
    where trips.id = flights.trip_id
      and trips.owner_id = auth.uid()
  ));
