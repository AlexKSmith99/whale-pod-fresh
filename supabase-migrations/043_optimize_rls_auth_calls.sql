-- Migration: 043_optimize_rls_auth_calls.sql
-- Description: Optimize ALL RLS policies by wrapping auth.uid() in (select auth.uid())
-- Also cleans up duplicate policies
-- Generated: 2025-01-19 based on actual database state
-- This is a NON-FUNCTIONAL change - access rules remain IDENTICAL

-- ============================================
-- BOARD_TASKS (4 policies - optimize auth.uid())
-- ============================================
DROP POLICY IF EXISTS "Pursuit creators can create tasks" ON board_tasks;
DROP POLICY IF EXISTS "Pursuit creators can delete tasks" ON board_tasks;
DROP POLICY IF EXISTS "Pursuit creators can update tasks" ON board_tasks;
DROP POLICY IF EXISTS "Pursuit creators can view board tasks" ON board_tasks;

CREATE POLICY "Pursuit creators can view board tasks"
  ON board_tasks FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM team_boards
    JOIN pursuits ON pursuits.id = team_boards.pursuit_id
    WHERE team_boards.id = board_tasks.board_id
    AND pursuits.creator_id = (select auth.uid())
  ));

CREATE POLICY "Pursuit creators can create tasks"
  ON board_tasks FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM team_boards
    JOIN pursuits ON pursuits.id = team_boards.pursuit_id
    WHERE team_boards.id = board_tasks.board_id
    AND pursuits.creator_id = (select auth.uid())
  ));

CREATE POLICY "Pursuit creators can update tasks"
  ON board_tasks FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM team_boards
    JOIN pursuits ON pursuits.id = team_boards.pursuit_id
    WHERE team_boards.id = board_tasks.board_id
    AND pursuits.creator_id = (select auth.uid())
  ));

CREATE POLICY "Pursuit creators can delete tasks"
  ON board_tasks FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM team_boards
    JOIN pursuits ON pursuits.id = team_boards.pursuit_id
    WHERE team_boards.id = board_tasks.board_id
    AND pursuits.creator_id = (select auth.uid())
  ));

-- ============================================
-- CONNECTIONS (cleanup duplicates + optimize)
-- Has: 1 SELECT, 2 DELETE duplicates, 2 INSERT duplicates, 2 UPDATE
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can view connections" ON connections;
DROP POLICY IF EXISTS "Users can accept connections" ON connections;
DROP POLICY IF EXISTS "Users can create connection requests" ON connections;
DROP POLICY IF EXISTS "Users can delete connections" ON connections;
DROP POLICY IF EXISTS "Users can delete their connections" ON connections;
DROP POLICY IF EXISTS "Users can send connection requests" ON connections;
DROP POLICY IF EXISTS "Users can update their connections" ON connections;

CREATE POLICY "Authenticated users can view connections"
  ON connections FOR SELECT
  USING (true);

CREATE POLICY "Users can create connection requests"
  ON connections FOR INSERT
  WITH CHECK (user_id_1 = (select auth.uid()));

CREATE POLICY "Users can accept connections"
  ON connections FOR UPDATE
  USING ((select auth.uid()) = user_id_2);

CREATE POLICY "Users can update their connections"
  ON connections FOR UPDATE
  USING (user_id_1 = (select auth.uid()) OR user_id_2 = (select auth.uid()));

CREATE POLICY "Users can delete their connections"
  ON connections FOR DELETE
  USING (user_id_1 = (select auth.uid()) OR user_id_2 = (select auth.uid()));

-- ============================================
-- KICK_PROPOSALS (3 policies - already permissive, just optimize)
-- ============================================
-- These use WITH CHECK (true) / USING (true), no auth.uid() to optimize

-- ============================================
-- KICKOFF_MEETINGS (3 policies - already permissive)
-- ============================================
-- These use WITH CHECK (true) / USING (true), no auth.uid() to optimize

