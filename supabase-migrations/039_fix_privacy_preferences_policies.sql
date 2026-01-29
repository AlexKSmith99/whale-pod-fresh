-- Migration 039: Fix Privacy Preferences RLS Policies
-- Simplifies and fixes RLS policies for privacy_preferences table

-- Drop existing policies to recreate them properly
DROP POLICY IF EXISTS "Users can view own privacy preferences" ON privacy_preferences;
DROP POLICY IF EXISTS "Users can insert own privacy preferences" ON privacy_preferences;
DROP POLICY IF EXISTS "Users can update own privacy preferences" ON privacy_preferences;
DROP POLICY IF EXISTS "Authenticated users can read privacy preferences for visibility checks" ON privacy_preferences;

-- Create simplified policies
-- Allow all authenticated users to SELECT (needed for visibility checks)
CREATE POLICY "Allow authenticated users to read privacy preferences"
  ON privacy_preferences FOR SELECT
  TO authenticated
  USING (true);

-- Allow users to INSERT their own preferences
CREATE POLICY "Allow users to insert own privacy preferences"
  ON privacy_preferences FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

-- Allow users to UPDATE their own preferences
CREATE POLICY "Allow users to update own privacy preferences"
  ON privacy_preferences FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

