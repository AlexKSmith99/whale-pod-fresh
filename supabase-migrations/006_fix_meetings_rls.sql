-- Fix RLS policies for meetings system to avoid infinite recursion

-- Drop existing policies
DROP POLICY IF EXISTS "meeting_participants_select" ON meeting_participants;
DROP POLICY IF EXISTS "meeting_participants_insert" ON meeting_participants;
DROP POLICY IF EXISTS "meeting_participants_update" ON meeting_participants;
DROP POLICY IF EXISTS "meeting_participants_delete" ON meeting_participants;

DROP POLICY IF EXISTS "meetings_select" ON meetings;
DROP POLICY IF EXISTS "meetings_insert" ON meetings;
DROP POLICY IF EXISTS "meetings_update" ON meetings;
DROP POLICY IF EXISTS "meetings_delete" ON meetings;

-- Create simplified RLS policies for meetings
CREATE POLICY "meetings_select" ON meetings
  FOR SELECT
  USING (
    creator_id = auth.uid()
    OR
    id IN (
      SELECT meeting_id FROM meeting_participants WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "meetings_insert" ON meetings
  FOR INSERT
  WITH CHECK (creator_id = auth.uid());

CREATE POLICY "meetings_update" ON meetings
  FOR UPDATE
  USING (creator_id = auth.uid())
  WITH CHECK (creator_id = auth.uid());

CREATE POLICY "meetings_delete" ON meetings
  FOR DELETE
  USING (creator_id = auth.uid());

-- Create simplified RLS policies for meeting_participants
-- Use a direct check without recursive queries
CREATE POLICY "meeting_participants_select" ON meeting_participants
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM meetings
      WHERE meetings.id = meeting_participants.meeting_id
      AND meetings.creator_id = auth.uid()
    )
  );

CREATE POLICY "meeting_participants_insert" ON meeting_participants
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM meetings
      WHERE meetings.id = meeting_participants.meeting_id
      AND meetings.creator_id = auth.uid()
    )
  );

CREATE POLICY "meeting_participants_update" ON meeting_participants
  FOR UPDATE
  USING (
    user_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM meetings
      WHERE meetings.id = meeting_participants.meeting_id
      AND meetings.creator_id = auth.uid()
    )
  );

CREATE POLICY "meeting_participants_delete" ON meeting_participants
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM meetings
      WHERE meetings.id = meeting_participants.meeting_id
      AND meetings.creator_id = auth.uid()
    )
  );
