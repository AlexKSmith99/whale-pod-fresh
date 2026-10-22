-- Migration: 080_next_meeting_visibility.sql
-- Adds a per-pod setting controlling who can see the pod's next meeting, and a
-- SECURITY DEFINER accessor that enforces it server-side.
--
-- WHY AN RPC RATHER THAN A POLICY CHANGE
-- 078 locked `meetings` down to pod members. That is the right default and we
-- are not reopening it: widening the table policy would expose every column of
-- every meeting row (agenda, location, Agora channel/token) to non-members.
-- Instead this function runs as definer, reads the one upcoming meeting, and
-- returns only what the caller is entitled to:
--
--   member of the pod          -> full details
--   non-member, 'everyone'     -> full details
--   non-member, 'pod_members'  -> { "detailed": false } (a bare "is scheduled")
--   no upcoming meeting        -> NULL
--
-- The summary form deliberately leaks nothing beyond "this pod is active",
-- which is what makes a pod worth applying to.

-- ============================================================
-- 1. The setting. Default 'pod_members' preserves the behaviour that has been
--    live since 078 — existing pods are NOT silently made more public.
-- ============================================================
ALTER TABLE public.pursuits
  ADD COLUMN IF NOT EXISTS next_meeting_visibility text NOT NULL DEFAULT 'pod_members';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pursuits_next_meeting_visibility_check'
  ) THEN
    ALTER TABLE public.pursuits
      ADD CONSTRAINT pursuits_next_meeting_visibility_check
      CHECK (next_meeting_visibility IN ('everyone', 'pod_members'));
  END IF;
END $$;

-- ============================================================
-- 2. The accessor.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_pod_next_meeting(p_pursuit_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_visibility text;
  v_is_member  boolean;
  v_meeting    record;
BEGIN
  IF p_pursuit_id IS NULL OR auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT next_meeting_visibility INTO v_visibility
  FROM public.pursuits WHERE id = p_pursuit_id;

  IF v_visibility IS NULL THEN
    RETURN NULL;  -- no such pod
  END IF;

  -- is_pod_member self-guards on auth.uid(), so this cannot be used to probe
  -- another user's membership.
  v_is_member := public.is_pod_member(p_pursuit_id, auth.uid());

  SELECT id, title, scheduled_time, duration_minutes, meeting_type, is_kickoff
    INTO v_meeting
  FROM public.meetings
  WHERE pursuit_id = p_pursuit_id
    AND status = 'scheduled'
    AND scheduled_time >= now()
  ORDER BY scheduled_time ASC
  LIMIT 1;

  IF v_meeting.id IS NULL THEN
    RETURN NULL;  -- nothing upcoming; nobody sees anything
  END IF;

  -- Non-members on a members-only pod learn only that something is scheduled.
  IF NOT v_is_member AND v_visibility <> 'everyone' THEN
    RETURN jsonb_build_object('detailed', false);
  END IF;

  RETURN jsonb_build_object(
    'detailed',         true,
    'id',               v_meeting.id,
    'title',            v_meeting.title,
    'scheduled_time',   v_meeting.scheduled_time,
    'duration_minutes', v_meeting.duration_minutes,
    'meeting_type',     v_meeting.meeting_type,
    'is_kickoff',       v_meeting.is_kickoff
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_pod_next_meeting(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_pod_next_meeting(uuid) TO authenticated;

-- ============================================================
-- VERIFY
-- ============================================================
-- select id, title, next_meeting_visibility from public.pursuits limit 5;
--   -- expect every existing row to read 'pod_members'
-- select public.get_pod_next_meeting('<a pod you belong to>');
--   -- expect "detailed": true with the meeting fields

-- ============================================================
-- ROLLBACK
-- ============================================================
-- DROP FUNCTION IF EXISTS public.get_pod_next_meeting(uuid);
-- ALTER TABLE public.pursuits DROP CONSTRAINT IF EXISTS pursuits_next_meeting_visibility_check;
-- ALTER TABLE public.pursuits DROP COLUMN IF EXISTS next_meeting_visibility;
