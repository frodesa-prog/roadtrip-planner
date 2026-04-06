-- Fiks RLS-policyer for expense_entries: bruk auth.email() istedenfor
-- (SELECT email FROM auth.users WHERE id = auth.uid()) som er blokkert.

DROP POLICY IF EXISTS "Tureiere og reisende kan se expense_entries"        ON expense_entries;
DROP POLICY IF EXISTS "Tureiere og reisende kan legge til expense_entries" ON expense_entries;
DROP POLICY IF EXISTS "Tureiere og reisende kan slette expense_entries"    ON expense_entries;

CREATE POLICY "Tureiere og reisende kan se expense_entries"
  ON expense_entries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM trips t
      WHERE t.id = expense_entries.trip_id
        AND (
          t.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM trip_shares ts
            WHERE ts.trip_id = t.id
              AND ts.shared_with_email = auth.email()
              AND ts.status = 'accepted'
          )
        )
    )
  );

CREATE POLICY "Tureiere og reisende kan legge til expense_entries"
  ON expense_entries FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM trips t
      WHERE t.id = expense_entries.trip_id
        AND (
          t.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM trip_shares ts
            WHERE ts.trip_id = t.id
              AND ts.shared_with_email = auth.email()
              AND ts.status = 'accepted'
          )
        )
    )
  );

CREATE POLICY "Tureiere og reisende kan slette expense_entries"
  ON expense_entries FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM trips t
      WHERE t.id = expense_entries.trip_id
        AND (
          t.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM trip_shares ts
            WHERE ts.trip_id = t.id
              AND ts.shared_with_email = auth.email()
              AND ts.status = 'accepted'
          )
        )
    )
  );
