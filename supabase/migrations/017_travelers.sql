-- Turfølge: personer som er med på reisen
CREATE TABLE IF NOT EXISTS travelers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id     uuid REFERENCES trips(id) ON DELETE CASCADE NOT NULL,
  name        text NOT NULL DEFAULT '',
  age         integer,
  gender      text,         -- 'mann' | 'kvinne' | 'annet'
  interests   text,         -- kommaseparert, f.eks. "Baseball,Friluftsliv,Mat"
  description text,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE travelers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Brukere kan se egne reisende"
  ON travelers FOR SELECT
  USING (trip_id IN (SELECT id FROM trips WHERE owner_id = auth.uid()));

CREATE POLICY "Brukere kan opprette reisende"
  ON travelers FOR INSERT
  WITH CHECK (trip_id IN (SELECT id FROM trips WHERE owner_id = auth.uid()));

CREATE POLICY "Brukere kan oppdatere reisende"
  ON travelers FOR UPDATE
  USING (trip_id IN (SELECT id FROM trips WHERE owner_id = auth.uid()));

CREATE POLICY "Brukere kan slette reisende"
  ON travelers FOR DELETE
  USING (trip_id IN (SELECT id FROM trips WHERE owner_id = auth.uid()));
