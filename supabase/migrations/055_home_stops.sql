-- Add stop_type to distinguish home start/end from regular stops
alter table stops
  add column if not exists stop_type text not null default 'stop'
  check (stop_type in ('home_start', 'stop', 'home_end'));

-- Track whether a road trip ends at a different location than it started
alter table trips
  add column if not exists different_end_location boolean not null default false;
