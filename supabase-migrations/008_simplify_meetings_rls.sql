-- Simplify RLS policies to eliminate circular dependencies
-- Strategy: Make meetings readable by all authenticated users,
-- and control access through meeting_participants table

-- Drop existing policies
DROP POLICY IF EXISTS "meeting_participants_select" ON meeting_participants;
DROP POLICY IF EXISTS "meeting_participants_insert" ON meeting_participants;
DROP POLICY IF EXISTS "meeting_participants_update" ON meeting_participants;
DROP POLICY IF EXISTS "meeting_participants_delete" ON meeting_participants;

DROP POLICY IF EXISTS "meetings_select" ON meetings;
DROP POLICY IF EXISTS "meetings_insert" ON meetings;
DROP POLICY IF EXISTS "meetings_update" ON meetings;
DROP POLICY IF EXISTS "meetings_delete" ON meetings;

-- Drop the security definer functions (no longer needed)
DROP FUNCTION IF EXISTS is_meeting_participant(UUID, UUID);
DROP FUNCTION IF EXISTS is_meeting_creator(UUID, UUID);

-- Simple RLS policies for meetings table
-- Allow all authenticated users to read meetings (access control via meeting_participants)
CREATE POLICY "meetings_select" ON meetings
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "meetings_insert" ON meetings
  FOR INSERT
  TO authenticated
  WITH CHECK (creator_id = auth.uid());

CREATE POLICY "meetings_update" ON meetings
  FOR UPDATE
  TO authenticated
  USING (creator_id = auth.uid())
  WITH CHECK (creator_id = auth.uid());

CREATE POLICY "meetings_delete" ON meetings
  FOR DELETE
  TO authenticated
  USING (creator_id = auth.uid());

-- Simple RLS policies for meeting_participants
-- Users can only see their own participations or meetings they created
CREATE POLICY "meeting_participants_select" ON meeting_participants
  FOR SELECT
  TO authenticated
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
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM meetings
      WHERE meetings.id = meeting_participants.meeting_id
      AND meetings.creator_id = auth.uid()
    )
  );

CREATE POLICY "meeting_participants_update" ON meeting_participants
  FOR UPDATE
  TO authenticated
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
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM meetings
      WHERE meetings.id = meeting_participants.meeting_id
      AND meetings.creator_id = auth.uid()
    )
  );