-- ============================================
-- KICKOFF_TIME_PROPOSALS (3 policies - optimize)
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can view kickoff proposals" ON kickoff_time_proposals;
DROP POLICY IF EXISTS "Team members can submit proposals" ON kickoff_time_proposals;
DROP POLICY IF EXISTS "Users can update their own proposals" ON kickoff_time_proposals;

CREATE POLICY "Authenticated users can view kickoff proposals"
  ON kickoff_time_proposals FOR SELECT
  USING (true);

CREATE POLICY "Team members can submit proposals"
  ON kickoff_time_proposals FOR INSERT
  WITH CHECK (
    user_id = (select auth.uid())
    AND (
      -- Pod creator
      EXISTS (
        SELECT 1 FROM pursuits
        WHERE pursuits.id = kickoff_time_proposals.pursuit_id
        AND pursuits.creator_id = (select auth.uid())
      )
      OR
      -- Team member (active or accepted)
      EXISTS (
        SELECT 1 FROM team_members
        WHERE team_members.pursuit_id = kickoff_time_proposals.pursuit_id
        AND team_members.user_id = (select auth.uid())
        AND team_members.status IN ('active', 'accepted')
      )
    )
  );

CREATE POLICY "Users can update their own proposals"
  ON kickoff_time_proposals FOR UPDATE
  USING (user_id = (select auth.uid()));

-- ============================================
-- MEETING_AGENDA_ITEMS (4 policies - optimize)
-- ============================================
DROP POLICY IF EXISTS "Agenda item creators can delete their items" ON meeting_agenda_items;
DROP POLICY IF EXISTS "Agenda item creators can update their items" ON meeting_agenda_items;
DROP POLICY IF EXISTS "Authenticated users can view agenda items" ON meeting_agenda_items;
DROP POLICY IF EXISTS "Meeting participants can create agenda items" ON meeting_agenda_items;

CREATE POLICY "Authenticated users can view agenda items"
  ON meeting_agenda_items FOR SELECT
  USING (true);

CREATE POLICY "Meeting participants can create agenda items"
  ON meeting_agenda_items FOR INSERT
  WITH CHECK (
    (EXISTS (
      SELECT 1 FROM meeting_participants
      WHERE meeting_participants.meeting_id = meeting_agenda_items.meeting_id
      AND meeting_participants.user_id = (select auth.uid())
    ))
    AND creator_id = (select auth.uid())
  );

CREATE POLICY "Agenda item creators can update their items"
  ON meeting_agenda_items FOR UPDATE
  USING (creator_id = (select auth.uid()));

CREATE POLICY "Agenda item creators can delete their items"
  ON meeting_agenda_items FOR DELETE
  USING (creator_id = (select auth.uid()));

-- ============================================
-- MEETING_CONTRIBUTIONS (4 policies - optimize)
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can view contributions" ON meeting_contributions;
DROP POLICY IF EXISTS "Team members can insert contributions" ON meeting_contributions;
DROP POLICY IF EXISTS "Users can delete own contributions" ON meeting_contributions;
DROP POLICY IF EXISTS "Users can update own contributions" ON meeting_contributions;

CREATE POLICY "Authenticated users can view contributions"
  ON meeting_contributions FOR SELECT
  USING (true);

CREATE POLICY "Team members can insert contributions"
  ON meeting_contributions FOR INSERT
  WITH CHECK (
    (EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.pursuit_id = meeting_contributions.pursuit_id
      AND team_members.user_id = (select auth.uid())
    ))
    OR (EXISTS (
      SELECT 1 FROM pursuits
      WHERE pursuits.id = meeting_contributions.pursuit_id
      AND pursuits.creator_id = (select auth.uid())
    ))
  );

CREATE POLICY "Users can update own contributions"
  ON meeting_contributions FOR UPDATE
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own contributions"
  ON meeting_contributions FOR DELETE
  USING ((select auth.uid()) = user_id);

