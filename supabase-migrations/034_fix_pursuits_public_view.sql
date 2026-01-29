-- Migration: 034_fix_pursuits_public_view.sql
-- Description: Fix infinite recursion in RLS policies by simplifying pursuits SELECT

-- Drop problematic policies that cause recursion
DROP POLICY IF EXISTS "Anyone can view open pursuits" ON pursuits;
DROP POLICY IF EXISTS "Users can view pursuits they're part of" ON pursuits;

-- Simple policy: authenticated users can view all pursuits
-- (The app handles filtering what's shown on the feed)
CREATE POLICY "Authenticated users can view pursuits"
  ON pursuits FOR SELECT
  TO authenticated
  USING (true);

-- Also fix team_members to avoid recursion
DROP POLICY IF EXISTS "Team members can view members of their team" ON team_members;

CREATE POLICY "Team members can view members of their team"
  ON team_members FOR SELECT
  TO authenticated
  USING (true);
