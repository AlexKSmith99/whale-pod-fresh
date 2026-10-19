-- Migration: 078_restore_meetings_rls.sql
-- Fixes: REVIEW.md C-2 (RLS disabled on meeting tables) and H-1 (USING(true) policies)
--
-- BACKGROUND
-- 010_disable_meetings_rls.sql turned RLS OFF on meetings, meeting_participants,
-- kickoff_time_proposals and meeting_agenda_items to work around an infinite
-- recursion bug, with a note to restore it "later". It was never restored, so
-- any authenticated user can currently read AND write every meeting row in the
-- system.
--
-- 035 and 036 later added policies to these tables, but policies on a table with
-- RLS disabled are INERT — they do nothing. Those policies are also all
-- `USING (true)`, so simply re-enabling RLS would leave reads wide open. This
-- migration therefore DROPS every existing policy before creating scoped ones.
--
-- WHY THIS WON'T RE-TRIGGER THE ORIGINAL RECURSION
-- The 2023 recursion came from policies that referenced each other (a meetings
-- policy selecting from meeting_participants, whose own policy selected back
-- from meetings). Every policy below instead delegates to SECURITY DEFINER
-- helpers, which bypass RLS internally and therefore cannot recurse.
--
-- ⚠️ APPLY DURING LOW TRAFFIC AND TEST THE CALENDAR IMMEDIATELY AFTER.
--    A rollback block is provided at the bottom.

-- ============================================================
-- Helper: is the current user a member of the pod that owns this meeting?
-- Resolves meeting -> pursuit -> is_pod_member in one SECURITY DEFINER hop so
-- that policies on meeting_participants / meeting_agenda_items never trigger a
-- nested RLS evaluation on `meetings`.
-- Mirrors the self-guard + search_path hardening from 066.
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_meeting_pod_member(p_meeting_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_pursuit_id uuid;
BEGIN
  -- Never answer questions about anyone other than the caller.
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RETURN FALSE;
  END IF;

  SELECT pursuit_id INTO v_pursuit_id FROM public.meetings WHERE id = p_meeting_id;
  IF v_pursuit_id IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN public.is_pod_member(v_pursuit_id, p_user_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.is_meeting_pod_member(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_meeting_pod_member(uuid, uuid) TO authenticated;

-- ============================================================
-- Drop every existing policy on the four tables.
-- Required: the leftovers from 035/036 are all USING (true), and they would
-- become live the moment RLS is enabled.
-- ============================================================
DO $$
DECLARE
  t text;
  r RECORD;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'meetings',
    'meeting_participants',
    'kickoff_time_proposals',
    'meeting_agenda_items'
  ] LOOP
    FOR r IN (
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t
    ) LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, t);
    END LOOP;
  END LOOP;
END $$;

-- ============================================================
-- MEETINGS  (has pursuit_id directly)
-- ============================================================
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pod members can view meetings"
  ON public.meetings FOR SELECT TO authenticated
  USING (public.is_pod_member(pursuit_id, (select auth.uid())));

-- Any pod member may schedule, but only as themselves.
CREATE POLICY "Pod members can create meetings"
  ON public.meetings FOR INSERT TO authenticated
  WITH CHECK (
    creator_id = (select auth.uid())
    AND public.is_pod_member(pursuit_id, (select auth.uid()))
  );

-- Members update status (in_progress / completed); the app also edits details.
CREATE POLICY "Pod members can update meetings"
  ON public.meetings FOR UPDATE TO authenticated
  USING (public.is_pod_member(pursuit_id, (select auth.uid())))
  WITH CHECK (public.is_pod_member(pursuit_id, (select auth.uid())));

-- Deletion is narrower: the meeting's creator or the pod's creator only.
CREATE POLICY "Meeting or pod creator can delete meetings"
  ON public.meetings FOR DELETE TO authenticated
  USING (
    creator_id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.pursuits p
      WHERE p.id = meetings.pursuit_id AND p.creator_id = (select auth.uid())
    )
  );

