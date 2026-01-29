-- Migration: 035_fix_meetings_recursion.sql
-- Description: Fix infinite recursion in meetings and related tables

-- Fix meetings table
DROP POLICY IF EXISTS "Users can view meetings for their pursuits" ON meetings;

CREATE POLICY "Authenticated users can view meetings"
  ON meetings FOR SELECT
  TO authenticated
  USING (true);

-- Fix meeting_participants table
DROP POLICY IF EXISTS "Users can view participants for their meetings" ON meeting_participants;

CREATE POLICY "Authenticated users can view meeting participants"
  ON meeting_participants FOR SELECT
  TO authenticated
  USING (true);

-- Fix meeting_agenda_items table
DROP POLICY IF EXISTS "Users can view agenda for their meetings" ON meeting_agenda_items;

CREATE POLICY "Authenticated users can view agenda items"
  ON meeting_agenda_items FOR SELECT
  TO authenticated
  USING (true);

-- Fix kickoff_time_proposals table
DROP POLICY IF EXISTS "Users can view proposals for their pursuits" ON kickoff_time_proposals;

CREATE POLICY "Authenticated users can view kickoff proposals"
  ON kickoff_time_proposals FOR SELECT
  TO authenticated
  USING (true);
