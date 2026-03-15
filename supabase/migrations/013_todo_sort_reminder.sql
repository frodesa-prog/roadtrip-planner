-- Legg til sort_order og reminder_date på todo_items
alter table todo_items add column if not exists sort_order integer default 0;
alter table todo_items add column if not exists reminder_date date;

-- Sett initial sort_order basert på created_at innen samme gruppe
update todo_items
set sort_order = sub.rn
from (
  select id,
    row_number() over (
      partition by trip_id, responsible
      order by created_at
    ) as rn
  from todo_items
) sub
where todo_items.id = sub.id;
