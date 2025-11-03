-- ============================================
-- COMPLETE KICKOFF FEATURE DATABASE SETUP
-- Run this ONCE to create all required tables
-- ============================================

-- 1. NOTIFICATIONS TABLE
-- Stores all user notifications
DROP TABLE IF EXISTS notifications CASCADE;

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'pod_ready_for_kickoff',
    'new_message',
    'connection_request',
    'pod_available',
    'kickoff_scheduled',
    'time_slot_request'
  )),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  related_id UUID, -- pursuit_id, message_id, user_id, etc.
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_read ON notifications(read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX idx_notifications_user_read ON notifications(user_id, read);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (true);


-- 2. TIME_SLOT_PROPOSALS TABLE
-- Stores time slot proposals from team members
DROP TABLE IF EXISTS time_slot_proposals CASCADE;

CREATE TABLE time_slot_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pursuit_id UUID NOT NULL REFERENCES pursuits(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  proposed_slots JSONB NOT NULL, -- Array of {datetime, location_type, location_details}
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(pursuit_id, user_id)
);

CREATE INDEX idx_time_slot_proposals_pursuit ON time_slot_proposals(pursuit_id);
CREATE INDEX idx_time_slot_proposals_user ON time_slot_proposals(user_id);

ALTER TABLE time_slot_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view proposals for their pursuits"
  ON time_slot_proposals FOR SELECT
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM pursuits
      WHERE pursuits.id = time_slot_proposals.pursuit_id
      AND pursuits.creator_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own proposals"
  ON time_slot_proposals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own proposals"
  ON time_slot_proposals FOR UPDATE
  USING (auth.uid() = user_id);


-- 3. KICKOFF_MEETINGS TABLE
-- Stores scheduled kickoff meetings
DROP TABLE IF EXISTS kickoff_meetings CASCADE;

CREATE TABLE kickoff_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pursuit_id UUID NOT NULL REFERENCES pursuits(id) ON DELETE CASCADE,
  scheduled_date TIMESTAMP WITH TIME ZONE NOT NULL,
  location_type TEXT NOT NULL CHECK (location_type IN ('video', 'in_person')),
  location_details TEXT,
  google_calendar_event_id TEXT,
  meeting_notes_id UUID,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(pursuit_id)
);

CREATE INDEX idx_kickoff_meetings_pursuit ON kickoff_meetings(pursuit_id);
CREATE INDEX idx_kickoff_meetings_creator ON kickoff_meetings(created_by);
CREATE INDEX idx_kickoff_meetings_scheduled_date ON kickoff_meetings(scheduled_date);

ALTER TABLE kickoff_meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view kickoff meetings for their pursuits"
  ON kickoff_meetings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM pursuits
      WHERE pursuits.id = kickoff_meetings.pursuit_id
      AND (pursuits.creator_id = auth.uid() OR
           EXISTS (SELECT 1 FROM team_members
                   WHERE team_members.pursuit_id = pursuits.id
                   AND team_members.user_id = auth.uid()))
    )
  );

CREATE POLICY "Creators can insert kickoff meetings"
  ON kickoff_meetings FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pursuits
      WHERE pursuits.id = kickoff_meetings.pursuit_id
      AND pursuits.creator_id = auth.uid()
    )
  );

CREATE POLICY "Creators can update kickoff meetings"
  ON kickoff_meetings FOR UPDATE
  USING (auth.uid() = created_by);


-- 4. MEETING_NOTES TABLE (Optional - for future use)
-- Stores pre-meeting and post-meeting notes
DROP TABLE IF EXISTS meeting_notes CASCADE;

CREATE TABLE meeting_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kickoff_meeting_id UUID NOT NULL REFERENCES kickoff_meetings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  notes TEXT NOT NULL,
  is_shared BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_meeting_notes_kickoff ON meeting_notes(kickoff_meeting_id);
CREATE INDEX idx_meeting_notes_user ON meeting_notes(user_id);

ALTER TABLE meeting_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notes and shared notes"
  ON meeting_notes FOR SELECT
  USING (auth.uid() = user_id OR is_shared = true);

CREATE POLICY "Users can insert own notes"
  ON meeting_notes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notes"
  ON meeting_notes FOR UPDATE
  USING (auth.uid() = user_id);


-- 5. ADD COLUMNS TO PURSUITS TABLE
-- Add kickoff-related columns if they don't exist
ALTER TABLE pursuits
ADD COLUMN IF NOT EXISTS requesting_time_slots BOOLEAN DEFAULT false;

ALTER TABLE pursuits
ADD COLUMN IF NOT EXISTS kickoff_scheduled BOOLEAN DEFAULT false;

ALTER TABLE pursuits
ADD COLUMN IF NOT EXISTS kickoff_date TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_pursuits_requesting_time_slots ON pursuits(requesting_time_slots);
CREATE INDEX IF NOT EXISTS idx_pursuits_kickoff_scheduled ON pursuits(kickoff_scheduled);


-- ============================================
-- VERIFICATION QUERIES
-- Run these to verify everything was created
-- ============================================

-- Verify notifications table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'notifications'
ORDER BY ordinal_position;

-- Verify time_slot_proposals table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'time_slot_proposals'
ORDER BY ordinal_position;

-- Verify kickoff_meetings table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'kickoff_meetings'
ORDER BY ordinal_position;

-- Verify meeting_notes table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'meeting_notes'
ORDER BY ordinal_position;

-- Verify pursuits table has new columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'pursuits'
AND column_name IN ('requesting_time_slots', 'kickoff_scheduled', 'kickoff_date')
ORDER BY ordinal_position;


-- ============================================
-- SUMMARY
-- ============================================
-- This script creates:
-- 1. notifications - with all required columns (id, user_id, type, title, message, related_id, read, created_at)
-- 2. time_slot_proposals - for team member time proposals
-- 3. kickoff_meetings - for scheduled meetings
-- 4. meeting_notes - for pre/post meeting notes
-- 5. Adds columns to pursuits - requesting_time_slots, kickoff_scheduled, kickoff_date
--
-- All tables include:
-- - Proper indexes for performance
-- - Row Level Security policies
-- - Cascade delete rules
-- - Constraints for data integrity
