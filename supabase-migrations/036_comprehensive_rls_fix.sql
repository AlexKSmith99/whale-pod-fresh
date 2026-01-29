-- Migration: 036_comprehensive_rls_fix.sql
-- Description: Comprehensive fix for all RLS recursion issues
-- Simplifies all SELECT policies to avoid circular dependencies

-- ============================================
-- PURSUITS
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can view pursuits" ON pursuits;
DROP POLICY IF EXISTS "Anyone can view open pursuits" ON pursuits;
DROP POLICY IF EXISTS "Users can view pursuits they're part of" ON pursuits;

CREATE POLICY "Authenticated users can view pursuits"
  ON pursuits FOR SELECT
  TO authenticated
  USING (true);

-- ============================================
-- TEAM_MEMBERS
-- ============================================
DROP POLICY IF EXISTS "Team members can view members of their team" ON team_members;

CREATE POLICY "Authenticated users can view team members"
  ON team_members FOR SELECT
  TO authenticated
  USING (true);

-- ============================================
-- MEETINGS
-- ============================================
DROP POLICY IF EXISTS "Users can view meetings for their pursuits" ON meetings;
DROP POLICY IF EXISTS "Authenticated users can view meetings" ON meetings;

CREATE POLICY "Authenticated users can view meetings"
  ON meetings FOR SELECT
  TO authenticated
  USING (true);

-- ============================================
-- MEETING_PARTICIPANTS
-- ============================================
DROP POLICY IF EXISTS "Users can view participants for their meetings" ON meeting_participants;
DROP POLICY IF EXISTS "Authenticated users can view meeting participants" ON meeting_participants;

CREATE POLICY "Authenticated users can view meeting participants"
  ON meeting_participants FOR SELECT
  TO authenticated
  USING (true);

-- ============================================
-- MEETING_AGENDA_ITEMS
-- ============================================
DROP POLICY IF EXISTS "Users can view agenda for their meetings" ON meeting_agenda_items;
DROP POLICY IF EXISTS "Authenticated users can view agenda items" ON meeting_agenda_items;

CREATE POLICY "Authenticated users can view agenda items"
  ON meeting_agenda_items FOR SELECT
  TO authenticated
  USING (true);

-- ============================================
-- KICKOFF_TIME_PROPOSALS
-- ============================================
DROP POLICY IF EXISTS "Users can view proposals for their pursuits" ON kickoff_time_proposals;
DROP POLICY IF EXISTS "Authenticated users can view kickoff proposals" ON kickoff_time_proposals;

CREATE POLICY "Authenticated users can view kickoff proposals"
  ON kickoff_time_proposals FOR SELECT
  TO authenticated
  USING (true);

-- ============================================
-- MEETING_CONTRIBUTIONS
-- ============================================
DROP POLICY IF EXISTS "Team members can view contributions" ON meeting_contributions;

CREATE POLICY "Authenticated users can view contributions"
  ON meeting_contributions FOR SELECT
  TO authenticated
  USING (true);

-- ============================================
-- MEMBER_ROLES
-- ============================================
DROP POLICY IF EXISTS "Team members can view roles" ON member_roles;

CREATE POLICY "Authenticated users can view roles"
  ON member_roles FOR SELECT
  TO authenticated
  USING (true);

-- ============================================
-- SHARED_MEDIA
-- ============================================
DROP POLICY IF EXISTS "Team members can view media" ON shared_media;

CREATE POLICY "Authenticated users can view media"
  ON shared_media FOR SELECT
  TO authenticated
  USING (true);

-- ============================================
-- POD_CHAT_MESSAGES
-- ============================================
DROP POLICY IF EXISTS "Users can view messages in pods they belong to" ON pod_chat_messages;

CREATE POLICY "Authenticated users can view pod chat messages"
  ON pod_chat_messages FOR SELECT
  TO authenticated
  USING (true);

-- ============================================
-- POD_CHAT_SETTINGS
-- ============================================
DROP POLICY IF EXISTS "Users can view settings for pods they belong to" ON pod_chat_settings;

CREATE POLICY "Authenticated users can view pod chat settings"
  ON pod_chat_settings FOR SELECT
  TO authenticated
  USING (true);

-- ============================================
-- REVIEWS - Fix foreign key and policies
-- ============================================
DROP POLICY IF EXISTS "Users can view reviews about themselves" ON reviews;
DROP POLICY IF EXISTS "Users can view reviews they wrote" ON reviews;
DROP POLICY IF EXISTS "Users can view reviews in their pods" ON reviews;

CREATE POLICY "Authenticated users can view reviews"
  ON reviews FOR SELECT
  TO authenticated
  USING (true);

-- ============================================
-- PURSUIT_APPLICATIONS
-- ============================================
DROP POLICY IF EXISTS "Applicants can view their own applications" ON pursuit_applications;
DROP POLICY IF EXISTS "Pursuit creators can view applications" ON pursuit_applications;

CREATE POLICY "Authenticated users can view applications"
  ON pursuit_applications FOR SELECT
  TO authenticated
  USING (true);

-- ============================================
-- CONNECTIONS
-- ============================================
DROP POLICY IF EXISTS "Users can view their connections" ON connections;

CREATE POLICY "Authenticated users can view connections"
  ON connections FOR SELECT
  TO authenticated
  USING (true);

-- ============================================
-- NOTIFICATIONS
-- ============================================
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;

CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

-- ============================================
-- MESSAGES
-- ============================================
DROP POLICY IF EXISTS "Users can view their messages" ON messages;

CREATE POLICY "Users can view their messages"
  ON messages FOR SELECT
  USING (sender_id = auth.uid() OR recipient_id = auth.uid());

-- ============================================
-- POD_CHAT_READ_STATUS
-- ============================================
DROP POLICY IF EXISTS "Users can manage their own read status" ON pod_chat_read_status;

CREATE POLICY "Users can manage their own read status"
  ON pod_chat_read_status FOR ALL
  TO authenticated
  USING (user_id = auth.uid());

-- ============================================
-- PROFILES
-- ============================================
-- Profiles should remain viewable by everyone (public profiles)
-- No change needed here
