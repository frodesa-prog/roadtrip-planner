-- Legg til expense_entries-tabell for Shopping, Mat og Diverse kategorier
CREATE TABLE IF NOT EXISTS expense_entries (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_id       UUID        NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  category      TEXT        NOT NULL,
  entry_date    DATE,
  name          TEXT        NOT NULL,
  amount        INTEGER     NOT NULL DEFAULT 0,
  stop_id       UUID        REFERENCES stops(id) ON DELETE SET NULL,
  activity_id   UUID        REFERENCES activities(id) ON DELETE SET NULL,
  dining_id     UUID        REFERENCES dining(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT expense_entries_category_check
    CHECK (category IN ('shopping', 'food', 'misc'))
);

-- RLS
ALTER TABLE expense_entries ENABLE ROW LEVEL SECURITY;

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
              AND ts.shared_with_email = (SELECT email FROM auth.users WHERE id = auth.uid())
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
              AND ts.shared_with_email = (SELECT email FROM auth.users WHERE id = auth.uid())
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
              AND ts.shared_with_email = (SELECT email FROM auth.users WHERE id = auth.uid())
              AND ts.status = 'accepted'
          )
        )
    )
  );

-- Oppdater budget_items category constraint til å inkludere shopping, food, misc
ALTER TABLE budget_items
  DROP CONSTRAINT IF EXISTS budget_items_category_check;

ALTER TABLE budget_items
  ADD CONSTRAINT budget_items_category_check
    CHECK (category IN ('gas', 'car', 'flight', 'hotel', 'other', 'transport', 'parking', 'shopping', 'food', 'misc'));
