-- Pod role-management system
-- 1. Relax the member_roles unique constraint so members can hold multiple roles.
-- 2. Add an is_pod_role_editor() helper: pod creator OR a member with 'Role Manager' role.
-- 3. Rewrite member_roles RLS so only editors may write; all members can read.
-- 4. Add role_edit_requests table for the "Request edit access" flow.

-- ===== 1. Multi-role support =====
-- Old constraint was UNIQUE(pursuit_id, user_id) — one role per user.
-- Drop it and key by (pursuit_id, user_id, role_title) so duplicates are still blocked.
ALTER TABLE member_roles DROP CONSTRAINT IF EXISTS member_roles_pursuit_id_user_id_key;
ALTER TABLE member_roles DROP CONSTRAINT IF EXISTS member_roles_pursuit_user_unique;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'member_roles_pursuit_user_role_key'
  ) THEN
    ALTER TABLE member_roles
      ADD CONSTRAINT member_roles_pursuit_user_role_key
      UNIQUE (pursuit_id, user_id, role_title);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_member_roles_pursuit_user ON member_roles(pursuit_id, user_id);

-- ===== 2. Role-editor helper =====
CREATE OR REPLACE FUNCTION is_pod_role_editor(p_pursuit_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM pursuits p
    WHERE p.id = p_pursuit_id AND p.creator_id = p_user_id
  ) OR EXISTS (
    SELECT 1 FROM member_roles mr
    WHERE mr.pursuit_id = p_pursuit_id
      AND mr.user_id = p_user_id
      AND mr.role_title ILIKE 'role manager'
  );
$$;

GRANT EXECUTE ON FUNCTION is_pod_role_editor(UUID, UUID) TO authenticated;

-- ===== 3. Rewrite member_roles RLS =====
-- Drop every prior policy name we've shipped to start clean.
DROP POLICY IF EXISTS "Team members can view roles" ON member_roles;
DROP POLICY IF EXISTS "Authenticated users can view roles" ON member_roles;
DROP POLICY IF EXISTS "Creator can manage all roles" ON member_roles;
DROP POLICY IF EXISTS "Users can update own role" ON member_roles;
DROP POLICY IF EXISTS "Creators can add roles" ON member_roles;
DROP POLICY IF EXISTS "Users can update roles" ON member_roles;
DROP POLICY IF EXISTS "Creators can delete roles" ON member_roles;
DROP POLICY IF EXISTS "Pod members can view roles" ON member_roles;
DROP POLICY IF EXISTS "Role editors can manage roles" ON member_roles;

CREATE POLICY "Pod members can view roles"
  ON member_roles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM pursuits p
      WHERE p.id = member_roles.pursuit_id
      AND (
        p.creator_id = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1 FROM team_members tm
          WHERE tm.pursuit_id = p.id
            AND tm.user_id = (SELECT auth.uid())
            AND tm.status IN ('active', 'accepted')
        )
      )
    )
  );

CREATE POLICY "Role editors can insert roles"
  ON member_roles FOR INSERT
  WITH CHECK (is_pod_role_editor(pursuit_id, (SELECT auth.uid())));

CREATE POLICY "Role editors can update roles"
  ON member_roles FOR UPDATE
  USING (is_pod_role_editor(pursuit_id, (SELECT auth.uid())))
  WITH CHECK (is_pod_role_editor(pursuit_id, (SELECT auth.uid())));

CREATE POLICY "Role editors can delete roles"
  ON member_roles FOR DELETE
  USING (is_pod_role_editor(pursuit_id, (SELECT auth.uid())));

-- ===== 4. role_edit_requests table =====
CREATE TABLE IF NOT EXISTS role_edit_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pursuit_id UUID NOT NULL REFERENCES pursuits(id) ON DELETE CASCADE,
  requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  decided_by UUID REFERENCES auth.users(id),
  decided_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Only one pending request per (pursuit, requester) — avoid duplicate spam
CREATE UNIQUE INDEX IF NOT EXISTS uniq_pending_role_edit_request
  ON role_edit_requests(pursuit_id, requester_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_role_edit_requests_pursuit ON role_edit_requests(pursuit_id);

ALTER TABLE role_edit_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Requesters can view own requests"
  ON role_edit_requests FOR SELECT
  USING (requester_id = (SELECT auth.uid()));

CREATE POLICY "Role editors can view requests for their pods"
  ON role_edit_requests FOR SELECT
  USING (is_pod_role_editor(pursuit_id, (SELECT auth.uid())));

CREATE POLICY "Members can create own requests"
  ON role_edit_requests FOR INSERT
  WITH CHECK (
    requester_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.pursuit_id = role_edit_requests.pursuit_id
        AND tm.user_id = (SELECT auth.uid())
        AND tm.status IN ('active', 'accepted')
    )
  );

CREATE POLICY "Role editors can decide requests"
  ON role_edit_requests FOR UPDATE
  USING (is_pod_role_editor(pursuit_id, (SELECT auth.uid())))
  WITH CHECK (is_pod_role_editor(pursuit_id, (SELECT auth.uid())));

GRANT ALL ON role_edit_requests TO authenticated;
