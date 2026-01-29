-- Migration: 044_fix_function_search_paths.sql
-- Description: Fix security warning - set search_path on all functions
-- This prevents potential search_path injection attacks
-- Generated: 2025-01-19

-- ============================================
-- TRIGGER FUNCTIONS
-- ============================================

-- Generic updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Alternative modified_at trigger (used by pod_* tables)
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Pod agenda documents specific trigger
CREATE OR REPLACE FUNCTION update_pod_agenda_documents_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Privacy preferences trigger
CREATE OR REPLACE FUNCTION update_privacy_preferences_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ============================================
-- AUTH TRIGGER (SECURITY DEFINER - needs search_path)
-- ============================================

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$;

-- ============================================
-- HELPER FUNCTIONS (used in RLS policies)
-- ============================================

-- Check if user is a pod member (SECURITY DEFINER - bypasses RLS)
CREATE OR REPLACE FUNCTION is_pod_member(p_pod_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.pursuits WHERE id = p_pod_id AND creator_id = p_user_id
  ) OR EXISTS (
    SELECT 1 FROM public.team_members
    WHERE pursuit_id = p_pod_id
      AND user_id = p_user_id
      AND status IN ('active', 'accepted')
  );
END;
$$;

-- ============================================
-- NOTIFICATION FUNCTION (SECURITY DEFINER)
-- ============================================

-- Create notifications (SECURITY DEFINER - allows system to create for any user)
CREATE OR REPLACE FUNCTION create_notifications(input_notifications JSONB)
RETURNS SETOF notifications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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
$$;

-- ============================================
-- REVIEW ELIGIBILITY FUNCTIONS
-- ============================================

-- Count shared completed meetings between two users
CREATE OR REPLACE FUNCTION count_shared_completed_meetings(user_a UUID, user_b UUID, p_pursuit_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  shared_count INTEGER;
BEGIN
  SELECT COUNT(DISTINCT m.id) INTO shared_count
  FROM public.meetings m
  INNER JOIN public.meeting_participants mp_a ON m.id = mp_a.meeting_id AND mp_a.user_id = user_a
  INNER JOIN public.meeting_participants mp_b ON m.id = mp_b.meeting_id AND mp_b.user_id = user_b
  WHERE m.pursuit_id = p_pursuit_id
    AND m.status = 'completed'
    AND mp_a.status = 'accepted'
    AND mp_b.status = 'accepted';

  RETURN shared_count;
END;
$$;

-- Get pursuits where reviewer can review reviewee
CREATE OR REPLACE FUNCTION get_eligible_review_pursuits(reviewer UUID, reviewee UUID)
RETURNS TABLE(pursuit_id UUID, pursuit_title TEXT, shared_meetings INTEGER)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    p.id AS pursuit_id,
    p.title AS pursuit_title,
    count_shared_completed_meetings(reviewer, reviewee, p.id) AS shared_meetings
  FROM public.pursuits p
  -- Both users must be team members (active or creator)
  WHERE (
    EXISTS (
      SELECT 1 FROM public.team_members tm1
      WHERE tm1.pursuit_id = p.id
      AND tm1.user_id = reviewer
      AND tm1.status IN ('active', 'accepted')
    )
    OR p.creator_id = reviewer
  )
  AND (
    EXISTS (
      SELECT 1 FROM public.team_members tm2
      WHERE tm2.pursuit_id = p.id
      AND tm2.user_id = reviewee
      AND tm2.status IN ('active', 'accepted')
    )
    OR p.creator_id = reviewee
  )
  -- Must have 5+ shared completed meetings
  AND count_shared_completed_meetings(reviewer, reviewee, p.id) >= 5
  -- Must not have an existing review in the last 90 days
  AND NOT EXISTS (
    SELECT 1 FROM public.reviews r
    WHERE r.reviewer_id = reviewer
    AND r.reviewee_id = reviewee
    AND r.pursuit_id = p.id
    AND r.created_at > NOW() - INTERVAL '90 days'
  );
END;
$$;

-- ============================================
-- PRIVACY FUNCTIONS
-- ============================================

-- Validate allowlist values
CREATE OR REPLACE FUNCTION check_valid_allowlist(arr TEXT[])
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  valid_values TEXT[] := ARRAY['none', 'connections', 'pod_members', 'pod_creator_when_applying', 'everyone'];
  val TEXT;
BEGIN
  IF arr IS NULL THEN
    RETURN true;
  END IF;
  FOREACH val IN ARRAY arr
  LOOP
    IF NOT (val = ANY(valid_values)) THEN
      RETURN false;
    END IF;
  END LOOP;
  RETURN true;
END;
$$;

-- Get or create privacy preferences
CREATE OR REPLACE FUNCTION get_or_create_privacy_preferences(p_user_id UUID)
RETURNS privacy_preferences
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result privacy_preferences%ROWTYPE;
BEGIN
  -- Try to get existing preferences
  SELECT * INTO result FROM public.privacy_preferences WHERE user_id = p_user_id;

  -- If not found, create default preferences
  IF result IS NULL THEN
    INSERT INTO public.privacy_preferences (user_id)
    VALUES (p_user_id)
    RETURNING * INTO result;
  END IF;

  RETURN result;
END;
$$;

-- Check if viewer can see profile section
CREATE OR REPLACE FUNCTION can_view_profile_section(
  viewer_id UUID,
  target_user_id UUID,
  section_name TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prefs privacy_preferences%ROWTYPE;
  allowlist TEXT[];
  is_self BOOLEAN;
  is_connected BOOLEAN;
  shares_pod BOOLEAN;
  is_creator_for_application BOOLEAN;
BEGIN
  -- Self can always view
  is_self := (viewer_id = target_user_id);
  IF is_self THEN
    RETURN TRUE;
  END IF;

  -- Get preferences (or defaults)
  SELECT * INTO prefs FROM public.privacy_preferences WHERE user_id = target_user_id;

  IF NOT FOUND THEN
    -- Default to everyone for all sections
    RETURN TRUE;
  END IF;

  -- Get the appropriate allowlist
  CASE section_name
    WHEN 'profile_access' THEN allowlist := prefs.profile_access_allowlist;
    WHEN 'socials' THEN allowlist := prefs.socials_allowlist;
    WHEN 'reviews' THEN allowlist := prefs.reviews_allowlist;
    WHEN 'pods_tab' THEN allowlist := prefs.pods_tab_allowlist;
    WHEN 'connections' THEN allowlist := prefs.connections_allowlist;
    ELSE RETURN FALSE;
  END CASE;

  -- Check 'none'
  IF 'none' = ANY(allowlist) THEN
    RETURN FALSE;
  END IF;

  -- Check 'everyone'
  IF 'everyone' = ANY(allowlist) THEN
    RETURN TRUE;
  END IF;

  -- If no viewer, and not 'everyone', deny
  IF viewer_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Check 'connections'
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

  -- Check 'pod_members'
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

  -- Check 'pod_creator_when_applying'
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
$$;
