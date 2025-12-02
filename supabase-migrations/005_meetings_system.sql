-- Meetings System Schema
-- This migration creates tables for calendar meetings, video calls, and kick-off scheduling

-- Meetings table
CREATE TABLE IF NOT EXISTS meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pursuit_id UUID NOT NULL REFERENCES pursuits(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  meeting_type TEXT NOT NULL CHECK (meeting_type IN ('in_person', 'video', 'hybrid')),
  location TEXT, -- For in-person meetings
  agora_channel_name TEXT, -- For video meetings
  agora_token TEXT, -- Agora access token
  scheduled_time TIMESTAMP WITH TIME ZONE NOT NULL,
  duration_minutes INTEGER DEFAULT 60,
  timezone TEXT DEFAULT 'America/New_York',
  is_kickoff BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  recording_enabled BOOLEAN DEFAULT false,
  recording_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Meeting participants (many-to-many relationship)
CREATE TABLE IF NOT EXISTS meeting_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'invited' CHECK (status IN ('invited', 'accepted', 'declined', 'maybe')),
  joined_at TIMESTAMP WITH TIME ZONE,
  left_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(meeting_id, user_id)
);

-- Kickoff time proposals (for scheduling first meeting)
CREATE TABLE IF NOT EXISTS kickoff_time_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pursuit_id UUID NOT NULL REFERENCES pursuits(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  proposed_times JSONB NOT NULL, -- Array of time slots: [{start: ISO8601, end: ISO8601}]
  timezone TEXT DEFAULT 'America/New_York',
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(pursuit_id, user_id)
);

-- Meeting agenda items
CREATE TABLE IF NOT EXISTS meeting_agenda_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  order_index INTEGER DEFAULT 0,
  is_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_meetings_pursuit ON meetings(pursuit_id);
CREATE INDEX IF NOT EXISTS idx_meetings_creator ON meetings(creator_id);
CREATE INDEX IF NOT EXISTS idx_meetings_scheduled_time ON meetings(scheduled_time);
CREATE INDEX IF NOT EXISTS idx_meetings_status ON meetings(status);
CREATE INDEX IF NOT EXISTS idx_meeting_participants_meeting ON meeting_participants(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_participants_user ON meeting_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_kickoff_proposals_pursuit ON kickoff_time_proposals(pursuit_id);
CREATE INDEX IF NOT EXISTS idx_agenda_items_meeting ON meeting_agenda_items(meeting_id);

-- Enable RLS on all tables
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE kickoff_time_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_agenda_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for meetings
CREATE POLICY "Users can view meetings for their pursuits"
  ON meetings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.pursuit_id = meetings.pursuit_id
      AND team_members.user_id = auth.uid()
      AND team_members.status = 'active'
    )
    OR creator_id = auth.uid()
  );

CREATE POLICY "Pursuit creators can create meetings"
  ON meetings FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pursuits
      WHERE pursuits.id = pursuit_id
      AND pursuits.creator_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.pursuit_id = meetings.pursuit_id
      AND team_members.user_id = auth.uid()
      AND team_members.status = 'active'
    )
  );

CREATE POLICY "Meeting creators can update their meetings"
  ON meetings FOR UPDATE
  USING (creator_id = auth.uid());

CREATE POLICY "Meeting creators can delete their meetings"
  ON meetings FOR DELETE
  USING (creator_id = auth.uid());

-- RLS Policies for meeting_participants
CREATE POLICY "Users can view participants for their meetings"
  ON meeting_participants FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM meetings
      WHERE meetings.id = meeting_participants.meeting_id
      AND (
        meetings.creator_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM meeting_participants mp
          WHERE mp.meeting_id = meetings.id
          AND mp.user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Meeting creators can add participants"
  ON meeting_participants FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM meetings
      WHERE meetings.id = meeting_id
      AND meetings.creator_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own participation status"
  ON meeting_participants FOR UPDATE
  USING (user_id = auth.uid());

-- RLS Policies for kickoff_time_proposals
CREATE POLICY "Users can view proposals for their pursuits"
  ON kickoff_time_proposals FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.pursuit_id = kickoff_time_proposals.pursuit_id
      AND team_members.user_id = auth.uid()
      AND team_members.status = 'active'
    )
  );

CREATE POLICY "Team members can submit proposals"
  ON kickoff_time_proposals FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.pursuit_id = pursuit_id
      AND team_members.user_id = auth.uid()
      AND team_members.status = 'active'
    )
    AND user_id = auth.uid()
  );

CREATE POLICY "Users can update their own proposals"
  ON kickoff_time_proposals FOR UPDATE
  USING (user_id = auth.uid());

-- RLS Policies for meeting_agenda_items
CREATE POLICY "Users can view agenda for their meetings"
  ON meeting_agenda_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM meetings
      WHERE meetings.id = meeting_agenda_items.meeting_id
      AND (
        meetings.creator_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM meeting_participants
          WHERE meeting_participants.meeting_id = meetings.id
          AND meeting_participants.user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Meeting participants can create agenda items"
  ON meeting_agenda_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM meeting_participants
      WHERE meeting_participants.meeting_id = meeting_id
      AND meeting_participants.user_id = auth.uid()
    )
    AND creator_id = auth.uid()
  );

CREATE POLICY "Agenda item creators can update their items"
  ON meeting_agenda_items FOR UPDATE
  USING (creator_id = auth.uid());

CREATE POLICY "Agenda item creators can delete their items"
  ON meeting_agenda_items FOR DELETE
  USING (creator_id = auth.uid());

-- Add updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
CREATE TRIGGER update_meetings_updated_at
  BEFORE UPDATE ON meetings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agenda_items_updated_at
  BEFORE UPDATE ON meeting_agenda_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
