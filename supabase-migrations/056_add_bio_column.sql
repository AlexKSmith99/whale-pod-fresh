-- Add bio field to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio text;