-- ============================================
-- MEETING_NOTES (4 policies - optimize)
-- ============================================
DROP POLICY IF EXISTS "Pursuit creators can create meeting notes" ON meeting_notes;
DROP POLICY IF EXISTS "Pursuit creators can delete meeting notes" ON meeting_notes;
DROP POLICY IF EXISTS "Pursuit creators can update meeting notes" ON meeting_notes;
DROP POLICY IF EXISTS "Pursuit creators can view meeting notes" ON meeting_notes;

CREATE POLICY "Pursuit creators can view meeting notes"
  ON meeting_notes FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM pursuits
    WHERE pursuits.id = meeting_notes.pursuit_id
    AND pursuits.creator_id = (select auth.uid())
  ));

CREATE POLICY "Pursuit creators can create meeting notes"
  ON meeting_notes FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM pursuits
    WHERE pursuits.id = meeting_notes.pursuit_id
    AND pursuits.creator_id = (select auth.uid())
  ));

CREATE POLICY "Pursuit creators can update meeting notes"
  ON meeting_notes FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM pursuits
    WHERE pursuits.id = meeting_notes.pursuit_id
    AND pursuits.creator_id = (select auth.uid())
  ));

CREATE POLICY "Pursuit creators can delete meeting notes"
  ON meeting_notes FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM pursuits
    WHERE pursuits.id = meeting_notes.pursuit_id
    AND pursuits.creator_id = (select auth.uid())
  ));

-- ============================================
-- MEETING_PARTICIPANTS (3 policies - optimize)
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can view meeting participants" ON meeting_participants;
DROP POLICY IF EXISTS "Meeting creators can add participants" ON meeting_participants;
DROP POLICY IF EXISTS "Users can update their own participation status" ON meeting_participants;

CREATE POLICY "Authenticated users can view meeting participants"
  ON meeting_participants FOR SELECT
  USING (true);

CREATE POLICY "Meeting creators can add participants"
  ON meeting_participants FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM meetings
    WHERE meetings.id = meeting_participants.meeting_id
    AND meetings.creator_id = (select auth.uid())
  ));

CREATE POLICY "Users can update their own participation status"
  ON meeting_participants FOR UPDATE
  USING (user_id = (select auth.uid()));

-- ============================================
-- MEETINGS (4 policies - optimize)
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can view meetings" ON meetings;
DROP POLICY IF EXISTS "Meeting creators can delete their meetings" ON meetings;
DROP POLICY IF EXISTS "Meeting creators can update their meetings" ON meetings;
DROP POLICY IF EXISTS "Pursuit creators can create meetings" ON meetings;

CREATE POLICY "Authenticated users can view meetings"
  ON meetings FOR SELECT
  USING (true);

CREATE POLICY "Pursuit creators can create meetings"
  ON meetings FOR INSERT
  WITH CHECK (
    (EXISTS (
      SELECT 1 FROM pursuits
      WHERE pursuits.id = meetings.pursuit_id
      AND pursuits.creator_id = (select auth.uid())
    ))
    OR (EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.pursuit_id = meetings.pursuit_id
      AND team_members.user_id = (select auth.uid())
      AND team_members.status = 'active'
    ))
  );

CREATE POLICY "Meeting creators can update their meetings"
  ON meetings FOR UPDATE
  USING (creator_id = (select auth.uid()));

CREATE POLICY "Meeting creators can delete their meetings"
  ON meetings FOR DELETE
  USING (creator_id = (select auth.uid()));

-- ============================================
-- MEMBER_ROLES (3 policies - optimize)
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can view roles" ON member_roles;
DROP POLICY IF EXISTS "Creator can manage all roles" ON member_roles;
DROP POLICY IF EXISTS "Users can update own role" ON member_roles;

CREATE POLICY "Authenticated users can view roles"
  ON member_roles FOR SELECT
  USING (true);

CREATE POLICY "Creator can manage all roles"
  ON member_roles FOR ALL
  USING (EXISTS (
    SELECT 1 FROM pursuits
    WHERE pursuits.id = member_roles.pursuit_id
    AND pursuits.creator_id = (select auth.uid())
  ));

CREATE POLICY "Users can update own role"
  ON member_roles FOR UPDATE
  USING ((select auth.uid()) = user_id);

