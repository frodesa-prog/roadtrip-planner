-- KM-stand ved henting og levering av leiebil
alter table car_rentals
  add column if not exists km_start integer,
  add column if not exists km_end   integer;
