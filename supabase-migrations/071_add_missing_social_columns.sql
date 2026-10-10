-- Add social/link columns that the app (EditProfileScreen, ProfileScreen) reads
-- and writes but which were never created by a migration: facebook, github,
-- portfolio_website. Without these, saving a profile fails with
-- "Could not find the 'facebook' column of 'profiles' in the schema cache".
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS facebook text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS github text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS portfolio_website text;
