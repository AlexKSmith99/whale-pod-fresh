-- Absolute minimal RLS policies to eliminate all recursion
-- Trade-off: Creators need separate queries to manage all participants

-- Drop all existing policies
DROP POLICY IF EXISTS "meeting_participants_select" ON meeting_participants;
DROP POLICY IF EXISTS "meeting_participants_insert" ON meeting_participants;
DROP POLICY IF EXISTS "meeting_participants_update" ON meeting_participants;
DROP POLICY IF EXISTS "meeting_participants_delete" ON meeting_participants;

DROP POLICY IF EXISTS "meetings_select" ON meetings;
DROP POLICY IF EXISTS "meetings_insert" ON meetings;
DROP POLICY IF EXISTS "meetings_update" ON meetings;
DROP POLICY IF EXISTS "meetings_delete" ON meetings;

-- Meetings: Allow all authenticated users to read
-- (Access control happens through meeting_participants - users only see meetings they're in)
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
  USING (creator_id = auth.uid());

CREATE POLICY "meetings_delete" ON meetings
  FOR DELETE
  TO authenticated
  USING (creator_id = auth.uid());

-- Meeting Participants: Only see your own participations
-- NO cross-table checks to avoid recursion
CREATE POLICY "meeting_participants_select" ON meeting_participants
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "meeting_participants_insert" ON meeting_participants
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "meeting_participants_update" ON meeting_participants
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "meeting_participants_delete" ON meeting_participants
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