-- ============================================
-- MESSAGES (4 policies - optimize)
-- ============================================
DROP POLICY IF EXISTS "Recipients can mark messages as read" ON messages;
DROP POLICY IF EXISTS "Users can delete their messages" ON messages;
DROP POLICY IF EXISTS "Users can send messages" ON messages;
DROP POLICY IF EXISTS "Users can view their messages" ON messages;

CREATE POLICY "Users can view their messages"
  ON messages FOR SELECT
  USING (sender_id = (select auth.uid()) OR recipient_id = (select auth.uid()));

CREATE POLICY "Users can send messages"
  ON messages FOR INSERT
  WITH CHECK (sender_id = (select auth.uid()));

CREATE POLICY "Recipients can mark messages as read"
  ON messages FOR UPDATE
  USING (recipient_id = (select auth.uid()))
  WITH CHECK (recipient_id = (select auth.uid()));

CREATE POLICY "Users can delete their messages"
  ON messages FOR DELETE
  USING (sender_id = (select auth.uid()) OR recipient_id = (select auth.uid()));

-- ============================================
-- NOTIFICATIONS (4 policies - optimize)
-- ============================================
DROP POLICY IF EXISTS "notifications_delete" ON notifications;
DROP POLICY IF EXISTS "notifications_insert" ON notifications;
DROP POLICY IF EXISTS "notifications_select" ON notifications;
DROP POLICY IF EXISTS "notifications_update" ON notifications;

CREATE POLICY "notifications_select"
  ON notifications FOR SELECT
  USING ((select auth.uid()) = user_id);

-- IMPORTANT: Keep INSERT as WITH CHECK (true) for system notifications
CREATE POLICY "notifications_insert"
  ON notifications FOR INSERT
  WITH CHECK (true);

CREATE POLICY "notifications_update"
  ON notifications FOR UPDATE
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "notifications_delete"
  ON notifications FOR DELETE
  USING ((select auth.uid()) = user_id);

-- ============================================
-- POD_CHAT_MESSAGES (cleanup duplicates + optimize)
-- Has: 3 SELECT (1 permissive, 2 restrictive), 2 INSERT duplicates
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can view pod chat messages" ON pod_chat_messages;
DROP POLICY IF EXISTS "Users can insert messages in pods they
  belong to" ON pod_chat_messages;
DROP POLICY IF EXISTS "Users can insert messages in pods they belong to" ON pod_chat_messages;
DROP POLICY IF EXISTS "Users can view messages in pods they belong
   to" ON pod_chat_messages;

-- Keep permissive SELECT (current behavior)
CREATE POLICY "Authenticated users can view pod chat messages"
  ON pod_chat_messages FOR SELECT
  USING (true);

CREATE POLICY "Users can insert messages in pods they belong to"
  ON pod_chat_messages FOR INSERT
  WITH CHECK (
    sender_id = (select auth.uid())
    AND (
      EXISTS (
        SELECT 1 FROM pursuits
        WHERE pursuits.id = pod_chat_messages.pursuit_id
        AND pursuits.creator_id = (select auth.uid())
      )
      OR EXISTS (
        SELECT 1 FROM team_members
        WHERE team_members.pursuit_id = pod_chat_messages.pursuit_id
        AND team_members.user_id = (select auth.uid())
        AND team_members.status IN ('active', 'accepted')
      )
    )
  );

-- ============================================
-- POD_CHAT_READ_STATUS (1 policy - optimize)
-- ============================================
DROP POLICY IF EXISTS "Users can manage their own read status" ON pod_chat_read_status;

CREATE POLICY "Users can manage their own read status"
  ON pod_chat_read_status FOR ALL
  USING (user_id = (select auth.uid()));

-- ============================================
-- POD_CHAT_SETTINGS (cleanup duplicates + optimize)
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can view pod chat settings" ON pod_chat_settings;
DROP POLICY IF EXISTS "Pod members can update settings" ON pod_chat_settings;
DROP POLICY IF EXISTS "Users can view settings for pods they
  belong to" ON pod_chat_settings;

