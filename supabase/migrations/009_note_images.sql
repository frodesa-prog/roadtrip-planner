-- Migration 009: bilder knyttet til notater

-- Opprett public storage-bucket for notatbilder
INSERT INTO storage.buckets (id, name, public)
VALUES ('note-images', 'note-images', true)
ON CONFLICT DO NOTHING;

-- Storage-policies (åpen for alle autentiserte brukere – bucket er public)
DROP POLICY IF EXISTS "Authenticated can upload note images" ON storage.objects;
CREATE POLICY "Authenticated can upload note images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'note-images');

DROP POLICY IF EXISTS "Authenticated can view note images" ON storage.objects;
CREATE POLICY "Authenticated can view note images"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'note-images');

DROP POLICY IF EXISTS "Authenticated can delete note images" ON storage.objects;
CREATE POLICY "Authenticated can delete note images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'note-images');

-- Tabell for å spore hvilke bilder som hører til hvilket notat
CREATE TABLE IF NOT EXISTS note_images (
  id           uuid primary key default uuid_generate_v4(),
  note_id      uuid references notes(id) on delete cascade not null,
  storage_path text not null,
  created_at   timestamptz default now()
);

ALTER TABLE note_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own note images" ON note_images;
CREATE POLICY "Users can manage own note images" ON note_images
  FOR ALL USING (
    note_id IN (
      SELECT n.id FROM notes n
      JOIN trips t ON t.id = n.trip_id
      WHERE t.owner_id = auth.uid()
    )
  );
