-- Migration: 046_consolidate_duplicate_policies.sql
-- Description: Consolidate remaining duplicate RLS policies flagged by Supabase advisor
-- Generated: 2025-01-19

-- ============================================
-- CONNECTIONS - Consolidate UPDATE policies
-- Has: "Users can accept connections" AND "Users can update their connections"
-- ============================================
DROP POLICY IF EXISTS "Users can accept connections" ON connections;
DROP POLICY IF EXISTS "Users can update their connections" ON connections;

-- Single UPDATE policy that covers both cases
CREATE POLICY "Users can update their connections"
  ON connections FOR UPDATE
  USING (user_id_1 = (select auth.uid()) OR user_id_2 = (select auth.uid()))
  WITH CHECK (user_id_1 = (select auth.uid()) OR user_id_2 = (select auth.uid()));

-- ============================================
-- MEMBER_ROLES - Consolidate SELECT and UPDATE policies
-- Has: "Authenticated users can view roles" + "Creator can manage all roles" (overlaps on SELECT)
-- Has: "Creator can manage all roles" + "Users can update own role" (overlaps on UPDATE)
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can view roles" ON member_roles;
DROP POLICY IF EXISTS "Creator can manage all roles" ON member_roles;
DROP POLICY IF EXISTS "Users can update own role" ON member_roles;

-- Simple SELECT for all authenticated users
CREATE POLICY "Authenticated users can view roles"
  ON member_roles FOR SELECT
  USING (true);

-- INSERT: Only creators can add roles
CREATE POLICY "Creators can add roles"
  ON member_roles FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM pursuits
    WHERE pursuits.id = member_roles.pursuit_id
    AND pursuits.creator_id = (select auth.uid())
  ));

-- UPDATE: Creators can update any role, users can update their own
CREATE POLICY "Users can update roles"
  ON member_roles FOR UPDATE
  USING (
    (select auth.uid()) = user_id
    OR EXISTS (
      SELECT 1 FROM pursuits
      WHERE pursuits.id = member_roles.pursuit_id
      AND pursuits.creator_id = (select auth.uid())
    )
  );

-- DELETE: Only creators can delete roles
CREATE POLICY "Creators can delete roles"
  ON member_roles FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM pursuits
    WHERE pursuits.id = member_roles.pursuit_id
    AND pursuits.creator_id = (select auth.uid())
  ));

-- ============================================
-- POD_CHAT_SETTINGS - Consolidate SELECT policies
-- Has: "Authenticated users can view pod chat settings" + "Pod members can update settings" (both grant SELECT)
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can view pod chat settings" ON pod_chat_settings;
DROP POLICY IF EXISTS "Pod members can update settings" ON pod_chat_settings;

-- Simple SELECT for all authenticated users
CREATE POLICY "Authenticated users can view pod chat settings"
  ON pod_chat_settings FOR SELECT
  USING (true);

-- Separate UPDATE/INSERT/DELETE for pod members only
CREATE POLICY "Pod members can manage settings"
  ON pod_chat_settings FOR UPDATE
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

