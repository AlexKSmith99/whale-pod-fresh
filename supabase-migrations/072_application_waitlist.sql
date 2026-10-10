-- Application / waitlist signup flow.
-- New members apply and land on a waiting list (application_status='pending')
-- until an admin approves them (application_status='approved').

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS application_status text;   -- 'pending' | 'approved' | 'rejected' | NULL (legacy = allowed)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS username text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS building text;             -- "what are you building / want to build"
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS looking_for text;          -- "what are you looking for in a pod"
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS selfie_url text;           -- real-time selfie verification image

-- Existing members must not be gated behind the waiting list: treat any
-- pre-existing profile as already approved.
UPDATE profiles SET application_status = 'approved' WHERE application_status IS NULL;

-- Case-insensitive uniqueness for usernames (only where set).
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_key
  ON profiles (lower(username)) WHERE username IS NOT NULL;

NOTIFY pgrst, 'reload schema';