CREATE POLICY "Authenticated users can view pod chat settings"
  ON pod_chat_settings FOR SELECT
  USING (true);

CREATE POLICY "Pod members can update settings"
  ON pod_chat_settings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM pursuits
      WHERE pursuits.id = pod_chat_settings.pursuit_id
      AND pursuits.creator_id = (select auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.pursuit_id = pod_chat_settings.pursuit_id
      AND team_members.user_id = (select auth.uid())
      AND team_members.status IN ('active', 'accepted')
    )
  );

-- ============================================
-- POD_DOCS (3 policies - already use (select auth.uid()))
-- ============================================
-- These already use is_pod_member() helper, no changes needed

-- ============================================
-- POD_MEETING_* tables (already use is_pod_member() helper)
-- ============================================
-- These already use (select auth.uid()) pattern, no changes needed

-- ============================================
-- POD_RULES (3 policies - already use is_pod_member())
-- ============================================
-- These already use is_pod_member() helper, no changes needed

-- ============================================
-- PRIVACY_PREFERENCES (3 policies - already optimized)
-- ============================================
-- These already use (select auth.uid()), no changes needed

-- ============================================
-- PROFILES (3 policies - optimize)
-- ============================================
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

CREATE POLICY "Public profiles are viewable by everyone"
  ON profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK ((select auth.uid()) = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING ((select auth.uid()) = id);

-- ============================================
-- PURSUIT_APPLICATIONS (cleanup duplicates + optimize)
-- Has: 2 SELECT, 4 UPDATE, 2 INSERT duplicates
-- ============================================
DROP POLICY IF EXISTS "Applicants can update own applications" ON pursuit_applications;
DROP POLICY IF EXISTS "Applicants can update their applications" ON pursuit_applications;
DROP POLICY IF EXISTS "Applications viewable by creator and applicant" ON pursuit_applications;
DROP POLICY IF EXISTS "Authenticated users can view applications" ON pursuit_applications;
DROP POLICY IF EXISTS "Creators can update application status" ON pursuit_applications;
DROP POLICY IF EXISTS "Pursuit creators can update applications" ON pursuit_applications;
DROP POLICY IF EXISTS "Users can apply to pursuits" ON pursuit_applications;
DROP POLICY IF EXISTS "Users can create applications" ON pursuit_applications;

-- Keep permissive SELECT (current behavior)
CREATE POLICY "Authenticated users can view applications"
  ON pursuit_applications FOR SELECT
  USING (true);

CREATE POLICY "Users can create applications"
  ON pursuit_applications FOR INSERT
  WITH CHECK ((select auth.uid()) = applicant_id);

CREATE POLICY "Applicants can update own applications"
  ON pursuit_applications FOR UPDATE
  USING (applicant_id = (select auth.uid()))
  WITH CHECK (applicant_id = (select auth.uid()));

CREATE POLICY "Creators can update application status"
  ON pursuit_applications FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM pursuits
    WHERE pursuits.id = pursuit_applications.pursuit_id
    AND pursuits.creator_id = (select auth.uid())
  ));

-- ============================================
-- PURSUITS (cleanup duplicates + optimize)
-- Has: 2 SELECT, 2 UPDATE, 2 DELETE duplicates
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can view pursuits" ON pursuits;
DROP POLICY IF EXISTS "Creators can delete own pursuits" ON pursuits;
DROP POLICY IF EXISTS "Creators can delete their pursuits" ON pursuits;
DROP POLICY IF EXISTS "Creators can update own pursuits" ON pursuits;
DROP POLICY IF EXISTS "Creators can update their pursuits" ON pursuits;
DROP POLICY IF EXISTS "Pursuits are viewable by everyone" ON pursuits;
DROP POLICY IF EXISTS "Users can create pursuits" ON pursuits;

CREATE POLICY "Authenticated users can view pursuits"
  ON pursuits FOR SELECT
  USING (true);

