-- Add cover_image_url to pursuits + create the pod-covers storage bucket.
-- Used by the Feed and PursuitDetail screens to display a hero image per pod.

ALTER TABLE pursuits ADD COLUMN IF NOT EXISTS cover_image_url TEXT;

INSERT INTO storage.buckets (id, name, public)
VALUES ('pod-covers', 'pod-covers', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Pod covers public read" ON storage.objects;
DROP POLICY IF EXISTS "Pod covers authenticated upload" ON storage.objects;
DROP POLICY IF EXISTS "Pod covers owner update" ON storage.objects;
DROP POLICY IF EXISTS "Pod covers owner delete" ON storage.objects;

CREATE POLICY "Pod covers public read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'pod-covers');

-- Path convention: <userId>/<filename>.jpg — folder name = uploader's auth.uid().
CREATE POLICY "Pod covers authenticated upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'pod-covers'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Pod covers owner update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'pod-covers'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Pod covers owner delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'pod-covers'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
