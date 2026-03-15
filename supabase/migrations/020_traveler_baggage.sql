-- Bagasjekvote per reisende
alter table travelers
  add column if not exists cabin_bags        integer default 1,
  add column if not exists cabin_bag_weight  numeric(5,1) default 8,
  add column if not exists checked_bags      integer default 1,
  add column if not exists checked_bag_weight numeric(5,1) default 23;
