-- Gjøremål per tur
create table todo_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  description text not null,
  link text,
  responsible text not null default 'felles', -- 'felles' eller traveler-id
  completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz default now()
);

alter table todo_items enable row level security;

create policy "Trip members todo access" on todo_items for all
  using (
    exists (select 1 from trips where trips.id = todo_items.trip_id and trips.owner_id = auth.uid())
    or exists (
      select 1 from trip_shares
      where trip_shares.trip_id = todo_items.trip_id
        and trip_shares.shared_with_email = auth.email()
        and trip_shares.status = 'accepted'
    )
  );

-- Pakkeliste per tur
create table trip_packing_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  traveler_id uuid references travelers(id) on delete set null, -- null = felles
  item text not null,
  category text not null default 'other',
  packed boolean not null default false,
  created_at timestamptz default now()
);

alter table trip_packing_items enable row level security;

create policy "Trip members packing access" on trip_packing_items for all
  using (
    exists (select 1 from trips where trips.id = trip_packing_items.trip_id and trips.owner_id = auth.uid())
    or exists (
      select 1 from trip_shares
      where trip_shares.trip_id = trip_packing_items.trip_id
        and trip_shares.shared_with_email = auth.email()
        and trip_shares.status = 'accepted'
    )
  );