-- ============================================================
-- MEETING_PARTICIPANTS  (meeting_id + user_id)
-- ============================================================
ALTER TABLE public.meeting_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pod members can view participants"
  ON public.meeting_participants FOR SELECT TO authenticated
  USING (public.is_meeting_pod_member(meeting_id, (select auth.uid())));

-- createMeeting() bulk-inserts the roster, so any pod member may insert.
CREATE POLICY "Pod members can add participants"
  ON public.meeting_participants FOR INSERT TO authenticated
  WITH CHECK (public.is_meeting_pod_member(meeting_id, (select auth.uid())));

-- RSVP: you may only change your own attendance row.
CREATE POLICY "Users can update their own participation"
  ON public.meeting_participants FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users or meeting creator can remove participants"
  ON public.meeting_participants FOR DELETE TO authenticated
  USING (
    user_id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.meetings m
      WHERE m.id = meeting_participants.meeting_id
        AND m.creator_id = (select auth.uid())
    )
  );

-- ============================================================
-- KICKOFF_TIME_PROPOSALS  (pursuit_id + user_id, UNIQUE(pursuit_id,user_id))
-- The app upserts here, so INSERT and UPDATE must both be permitted.
-- ============================================================
ALTER TABLE public.kickoff_time_proposals ENABLE ROW LEVEL SECURITY;

-- The pod creator needs to read everyone's proposals to pick a slot.
CREATE POLICY "Pod members can view kickoff proposals"
  ON public.kickoff_time_proposals FOR SELECT TO authenticated
  USING (public.is_pod_member(pursuit_id, (select auth.uid())));

CREATE POLICY "Pod members can submit their own proposals"
  ON public.kickoff_time_proposals FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (select auth.uid())
    AND public.is_pod_member(pursuit_id, (select auth.uid()))
  );

CREATE POLICY "Users can update their own proposals"
  ON public.kickoff_time_proposals FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can delete their own proposals"
  ON public.kickoff_time_proposals FOR DELETE TO authenticated
  USING (user_id = (select auth.uid()));

-- ============================================================
-- MEETING_AGENDA_ITEMS  (meeting_id + creator_id)
-- ============================================================
ALTER TABLE public.meeting_agenda_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pod members can view agenda items"
  ON public.meeting_agenda_items FOR SELECT TO authenticated
  USING (public.is_meeting_pod_member(meeting_id, (select auth.uid())));

CREATE POLICY "Pod members can create agenda items"
  ON public.meeting_agenda_items FOR INSERT TO authenticated
  WITH CHECK (
    creator_id = (select auth.uid())
    AND public.is_meeting_pod_member(meeting_id, (select auth.uid()))
  );

-- Members tick items complete, so UPDATE is pod-wide rather than author-only.
CREATE POLICY "Pod members can update agenda items"
  ON public.meeting_agenda_items FOR UPDATE TO authenticated
  USING (public.is_meeting_pod_member(meeting_id, (select auth.uid())))
  WITH CHECK (public.is_meeting_pod_member(meeting_id, (select auth.uid())));

CREATE POLICY "Authors can delete their agenda items"
  ON public.meeting_agenda_items FOR DELETE TO authenticated
  USING (creator_id = (select auth.uid()));

-- ============================================================
-- VERIFY — run this after applying. rls_enabled must be true on all four rows.
-- ============================================================
-- SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled,
--        (SELECT count(*) FROM pg_policies p
--          WHERE p.schemaname='public' AND p.tablename=c.relname) AS policy_count
-- FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
-- WHERE n.nspname='public'
--   AND c.relname IN ('meetings','meeting_participants',
--                     'kickoff_time_proposals','meeting_agenda_items')
-- ORDER BY c.relname;

-- ============================================================
-- ROLLBACK — restores the previous (insecure) state if the calendar breaks.
-- ============================================================
-- ALTER TABLE public.meetings DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.meeting_participants DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.kickoff_time_proposals DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.meeting_agenda_items DISABLE ROW LEVEL SECURITY;
