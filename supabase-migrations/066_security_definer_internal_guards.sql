-- Migration: 066_security_definer_internal_guards.sql
-- Description: REVOKE EXECUTE ... FROM anon, authenticated only revokes explicit
-- grants — the implicit PUBLIC grant remains, so the lints persist. Rather than
-- REVOKE FROM PUBLIC (which would break RLS policies that call these helpers as
-- the calling user), add internal auth.uid() guards. This makes the helpers safe
-- to leave PUBLIC-executable: cross-user probing returns FALSE / no-op, and RLS
-- policies that pass auth.uid() continue to get the real answer.
--
-- The advisor lint (0028/0029) will still warn because the functions remain
-- PUBLIC-executable; that is accepted, with the internal guards as the actual
-- mitigation. Moving these to a non-public schema is a follow-up if the lint
-- warning needs to clear cleanly.

-- ============================================
-- is_pod_member: cross-user probing now returns FALSE
-- ============================================
CREATE OR REPLACE FUNCTION public.is_pod_member(p_pod_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.pursuits WHERE id = p_pod_id AND creator_id = p_user_id
  ) OR EXISTS (
    SELECT 1 FROM public.team_members
    WHERE pursuit_id = p_pod_id
      AND user_id = p_user_id
      AND status IN ('active', 'accepted')
  );
END;
$function$;

-- ============================================
-- is_pod_role_editor: same guard
-- ============================================
CREATE OR REPLACE FUNCTION public.is_pod_role_editor(p_pursuit_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT
    CASE WHEN p_user_id IS DISTINCT FROM auth.uid() THEN FALSE
    ELSE
      EXISTS (
        SELECT 1 FROM pursuits p
        WHERE p.id = p_pursuit_id AND p.creator_id = p_user_id
      ) OR EXISTS (
        SELECT 1 FROM member_roles mr
        WHERE mr.pursuit_id = p_pursuit_id
          AND mr.user_id = p_user_id
          AND mr.role_title ILIKE 'role manager'
      )
    END;
$function$;

-- ============================================
-- is_pod_scheduler: same guard
-- ============================================
CREATE OR REPLACE FUNCTION public.is_pod_scheduler(p_pursuit_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT
    CASE WHEN p_user_id IS DISTINCT FROM auth.uid() THEN FALSE
    ELSE
      EXISTS (
        SELECT 1 FROM pursuits p
        WHERE p.id = p_pursuit_id AND p.creator_id = p_user_id
      ) OR EXISTS (
        SELECT 1 FROM member_roles mr
        WHERE mr.pursuit_id = p_pursuit_id
          AND mr.user_id = p_user_id
          AND mr.role_title ILIKE 'scheduler'
      )
    END;
$function$;

-- ============================================
-- can_view_profile_section: lock to caller as viewer_id
-- ============================================
CREATE OR REPLACE FUNCTION public.can_view_profile_section(viewer_id uuid, target_user_id uuid, section_name text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  prefs privacy_preferences%ROWTYPE;
  allowlist TEXT[];
  is_self BOOLEAN;
  is_connected BOOLEAN;
  shares_pod BOOLEAN;
  is_creator_for_application BOOLEAN;
BEGIN
  -- Caller must be the viewer they're asking about
  IF viewer_id IS DISTINCT FROM auth.uid() THEN
    RETURN FALSE;
  END IF;

  is_self := (viewer_id = target_user_id);
  IF is_self THEN
    RETURN TRUE;
  END IF;

  SELECT * INTO prefs FROM public.privacy_preferences WHERE user_id = target_user_id;

  IF NOT FOUND THEN
    RETURN TRUE;
  END IF;

  CASE section_name
    WHEN 'profile_access' THEN allowlist := prefs.profile_access_allowlist;
    WHEN 'socials' THEN allowlist := prefs.socials_allowlist;
    WHEN 'reviews' THEN allowlist := prefs.reviews_allowlist;
    WHEN 'pods_tab' THEN allowlist := prefs.pods_tab_allowlist;
    WHEN 'connections' THEN allowlist := prefs.connections_allowlist;
    ELSE RETURN FALSE;
  END CASE;

  IF 'none' = ANY(allowlist) THEN
    RETURN FALSE;
  END IF;

  IF 'everyone' = ANY(allowlist) THEN
    RETURN TRUE;
  END IF;

  IF viewer_id IS NULL THEN
    RETURN FALSE;
  END IF;

  IF 'connections' = ANY(allowlist) THEN
    SELECT EXISTS (
      SELECT 1 FROM public.connections
      WHERE status = 'accepted'
      AND ((user_id_1 = viewer_id AND user_id_2 = target_user_id)
           OR (user_id_1 = target_user_id AND user_id_2 = viewer_id))
    ) INTO is_connected;

    IF is_connected THEN
      RETURN TRUE;
    END IF;
  END IF;

  IF 'pod_members' = ANY(allowlist) THEN
    SELECT EXISTS (
      SELECT 1 FROM public.team_members tm1
      JOIN public.team_members tm2 ON tm1.pursuit_id = tm2.pursuit_id
      WHERE tm1.user_id = viewer_id
      AND tm2.user_id = target_user_id
      AND tm1.status IN ('active', 'accepted')
      AND tm2.status IN ('active', 'accepted')
    ) INTO shares_pod;

    IF shares_pod THEN
      RETURN TRUE;
    END IF;
  END IF;

  IF 'pod_creator_when_applying' = ANY(allowlist) THEN
    SELECT EXISTS (
      SELECT 1 FROM public.pursuit_applications a
      JOIN public.pursuits p ON a.pursuit_id = p.id
      WHERE a.applicant_id = target_user_id
      AND p.creator_id = viewer_id
      AND a.status IN ('pending', 'interview_pending', 'interview_times_submitted', 'interview_scheduled')
    ) INTO is_creator_for_application;

    IF is_creator_for_application THEN
      RETURN TRUE;
    END IF;
  END IF;

  RETURN FALSE;
END;
$function$;

-- ============================================
-- get_or_create_privacy_preferences: lock to caller's own user_id
-- ============================================
CREATE OR REPLACE FUNCTION public.get_or_create_privacy_preferences(p_user_id uuid)
RETURNS privacy_preferences
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  result privacy_preferences%ROWTYPE;
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'get_or_create_privacy_preferences may only be called for the caller''s own user_id';
  END IF;

  SELECT * INTO result FROM public.privacy_preferences WHERE user_id = p_user_id;

  IF result IS NULL THEN
    INSERT INTO public.privacy_preferences (user_id)
    VALUES (p_user_id)
    RETURNING * INTO result;
  END IF;

  RETURN result;
END;
$function$;
