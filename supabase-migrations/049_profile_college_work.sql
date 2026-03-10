-- Add college and work fields to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS college text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS work text;
