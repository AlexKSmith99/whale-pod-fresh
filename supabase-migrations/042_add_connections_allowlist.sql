-- Migration: Add connections_allowlist to privacy_preferences
-- This allows users to control who can see their connections list

-- Add the new column
ALTER TABLE privacy_preferences
ADD COLUMN IF NOT EXISTS connections_allowlist TEXT[] DEFAULT ARRAY['everyone']::TEXT[];

-- Add check constraint (use DO block to handle if it already exists)
DO $$
BEGIN
  ALTER TABLE privacy_preferences
  ADD CONSTRAINT valid_connections_allowlist CHECK (check_valid_allowlist(connections_allowlist));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Drop the existing function first, then recreate with connections support
DROP FUNCTION IF EXISTS can_view_profile_section(UUID, UUID, TEXT);

-- Recreate the can_view_profile_section function with connections support
CREATE OR REPLACE FUNCTION can_view_profile_section(
  viewer_id UUID,
  target_user_id UUID,
  section_name TEXT
)
RETURNS BOOLEAN AS $$
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
  SELECT * INTO prefs FROM privacy_preferences WHERE user_id = target_user_id;
  
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
      SELECT 1 FROM connections
      WHERE status = 'accepted'
      AND ((user_id = viewer_id AND connected_user_id = target_user_id)
           OR (user_id = target_user_id AND connected_user_id = viewer_id))
    ) INTO is_connected;
    
    IF is_connected THEN
      RETURN TRUE;
    END IF;
  END IF;

  -- Check 'pod_members'
  IF 'pod_members' = ANY(allowlist) THEN
    SELECT EXISTS (
      SELECT 1 FROM team_members tm1
      JOIN team_members tm2 ON tm1.pursuit_id = tm2.pursuit_id
      WHERE tm1.user_id = viewer_id
      AND tm2.user_id = target_user_id
      AND tm1.status = 'active'
      AND tm2.status = 'active'
    ) INTO shares_pod;
    
    IF shares_pod THEN
      RETURN TRUE;
    END IF;
  END IF;

  -- Check 'pod_creator_when_applying'
  IF 'pod_creator_when_applying' = ANY(allowlist) THEN
    SELECT EXISTS (
      SELECT 1 FROM applications a
      JOIN pursuits p ON a.pursuit_id = p.id
      WHERE a.user_id = target_user_id
      AND p.creator_id = viewer_id
      AND a.status IN ('pending', 'interviewing', 'interview_scheduled')
    ) INTO is_creator_for_application;
    
    IF is_creator_for_application THEN
      RETURN TRUE;
    END IF;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

