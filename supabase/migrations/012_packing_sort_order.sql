-- Legg til sort_order for rekkefølge i pakkelisten
alter table trip_packing_items add column if not exists sort_order integer default 0;

-- Sett initial sort_order for eksisterende elementer basert på created_at
update trip_packing_items
set sort_order = sub.rn
from (
  select id,
    row_number() over (
      partition by trip_id, coalesce(traveler_id::text, 'felles'), category
      order by created_at
    ) as rn
  from trip_packing_items
) sub
where trip_packing_items.id = sub.id;