CREATE POLICY "Users can create pursuits"
  ON pursuits FOR INSERT
  WITH CHECK ((select auth.uid()) = creator_id);

CREATE POLICY "Creators can update own pursuits"
  ON pursuits FOR UPDATE
  USING ((select auth.uid()) = creator_id);

CREATE POLICY "Creators can delete own pursuits"
  ON pursuits FOR DELETE
  USING ((select auth.uid()) = creator_id);

-- ============================================
-- PUSH_TOKENS (cleanup duplicates + optimize)
-- Has: 6 overlapping policies (ALL + individual ops)
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can read push tokens" ON push_tokens;
DROP POLICY IF EXISTS "Users can delete own push tokens" ON push_tokens;
DROP POLICY IF EXISTS "Users can insert own push tokens" ON push_tokens;
DROP POLICY IF EXISTS "Users can manage their own push tokens" ON push_tokens;
DROP POLICY IF EXISTS "Users can update own push tokens" ON push_tokens;
DROP POLICY IF EXISTS "Users can view own push tokens" ON push_tokens;

-- Use single ALL policy (most efficient)
CREATE POLICY "Users can manage their own push tokens"
  ON push_tokens FOR ALL
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- Need permissive SELECT for system to find tokens
CREATE POLICY "Authenticated users can read push tokens"
  ON push_tokens FOR SELECT
  USING (true);

-- ============================================
-- REVIEWS (4 policies - optimize)
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can create reviews" ON reviews;
DROP POLICY IF EXISTS "Authenticated users can view reviews" ON reviews;
DROP POLICY IF EXISTS "Users can delete their own reviews" ON reviews;
DROP POLICY IF EXISTS "Users can update their own reviews" ON reviews;

CREATE POLICY "Authenticated users can view reviews"
  ON reviews FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create reviews"
  ON reviews FOR INSERT
  WITH CHECK ((select auth.uid()) = reviewer_id AND reviewer_id <> reviewee_id);

CREATE POLICY "Users can update their own reviews"
  ON reviews FOR UPDATE
  USING (reviewer_id = (select auth.uid()));

CREATE POLICY "Users can delete their own reviews"
  ON reviews FOR DELETE
  USING (reviewer_id = (select auth.uid()));

-- ============================================
-- SHARED_MEDIA (3 policies - optimize)
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can view media" ON shared_media;
DROP POLICY IF EXISTS "Team members can insert media" ON shared_media;
DROP POLICY IF EXISTS "Users can delete own media" ON shared_media;

CREATE POLICY "Authenticated users can view media"
  ON shared_media FOR SELECT
  USING (true);

CREATE POLICY "Team members can insert media"
  ON shared_media FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.pursuit_id = shared_media.pursuit_id
      AND team_members.user_id = (select auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM pursuits
      WHERE pursuits.id = shared_media.pursuit_id
      AND pursuits.creator_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can delete own media"
  ON shared_media FOR DELETE
  USING ((select auth.uid()) = user_id);

-- ============================================
-- TEAM_BOARDS (2 policies - optimize)
-- ============================================
DROP POLICY IF EXISTS "Pursuit creators can create team boards" ON team_boards;
DROP POLICY IF EXISTS "Pursuit creators can view team boards" ON team_boards;

CREATE POLICY "Pursuit creators can view team boards"
  ON team_boards FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM pursuits
    WHERE pursuits.id = team_boards.pursuit_id
    AND pursuits.creator_id = (select auth.uid())
  ));

CREATE POLICY "Pursuit creators can create team boards"
  ON team_boards FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM pursuits
    WHERE pursuits.id = team_boards.pursuit_id
    AND pursuits.creator_id = (select auth.uid())
  ));

-- ============================================
-- TEAM_GALLERY (3 policies - optimize)
-- ============================================
DROP POLICY IF EXISTS "Team members can upload photos" ON team_gallery;
DROP POLICY IF EXISTS "Team members can view team gallery" ON team_gallery;
DROP POLICY IF EXISTS "Users can delete own photos" ON team_gallery;

