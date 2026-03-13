-- Leiebil-informasjon knyttet til en tur
create table if not exists car_rentals (
  id               uuid primary key default gen_random_uuid(),
  trip_id          uuid references trips(id) on delete cascade not null,
  company          text,           -- Leiebilfirma
  car_type         text,           -- Type bil
  reference_nr     text,           -- Referansenr.
  confirmation_nr  text,           -- Bekreftelsesnr.
  url              text,           -- Link til bestilling
  notes            text,           -- Tilleggsinfo
  unique(trip_id)
);

alter table car_rentals enable row level security;

create policy "Users manage own car rentals"
  on car_rentals for all
  using (
    exists (
      select 1 from trips
      where trips.id = car_rentals.trip_id
        and trips.owner_id = auth.uid()
    )
  );
