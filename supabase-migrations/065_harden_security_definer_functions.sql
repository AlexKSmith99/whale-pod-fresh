-- Migration: 065_harden_security_definer_functions.sql
-- Description: SECURITY DEFINER functions in the public schema were callable by
-- the anon role and (for some) accepted caller-supplied user IDs without checking
-- against auth.uid(). Lint findings: 0028, 0029, 0011.
--
-- Strategy:
--   * Helper functions used only by RLS policies (is_pod_member, is_pod_role_editor,
--     is_pod_scheduler, can_view_profile_section, get_or_create_privacy_preferences,
--     handle_new_user) → revoke EXECUTE from anon and authenticated. RLS policies
--     and triggers continue to work because they bypass GRANT checks.
--   * RPCs the client actually calls (create_notifications) → keep authenticated
--     access, revoke anon, and add an internal auth.uid() guard.
--   * update_meeting_series_updated_at trigger function → set search_path to fix
--     the mutable search_path lint.

-- ============================================
-- Helpers used only by RLS / triggers — revoke from external callers
-- ============================================
REVOKE EXECUTE ON FUNCTION public.is_pod_member(uuid, uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_pod_role_editor(uuid, uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_pod_scheduler(uuid, uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.can_view_profile_section(uuid, uuid, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_or_create_privacy_preferences(uuid) FROM anon, authenticated;

-- handle_new_user is a trigger function on auth.users — never legitimately called as RPC
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;

-- ============================================
-- create_notifications: client-callable RPC, harden but keep working
-- ============================================
REVOKE EXECUTE ON FUNCTION public.create_notifications(jsonb) FROM anon;

CREATE OR REPLACE FUNCTION public.create_notifications(input_notifications jsonb)
RETURNS SETOF notifications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'create_notifications requires an authenticated caller';
  END IF;

  IF input_notifications IS NULL OR jsonb_typeof(input_notifications) <> 'array' THEN
    RAISE EXCEPTION 'input_notifications must be a JSON array';
  END IF;

  RETURN QUERY
  INSERT INTO public.notifications (
    user_id,
    title,
    body,
    type,
    related_id,
    related_type,
    action_url,
    data
  )
  SELECT
    (notification ->> 'user_id')::uuid,
    COALESCE(notification ->> 'title', ''),
    COALESCE(notification ->> 'body', ''),
    COALESCE(notification ->> 'type', 'general'),
    NULLIF(notification ->> 'related_id', '')::uuid,
    NULLIF(notification ->> 'related_type', ''),
    NULLIF(notification ->> 'action_url', ''),
    notification -> 'data'
  FROM jsonb_array_elements(input_notifications) AS notification
  RETURNING *;
END;
$function$;

-- ============================================
-- update_meeting_series_updated_at: fix mutable search_path lint
-- ============================================
CREATE OR REPLACE FUNCTION public.update_meeting_series_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;