CREATE POLICY "Team members can view team gallery"
  ON team_gallery FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM pursuits
    WHERE pursuits.id = team_gallery.pursuit_id
    AND (
      pursuits.creator_id = (select auth.uid())
      OR EXISTS (
        SELECT 1 FROM team_members
        WHERE team_members.pursuit_id = pursuits.id
        AND team_members.user_id = (select auth.uid())
      )
    )
  ));

CREATE POLICY "Team members can upload photos"
  ON team_gallery FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM pursuits
    WHERE pursuits.id = team_gallery.pursuit_id
    AND (
      pursuits.creator_id = (select auth.uid())
      OR EXISTS (
        SELECT 1 FROM team_members
        WHERE team_members.pursuit_id = pursuits.id
        AND team_members.user_id = (select auth.uid())
      )
    )
  ));

CREATE POLICY "Users can delete own photos"
  ON team_gallery FOR DELETE
  USING (uploaded_by = (select auth.uid()));

-- ============================================
-- TEAM_MEMBERS (cleanup MANY duplicates + optimize)
-- Has: 2 SELECT, 2 INSERT, 3 DELETE, 1 ALL, 2 UPDATE duplicates
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can view team members" ON team_members;
DROP POLICY IF EXISTS "Creators can add team members" ON team_members;
DROP POLICY IF EXISTS "Creators can delete team members" ON team_members;
DROP POLICY IF EXISTS "Creators can insert team members" ON team_members;
DROP POLICY IF EXISTS "Creators can manage team members" ON team_members;
DROP POLICY IF EXISTS "Creators can remove team members" ON team_members;
DROP POLICY IF EXISTS "Creators can select team members" ON team_members;
DROP POLICY IF EXISTS "Creators can update team members" ON team_members;
DROP POLICY IF EXISTS "Team members are viewable by everyone" ON team_members;
DROP POLICY IF EXISTS "Team members can update own status" ON team_members;

CREATE POLICY "Authenticated users can view team members"
  ON team_members FOR SELECT
  USING (true);

CREATE POLICY "Creators can add team members"
  ON team_members FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM pursuits
    WHERE pursuits.id = team_members.pursuit_id
    AND pursuits.creator_id = (select auth.uid())
  ));

CREATE POLICY "Creators can update team members"
  ON team_members FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM pursuits
    WHERE pursuits.id = team_members.pursuit_id
    AND pursuits.creator_id = (select auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM pursuits
    WHERE pursuits.id = team_members.pursuit_id
    AND pursuits.creator_id = (select auth.uid())
  ));

CREATE POLICY "Creators can remove team members"
  ON team_members FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM pursuits
    WHERE pursuits.id = team_members.pursuit_id
    AND pursuits.creator_id = (select auth.uid())
  ));

CREATE POLICY "Team members can update own status"
  ON team_members FOR UPDATE
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- ============================================
-- TIME_SLOT_PROPOSALS (3 policies - already permissive)
-- ============================================
-- These use WITH CHECK (true) / USING (true), no auth.uid() to optimize

-- ============================================
-- USER_NOTION_CONNECTIONS (4 policies - optimize)
-- ============================================
DROP POLICY IF EXISTS "Users can delete own notion connections" ON user_notion_connections;
DROP POLICY IF EXISTS "Users can insert own notion connections" ON user_notion_connections;
DROP POLICY IF EXISTS "Users can update own notion connections" ON user_notion_connections;
DROP POLICY IF EXISTS "Users can view own notion connections" ON user_notion_connections;

CREATE POLICY "Users can view own notion connections"
  ON user_notion_connections FOR SELECT
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own notion connections"
  ON user_notion_connections FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own notion connections"
  ON user_notion_connections FOR UPDATE
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own notion connections"
  ON user_notion_connections FOR DELETE
  USING ((select auth.uid()) = user_id);

-- ============================================
-- VOTES (3 policies - already permissive)
-- ============================================
-- These use WITH CHECK (true) / USING (true), no auth.uid() to optimize
