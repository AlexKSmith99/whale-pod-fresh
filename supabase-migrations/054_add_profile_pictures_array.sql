-- Add profile_pictures array column for multiple profile photos
-- The first element is always the default/primary profile picture
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profile_pictures text[] DEFAULT '{}';

-- Migrate existing profile_picture to profile_pictures array
UPDATE profiles
SET profile_pictures = ARRAY[profile_picture]
WHERE profile_picture IS NOT NULL
  AND profile_picture != ''
  AND (profile_pictures IS NULL OR array_length(profile_pictures, 1) IS NULL);

-- Add photos_visibility privacy column to privacy_preferences
ALTER TABLE privacy_preferences ADD COLUMN IF NOT EXISTS additional_photos_allowlist text[] DEFAULT ARRAY['connections', 'pod_members'];
