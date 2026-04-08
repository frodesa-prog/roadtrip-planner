-- Permanent lagring av AI-genererte bybeskrivelser (norsk, 2 setninger).
-- Deles på tvers av brukere – samme by får samme tekst.
-- Autentiserte brukere kan lese og redigere.

create table if not exists city_descriptions (
  id          uuid primary key default gen_random_uuid(),
  city        text not null,
  state       text,
  country     text,
  extract     text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (city, coalesce(state, ''), coalesce(country, ''))
);

-- Offentlig lesing (trengs for delte minnebøker)
alter table city_descriptions enable row level security;

create policy "Alle kan lese bybeskrivelser"
  on city_descriptions for select
  using (true);

create policy "Innloggede brukere kan opprette bybeskrivelser"
  on city_descriptions for insert
  to authenticated
  with check (true);

create policy "Innloggede brukere kan oppdatere bybeskrivelser"
  on city_descriptions for update
  to authenticated
  using (true)
  with check (true);
