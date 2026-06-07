-- Add optional Lifestyle fields to profiles (all nullable / optional)
-- Surfaced in the Bio section of Edit Profile: drinking, drug use, workout
-- activity level, and favorite hobbies.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS alcohol text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS drugs text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS workout_level text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS hobbies text;
