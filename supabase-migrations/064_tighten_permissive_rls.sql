-- Migration: 064_tighten_permissive_rls.sql
-- Description: Replace WITH CHECK (true) / USING (true) RLS policies on
-- kick_proposals, kickoff_meetings, time_slot_proposals, votes, and notifications.
-- Previous state allowed any authenticated user to insert/update rows for any pod
-- (or, for notifications, any user_id including anon). New policies require pod
-- membership and ownership where applicable. Notifications direct INSERT is removed
-- entirely; client code must go through the create_notifications() RPC.

-- ============================================
-- kick_proposals
-- ============================================
DROP POLICY IF EXISTS "Users can create kick proposals" ON public.kick_proposals;
DROP POLICY IF EXISTS "Users can update own kick proposals" ON public.kick_proposals;

CREATE POLICY "Pod members can create kick proposals"
ON public.kick_proposals FOR INSERT
TO authenticated
WITH CHECK (
  is_pod_member(pursuit_id, (SELECT auth.uid()))
  AND created_by = (SELECT auth.uid())
);

-- Updates (e.g. votes/status changes) are allowed by any pod member; the original
-- proposal author has no special update privilege here, matching existing UX.
CREATE POLICY "Pod members can update kick proposals"
ON public.kick_proposals FOR UPDATE
TO authenticated
USING (is_pod_member(pursuit_id, (SELECT auth.uid())))
WITH CHECK (is_pod_member(pursuit_id, (SELECT auth.uid())));

-- ============================================
-- kickoff_meetings
-- ============================================
DROP POLICY IF EXISTS "Users can create kickoff meetings" ON public.kickoff_meetings;
DROP POLICY IF EXISTS "Users can update kickoff meetings" ON public.kickoff_meetings;

CREATE POLICY "Pod members can create kickoff meetings"
ON public.kickoff_meetings FOR INSERT
TO authenticated
WITH CHECK (
  is_pod_member(pursuit_id, (SELECT auth.uid()))
  AND created_by = (SELECT auth.uid())
);

CREATE POLICY "Pod members can update kickoff meetings"
ON public.kickoff_meetings FOR UPDATE
TO authenticated
USING (is_pod_member(pursuit_id, (SELECT auth.uid())))
WITH CHECK (is_pod_member(pursuit_id, (SELECT auth.uid())));

-- ============================================
-- time_slot_proposals
-- ============================================
DROP POLICY IF EXISTS "Users can create time slot proposals" ON public.time_slot_proposals;
DROP POLICY IF EXISTS "Users can update own time slot proposals" ON public.time_slot_proposals;

-- Each user may only propose slots as themselves, and only for pods they belong to.
CREATE POLICY "Pod members can create own time slot proposals"
ON public.time_slot_proposals FOR INSERT
TO authenticated
WITH CHECK (
  is_pod_member(pursuit_id, (SELECT auth.uid()))
  AND user_id = (SELECT auth.uid())
);

-- Only the proposer can update their proposal.
CREATE POLICY "Users can update own time slot proposals"
ON public.time_slot_proposals FOR UPDATE
TO authenticated
USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));

-- ============================================
-- votes
-- ============================================
DROP POLICY IF EXISTS "Users can create votes" ON public.votes;
DROP POLICY IF EXISTS "Users can update own votes" ON public.votes;

CREATE POLICY "Pod members can create votes"
ON public.votes FOR INSERT
TO authenticated
WITH CHECK (
  is_pod_member(pursuit_id, (SELECT auth.uid()))
  AND created_by = (SELECT auth.uid())
);

-- Vote rows mutate as members cast votes (votes_for / votes_against arrays).
-- Restrict UPDATE to pod members; finer-grained per-array control would require
-- an RPC and is out of scope for this migration.
CREATE POLICY "Pod members can update votes"
ON public.votes FOR UPDATE
TO authenticated
USING (is_pod_member(pursuit_id, (SELECT auth.uid())))
WITH CHECK (is_pod_member(pursuit_id, (SELECT auth.uid())));

-- ============================================
-- notifications
-- ============================================
-- Direct client INSERT removed. The only legitimate creation path is the
-- create_notifications() RPC, which is SECURITY DEFINER and bypasses RLS.
-- (Migration 065 adds an authenticated-caller check inside that RPC.)
DROP POLICY IF EXISTS "notifications_insert" ON public.notifications;
