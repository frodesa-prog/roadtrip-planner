-- Add hotel_id to memory_photos so photos can be linked to hotels
alter table memory_photos
  add column if not exists hotel_id uuid references hotels(id) on delete set null;

create index if not exists memory_photos_hotel_id_idx on memory_photos(hotel_id);
