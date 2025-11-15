-- Team Workspace: Contributions, Roles, and Media

-- Meeting Contributions (Agenda items, notes, questions, etc.)
CREATE TABLE IF NOT EXISTS meeting_contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pursuit_id UUID NOT NULL REFERENCES pursuits(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  meeting_date DATE NOT NULL,
  meeting_title TEXT,
  contribution_type TEXT NOT NULL CHECK (contribution_type IN ('pre-meeting agenda', 'question', 'comment', 'meeting notes', 'task')),
  content TEXT NOT NULL,
  time_of_contribution TIME,
  media_url TEXT,
  media_type TEXT CHECK (media_type IN ('image', 'video')),
  is_edited BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Member Roles
CREATE TABLE IF NOT EXISTS member_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pursuit_id UUID NOT NULL REFERENCES pursuits(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_title TEXT NOT NULL,
  role_description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(pursuit_id, user_id)
);

-- Shared Media
CREATE TABLE IF NOT EXISTS shared_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pursuit_id UUID NOT NULL REFERENCES pursuits(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  meeting_date DATE,
  media_url TEXT NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
  label TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Row Level Security Policies

-- meeting_contributions
ALTER TABLE meeting_contributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view contributions"
  ON meeting_contributions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.pursuit_id = meeting_contributions.pursuit_id
      AND team_members.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM pursuits
      WHERE pursuits.id = meeting_contributions.pursuit_id
      AND pursuits.creator_id = auth.uid()
    )
  );

CREATE POLICY "Team members can insert contributions"
  ON meeting_contributions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.pursuit_id = meeting_contributions.pursuit_id
      AND team_members.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM pursuits
      WHERE pursuits.id = meeting_contributions.pursuit_id
      AND pursuits.creator_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own contributions"
  ON meeting_contributions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own contributions"
  ON meeting_contributions FOR DELETE
  USING (auth.uid() = user_id);

-- member_roles
ALTER TABLE member_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view roles"
  ON member_roles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.pursuit_id = member_roles.pursuit_id
      AND team_members.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM pursuits
      WHERE pursuits.id = member_roles.pursuit_id
      AND pursuits.creator_id = auth.uid()
    )
  );

CREATE POLICY "Creator can manage all roles"
  ON member_roles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM pursuits
      WHERE pursuits.id = member_roles.pursuit_id
      AND pursuits.creator_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own role"
  ON member_roles FOR UPDATE
  USING (auth.uid() = user_id);

-- shared_media
ALTER TABLE shared_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view media"
  ON shared_media FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.pursuit_id = shared_media.pursuit_id
      AND team_members.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM pursuits
      WHERE pursuits.id = shared_media.pursuit_id
      AND pursuits.creator_id = auth.uid()
    )
  );

CREATE POLICY "Team members can insert media"
  ON shared_media FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.pursuit_id = shared_media.pursuit_id
      AND team_members.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM pursuits
      WHERE pursuits.id = shared_media.pursuit_id
      AND pursuits.creator_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own media"
  ON shared_media FOR DELETE
  USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX idx_contributions_pursuit ON meeting_contributions(pursuit_id);
CREATE INDEX idx_contributions_meeting_date ON meeting_contributions(meeting_date);
CREATE INDEX idx_roles_pursuit ON member_roles(pursuit_id);
CREATE INDEX idx_media_pursuit ON shared_media(pursuit_id);
