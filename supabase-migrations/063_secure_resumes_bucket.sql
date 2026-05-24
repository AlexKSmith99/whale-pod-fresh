-- Migration: 063_secure_resumes_bucket.sql
-- Description: Resumes bucket is currently public — anyone can list and download every
-- resume (PII). Make the bucket private, drop the public-read policy, and gate SELECT
-- on (a) the uploader, or (b) pod creators reviewing applications that reference the file.
-- Client code must switch from getPublicUrl() to createSignedUrl() to read.

-- Make the bucket private
UPDATE storage.buckets SET public = false WHERE id = 'resumes';

-- Remove the wide-open SELECT policy
DROP POLICY IF EXISTS "Resumes are publicly readable" ON storage.objects;

-- Uploaders can read their own resumes
CREATE POLICY "Users can read own resumes"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'resumes'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);

-- Pod creators can read resumes attached to applications for their pursuits.
-- pursuit_applications.resume_url stores the object name (path within the bucket).
CREATE POLICY "Pod creators can read applicant resumes"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'resumes'
  AND EXISTS (
    SELECT 1
    FROM public.pursuit_applications pa
    JOIN public.pursuits p ON p.id = pa.pursuit_id
    WHERE p.creator_id = auth.uid()
      AND pa.resume_url = storage.objects.name
  )
);
