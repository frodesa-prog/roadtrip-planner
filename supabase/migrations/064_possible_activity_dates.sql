-- Add multi-date support for possible activities
alter table possible_activities
  add column if not exists activity_dates text[] not null default '{}';

-- Migrate existing single-date rows into the new array column
update possible_activities
  set activity_dates = array[activity_date]
  where activity_date is not null
    and activity_dates = '{}';
