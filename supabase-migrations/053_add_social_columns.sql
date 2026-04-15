-- Add Instagram and LinkedIn columns for onboarding social verification
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS instagram text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS linkedin text;
