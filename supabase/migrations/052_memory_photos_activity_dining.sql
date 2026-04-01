-- Link memory photos to specific activities or dining spots
alter table memory_photos
  add column if not exists activity_id uuid references activities(id) on delete set null,
  add column if not exists dining_id   uuid references dining(id)     on delete set null;

create index if not exists memory_photos_activity_idx on memory_photos(activity_id);
create index if not exists memory_photos_dining_idx   on memory_photos(dining_id);