CREATE POLICY "Pod members can insert settings"
  ON pod_chat_settings FOR INSERT
  WITH CHECK (
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
-- POD_MEETING_AGENDA_ITEMS - Consolidate SELECT policies
-- Has: "Pod members can manage agenda items" (ALL) + "Pod members can view agenda items" (SELECT)
-- ============================================
DROP POLICY IF EXISTS "Pod members can manage agenda items" ON pod_meeting_agenda_items;
DROP POLICY IF EXISTS "Pod members can view agenda items" ON pod_meeting_agenda_items;

-- Single ALL policy for pod members
CREATE POLICY "Pod members can manage agenda items"
  ON pod_meeting_agenda_items FOR ALL
  USING (is_pod_member(
    (SELECT pod_id FROM pod_meeting_pages WHERE id = pod_meeting_agenda_items.meeting_page_id),
    (select auth.uid())
  ))
  WITH CHECK (is_pod_member(
    (SELECT pod_id FROM pod_meeting_pages WHERE id = pod_meeting_agenda_items.meeting_page_id),
    (select auth.uid())
  ));

-- ============================================
-- POD_MEETING_MATERIALS - Consolidate SELECT policies
-- ============================================
DROP POLICY IF EXISTS "Pod members can manage materials" ON pod_meeting_materials;
DROP POLICY IF EXISTS "Pod members can view materials" ON pod_meeting_materials;

CREATE POLICY "Pod members can manage materials"
  ON pod_meeting_materials FOR ALL
  USING (is_pod_member(
    (SELECT pod_id FROM pod_meeting_pages WHERE id = pod_meeting_materials.meeting_page_id),
    (select auth.uid())
  ))
  WITH CHECK (is_pod_member(
    (SELECT pod_id FROM pod_meeting_pages WHERE id = pod_meeting_materials.meeting_page_id),
    (select auth.uid())
  ));

-- ============================================
-- POD_MEETING_NOTES - Consolidate SELECT policies
-- ============================================
DROP POLICY IF EXISTS "Pod members can manage meeting notes" ON pod_meeting_notes;
DROP POLICY IF EXISTS "Pod members can view meeting notes" ON pod_meeting_notes;

CREATE POLICY "Pod members can manage meeting notes"
  ON pod_meeting_notes FOR ALL
  USING (is_pod_member(
    (SELECT pod_id FROM pod_meeting_pages WHERE id = pod_meeting_notes.meeting_page_id),
    (select auth.uid())
  ))
  WITH CHECK (is_pod_member(
    (SELECT pod_id FROM pod_meeting_pages WHERE id = pod_meeting_notes.meeting_page_id),
    (select auth.uid())
  ));

-- ============================================
-- POD_MEETING_RECAP_ITEMS - Consolidate SELECT policies
-- ============================================
DROP POLICY IF EXISTS "Pod members can manage recap items" ON pod_meeting_recap_items;
DROP POLICY IF EXISTS "Pod members can view recap items" ON pod_meeting_recap_items;

CREATE POLICY "Pod members can manage recap items"
  ON pod_meeting_recap_items FOR ALL
  USING (is_pod_member(
    (SELECT pod_id FROM pod_meeting_pages WHERE id = pod_meeting_recap_items.meeting_page_id),
    (select auth.uid())
  ))
  WITH CHECK (is_pod_member(
    (SELECT pod_id FROM pod_meeting_pages WHERE id = pod_meeting_recap_items.meeting_page_id),
    (select auth.uid())
  ));

-- ============================================
-- PURSUIT_APPLICATIONS - Consolidate UPDATE policies
-- Has: "Applicants can update own applications" + "Creators can update application status"
-- ============================================
DROP POLICY IF EXISTS "Applicants can update own applications" ON pursuit_applications;
DROP POLICY IF EXISTS "Creators can update application status" ON pursuit_applications;

-- Single UPDATE policy covering both applicants and creators
CREATE POLICY "Users can update applications"
  ON pursuit_applications FOR UPDATE
  USING (
    applicant_id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM pursuits
      WHERE pursuits.id = pursuit_applications.pursuit_id
      AND pursuits.creator_id = (select auth.uid())
    )
  )
  WITH CHECK (
    applicant_id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM pursuits
      WHERE pursuits.id = pursuit_applications.pursuit_id
      AND pursuits.creator_id = (select auth.uid())
    )
  );

-- ============================================
-- PUSH_TOKENS - Consolidate SELECT policies
-- Has: "Authenticated users can read push tokens" + "Users can manage their own push tokens"
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can read push tokens" ON push_tokens;
DROP POLICY IF EXISTS "Users can manage their own push tokens" ON push_tokens;

-- Need permissive SELECT for system to find tokens for notifications
CREATE POLICY "Authenticated users can read push tokens"
  ON push_tokens FOR SELECT
  USING (true);

-- Users can only manage their own tokens (INSERT, UPDATE, DELETE)
CREATE POLICY "Users can manage own push tokens"
  ON push_tokens FOR INSERT
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can update own push tokens"
  ON push_tokens FOR UPDATE
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can delete own push tokens"
  ON push_tokens FOR DELETE
  USING (user_id = (select auth.uid()));

-- ============================================
-- TEAM_MEMBERS - Consolidate UPDATE policies
-- Has: "Creators can update team members" + "Team members can update own status"
-- ============================================
DROP POLICY IF EXISTS "Creators can update team members" ON team_members;
DROP POLICY IF EXISTS "Team members can update own status" ON team_members;

-- Single UPDATE policy covering both creators and self-updates
CREATE POLICY "Users can update team members"
  ON team_members FOR UPDATE
  USING (
    user_id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM pursuits
      WHERE pursuits.id = team_members.pursuit_id
      AND pursuits.creator_id = (select auth.uid())
    )
  )
  WITH CHECK (
    user_id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM pursuits
      WHERE pursuits.id = team_members.pursuit_id
      AND pursuits.creator_id = (select auth.uid())
    )
  );
