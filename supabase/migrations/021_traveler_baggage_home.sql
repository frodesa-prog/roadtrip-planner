-- Bagasjekvote for hjemreise (utreise-felt ble lagt til i 020)
alter table travelers
  add column if not exists cabin_bags_home         integer default 1,
  add column if not exists cabin_bag_weight_home   numeric(5,1) default 8,
  add column if not exists checked_bags_home       integer default 1,
  add column if not exists checked_bag_weight_home numeric(5,1) default 23;
