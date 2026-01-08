-- Add resume_url column to pursuit_applications table
-- This allows applicants to attach a resume file when applying to pursuits that require one

ALTER TABLE pursuit_applications 
ADD COLUMN IF NOT EXISTS resume_url TEXT;

ALTER TABLE pursuit_applications 
ADD COLUMN IF NOT EXISTS resume_filename TEXT;

-- Create storage bucket for resumes if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('resumes', 'resumes', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload resumes
CREATE POLICY "Users can upload their own resumes"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'resumes' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow anyone to read resumes (for reviewers)
CREATE POLICY "Resumes are publicly readable"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'resumes');

-- Allow users to update their own resumes
CREATE POLICY "Users can update their own resumes"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'resumes' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to delete their own resumes
CREATE POLICY "Users can delete their own resumes"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'resumes' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
