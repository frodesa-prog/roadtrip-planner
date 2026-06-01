alter table hotels
  add column if not exists has_washer   boolean default null,
  add column if not exists has_kitchen  boolean default null,
  add column if not exists has_breakfast boolean default null;
