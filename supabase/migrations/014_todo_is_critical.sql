-- Legg til is_critical-flagg på todo_items
alter table todo_items
  add column if not exists is_critical boolean not null default false;
