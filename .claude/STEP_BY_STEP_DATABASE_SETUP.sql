-- ============================================
-- STEP-BY-STEP KICKOFF DATABASE SETUP
-- Copy and run EACH section separately
-- ============================================

-- ============================================
-- STEP 1: Fix notifications table
-- ============================================

-- Drop existing table (if it exists)
DROP TABLE IF EXISTS notifications CASCADE;

-- Create complete notifications table with ALL columns
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
  related_id UUID,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_read ON notifications(read);
CREATE INDEX idx_notifications_user_read ON notifications(user_id, read);

-- Add RLS
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

-- Verify Step 1
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'notifications'
ORDER BY ordinal_position;

-- You should see: id, user_id, type, title, message, related_id, read, created_at


-- ============================================
-- STEP 2: Create time_slot_proposals table
-- ============================================

DROP TABLE IF EXISTS time_slot_proposals CASCADE;

CREATE TABLE time_slot_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pursuit_id UUID NOT NULL REFERENCES pursuits(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  proposed_slots JSONB NOT NULL,
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

-- Verify Step 2
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'time_slot_proposals'
ORDER BY ordinal_position;


-- ============================================
-- STEP 3: Create kickoff_meetings table
-- ============================================

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

-- Verify Step 3
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'kickoff_meetings'
ORDER BY ordinal_position;


-- ============================================
-- STEP 4: Add columns to pursuits table
-- ============================================

ALTER TABLE pursuits
ADD COLUMN IF NOT EXISTS requesting_time_slots BOOLEAN DEFAULT false;

ALTER TABLE pursuits
ADD COLUMN IF NOT EXISTS kickoff_scheduled BOOLEAN DEFAULT false;

ALTER TABLE pursuits
ADD COLUMN IF NOT EXISTS kickoff_date TIMESTAMP WITH TIME ZONE;

-- Verify Step 4
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'pursuits'
AND column_name IN ('requesting_time_slots', 'kickoff_scheduled', 'kickoff_date');


-- ============================================
-- FINAL VERIFICATION
-- ============================================

-- Check all tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('notifications', 'time_slot_proposals', 'kickoff_meetings')
ORDER BY table_name;

-- Should return 3 rows:
-- kickoff_meetings
-- notifications
-- time_slot_proposals

-- ✅ YOU'RE DONE! Now restart your app and test the button.
