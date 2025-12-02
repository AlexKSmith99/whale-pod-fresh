-- Fix RLS policies using SECURITY DEFINER function to break recursion

-- Drop existing policies
DROP POLICY IF EXISTS "meeting_participants_select" ON meeting_participants;
DROP POLICY IF EXISTS "meeting_participants_insert" ON meeting_participants;
DROP POLICY IF EXISTS "meeting_participants_update" ON meeting_participants;
DROP POLICY IF EXISTS "meeting_participants_delete" ON meeting_participants;

DROP POLICY IF EXISTS "meetings_select" ON meetings;
DROP POLICY IF EXISTS "meetings_insert" ON meetings;
DROP POLICY IF EXISTS "meetings_update" ON meetings;
DROP POLICY IF EXISTS "meetings_delete" ON meetings;

-- Create a security definer function to check if user is meeting participant
-- This bypasses RLS to avoid infinite recursion
CREATE OR REPLACE FUNCTION is_meeting_participant(meeting_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM meeting_participants
    WHERE meeting_id = meeting_uuid
    AND user_id = user_uuid
  );
$$;

-- Create a security definer function to check if user is meeting creator
CREATE OR REPLACE FUNCTION is_meeting_creator(meeting_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM meetings
    WHERE id = meeting_uuid
    AND creator_id = user_uuid
  );
$$;

-- Create RLS policies for meetings using the security definer functions
CREATE POLICY "meetings_select" ON meetings
  FOR SELECT
  USING (
    creator_id = auth.uid()
    OR
    is_meeting_participant(id, auth.uid())
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

-- Create RLS policies for meeting_participants
CREATE POLICY "meeting_participants_select" ON meeting_participants
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR
    is_meeting_creator(meeting_id, auth.uid())
  );

CREATE POLICY "meeting_participants_insert" ON meeting_participants
  FOR INSERT
  WITH CHECK (is_meeting_creator(meeting_id, auth.uid()));

CREATE POLICY "meeting_participants_update" ON meeting_participants
  FOR UPDATE
  USING (
    user_id = auth.uid()
    OR
    is_meeting_creator(meeting_id, auth.uid())
  );

CREATE POLICY "meeting_participants_delete" ON meeting_participants
  FOR DELETE
  USING (is_meeting_creator(meeting_id, auth.uid()));
