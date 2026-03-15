-- ── Delt turtilgang: lesetilgang for inviterte brukere ──────────────────────────
-- Gjør at brukere som er invitert via trip_shares kan lese turen og dens data.
-- Kjøres i Supabase SQL Editor.

-- 1. La inviterte lese sine egne trip_shares-rader (så de kan se invitasjoner)
create policy "Les delt-med-meg invitasjoner"
  on trip_shares for select
  using (shared_with_email = auth.email());

-- 2. trips – lesetilgang for inviterte
create policy "Les delte turer"
  on trips for select
  using (
    exists (
      select 1 from trip_shares
      where trip_shares.trip_id = trips.id
        and trip_shares.shared_with_email = auth.email()
    )
  );

-- 3. stops – lesetilgang via delt tur
create policy "Les stopp på delt tur"
  on stops for select
  using (
    exists (
      select 1 from trip_shares
      where trip_shares.trip_id = stops.trip_id
        and trip_shares.shared_with_email = auth.email()
    )
  );

-- 4. hotels – lesetilgang via delt tur
create policy "Les hotell på delt tur"
  on hotels for select
  using (
    exists (
      select 1 from stops s
      join trip_shares ts on ts.trip_id = s.trip_id
      where s.id = hotels.stop_id
        and ts.shared_with_email = auth.email()
    )
  );

-- 5. activities – lesetilgang via delt tur
create policy "Les aktiviteter på delt tur"
  on activities for select
  using (
    exists (
      select 1 from stops s
      join trip_shares ts on ts.trip_id = s.trip_id
      where s.id = activities.stop_id
        and ts.shared_with_email = auth.email()
    )
  );

-- 6. photos – lesetilgang via delt tur
create policy "Les bilder på delt tur"
  on photos for select
  using (
    exists (
      select 1 from trip_shares
      where trip_shares.trip_id = photos.trip_id
        and trip_shares.shared_with_email = auth.email()
    )
  );

-- 7. budget_items – lesetilgang via delt tur
create policy "Les budsjett på delt tur"
  on budget_items for select
  using (
    exists (
      select 1 from trip_shares
      where trip_shares.trip_id = budget_items.trip_id
        and trip_shares.shared_with_email = auth.email()
    )
  );

-- 8. flights – lesetilgang via delt tur
create policy "Les fly på delt tur"
  on flights for select
  using (
    exists (
      select 1 from trip_shares
      where trip_shares.trip_id = flights.trip_id
        and trip_shares.shared_with_email = auth.email()
    )
  );

-- 9. car_rentals – lesetilgang via delt tur
create policy "Les leiebil på delt tur"
  on car_rentals for select
  using (
    exists (
      select 1 from trip_shares
      where trip_shares.trip_id = car_rentals.trip_id
        and trip_shares.shared_with_email = auth.email()
    )
  );

-- 10. travelers – lesetilgang via delt tur
create policy "Les reisende på delt tur"
  on travelers for select
  using (
    exists (
      select 1 from trip_shares
      where trip_shares.trip_id = travelers.trip_id
        and trip_shares.shared_with_email = auth.email()
    )
  );

-- 11. notes – lesetilgang via delt tur
create policy "Les notater på delt tur"
  on notes for select
  using (
    exists (
      select 1 from trip_shares
      where trip_shares.trip_id = notes.trip_id
        and trip_shares.shared_with_email = auth.email()
    )
  );

-- 12. dining – lesetilgang via delt tur
create policy "Les restauranter på delt tur"
  on dining for select
  using (
    exists (
      select 1 from stops s
      join trip_shares ts on ts.trip_id = s.trip_id
      where s.id = dining.stop_id
        and ts.shared_with_email = auth.email()
    )
  );

-- 13. possible_activities – lesetilgang via delt tur
create policy "Les mulige aktiviteter på delt tur"
  on possible_activities for select
  using (
    exists (
      select 1 from stops s
      join trip_shares ts on ts.trip_id = s.trip_id
      where s.id = possible_activities.stop_id
        and ts.shared_with_email = auth.email()
    )
  );

-- 14. route_legs – lesetilgang via delt tur
create policy "Les ruter på delt tur"
  on route_legs for select
  using (
    exists (
      select 1 from trip_shares
      where trip_shares.trip_id = route_legs.trip_id
        and trip_shares.shared_with_email = auth.email()
    )
  );

-- 15. chat_sessions – lesetilgang via delt tur
create policy "Les chatsessions på delt tur"
  on chat_sessions for select
  using (
    exists (
      select 1 from trip_shares
      where trip_shares.trip_id = chat_sessions.trip_id
        and trip_shares.shared_with_email = auth.email()
    )
  );

-- 16. chat_messages – lesetilgang via delt tur
create policy "Les chatmeldinger på delt tur"
  on chat_messages for select
  using (
    session_id in (
      select cs.id from chat_sessions cs
      join trip_shares ts on ts.trip_id = cs.trip_id
      where ts.shared_with_email = auth.email()
    )
  );
