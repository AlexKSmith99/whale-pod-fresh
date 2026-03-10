-- Add onboarding fields to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS date_of_birth date;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS interests text[];
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS team_role_preference text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS team_size_preference text;

-- Grandfather existing users who already have a profile set up
UPDATE profiles SET onboarding_completed = true WHERE name IS NOT NULL AND name != '';
