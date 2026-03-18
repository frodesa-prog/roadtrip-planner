-- ─── Chat attachments ─────────────────────────────────────────────────────────
-- Add attachment columns to trip_group_messages

ALTER TABLE trip_group_messages
  ADD COLUMN IF NOT EXISTS attachment_url  TEXT,
  ADD COLUMN IF NOT EXISTS attachment_name TEXT,
  ADD COLUMN IF NOT EXISTS attachment_type TEXT; -- 'image' | 'document'

-- ─── Storage bucket ───────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-attachments',
  'chat-attachments',
  true,
  10485760, -- 10 MB
  ARRAY[
    'image/jpeg','image/jpg','image/png','image/gif','image/webp','image/heic','image/heif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- ─── Storage RLS ──────────────────────────────────────────────────────────────
-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload chat attachments"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'chat-attachments');

-- Allow public read (bucket is public, but policy is still needed)
CREATE POLICY "Anyone can read chat attachments"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'chat-attachments');
