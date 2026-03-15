-- Lar mottaker av en tursharing oppdatere sin egen status (pending → accepted)
create policy "Mottaker kan akseptere sin invitasjon"
  on trip_shares for update
  using (shared_with_email = auth.email())
  with check (shared_with_email = auth.email());
