-- Migration: 083_user_badges.sql
-- Computes the credential badges shown on a profile while vetting someone.
--
-- TWO SEPARATE BADGES, earned independently:
--   Pod Leader  — has led at least one pod that genuinely ran
--   Regular     — has been involved in 3+ pods
-- They're different claims. A strong member may never have led, and a
-- first-time leader shouldn't be invisible for not having joined three pods.
--
-- WHAT COUNTS AS A POD THAT "RAN"
-- `pursuits` has only created_at — no completed_at or archived_at — so pod
-- duration can't be measured from the pursuit row. Meetings are used as the
-- clock instead, which is also a better signal: it measures elapsed *activity*
-- rather than elapsed time, so a pod created months ago that never met does
-- not qualify.
--
--   status reached 'active' (not merely awaiting kickoff)
--   at least 2 meetings scheduled
--   28+ days between the first and last meeting
--
-- SECURITY DEFINER because this reads other people's pursuits and memberships,
-- which RLS rightly hides. It returns only aggregate counts and booleans —
-- never which pods, so it can't be used to enumerate someone's pod history.

CREATE OR REPLACE FUNCTION public.get_user_badges(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_led_count   integer := 0;
  v_pod_count   integer := 0;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'led_count', 0, 'pod_count', 0, 'pod_leader', false, 'regular', false
    );
  END IF;

  -- Pods they created that reached 'active' and sustained 4+ weeks of meetings.
  SELECT count(*) INTO v_led_count
  FROM (
    SELECT p.id
    FROM public.pursuits p
    JOIN public.meetings m ON m.pursuit_id = p.id
    WHERE p.creator_id = p_user_id
      -- 'active' or beyond: a pod still collecting proposals never got going.
      AND p.status IN ('active', 'completed', 'archived')
    GROUP BY p.id
    HAVING count(m.id) >= 2
       AND (max(m.scheduled_time) - min(m.scheduled_time)) >= interval '28 days'
  ) led;

  -- Pods they've been involved in at all: joined OR created. Leading is
  -- involvement too, and team_members does not reliably contain the creator.
  SELECT count(*) INTO v_pod_count
  FROM (
    SELECT tm.pursuit_id AS id
    FROM public.team_members tm
    WHERE tm.user_id = p_user_id
      AND tm.status IN ('active', 'accepted')
    UNION                                   -- UNION, not UNION ALL: dedupes
    SELECT p.id                             -- a creator who is also a member
    FROM public.pursuits p
    WHERE p.creator_id = p_user_id
  ) involved;

  RETURN jsonb_build_object(
    'led_count',  v_led_count,
    'pod_count',  v_pod_count,
    'pod_leader', v_led_count >= 1,
    'regular',    v_pod_count >= 3
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_user_badges(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_badges(uuid) TO authenticated;

-- ============================================================
-- VERIFY
-- ============================================================
-- select public.get_user_badges((select auth.uid()));
--   -- {"led_count":N,"pod_count":N,"pod_leader":bool,"regular":bool}
--
-- -- a pod with meetings less than 28 days apart must NOT count:
-- select public.get_user_badges('<user who led only a short pod>');
--   -- expect pod_leader false

-- ============================================================
-- ROLLBACK
-- ============================================================
-- DROP FUNCTION IF EXISTS public.get_user_badges(uuid);
