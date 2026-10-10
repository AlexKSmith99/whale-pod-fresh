-- ============================================================================
-- CATCH-UP: profiles table columns
-- Safe to run anytime — every statement is `IF NOT EXISTS`, so it only adds
-- what's missing and is a no-op for columns that already exist.
-- This guarantees the `profiles` table matches everything the app reads/writes
-- (fixes "Could not find the 'X' column of 'profiles' in the schema cache").
-- Covers migrations 047, 049, 051, 053, 054, 056, 069, 070, 071.
-- ============================================================================

-- Onboarding / basics (047, 051)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS date_of_birth date;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS age integer;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS gender text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS hometown text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS interests text[];
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS team_role_preference text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS team_size_preference text;

-- Bio, education, work (049, 056, 070)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS college text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS work text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS employer text;

-- Photos (054)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profile_pictures text[] DEFAULT '{}';

-- Lifestyle (069)  <-- the column that triggered your error
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS alcohol text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS drugs text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS workout_level text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS hobbies text;

-- Socials / links (053 + 071 for the 3 that had no migration)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS instagram text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS linkedin text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS facebook text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS github text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS portfolio_website text;

-- Refresh PostgREST's schema cache so the new columns are visible immediately.
NOTIFY pgrst, 'reload schema';
