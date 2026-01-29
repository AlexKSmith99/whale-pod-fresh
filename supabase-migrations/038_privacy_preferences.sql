-- Migration 038: Privacy Preferences System
-- Creates table to store user privacy settings with allowlist-based visibility controls

-- Create the privacy_preferences table
CREATE TABLE IF NOT EXISTS privacy_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_access_allowlist TEXT[] DEFAULT ARRAY['everyone']::TEXT[],
  socials_allowlist TEXT[] DEFAULT ARRAY['everyone']::TEXT[],
  reviews_allowlist TEXT[] DEFAULT ARRAY['everyone']::TEXT[],
  pods_tab_allowlist TEXT[] DEFAULT ARRAY['everyone']::TEXT[],
  pod_public_roster_listed BOOLEAN DEFAULT true,
  pod_public_roster_profile_clickable BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add check constraint for valid allowlist values
-- Valid values: 'none', 'connections', 'pod_members', 'pod_creator_when_applying', 'everyone'
CREATE OR REPLACE FUNCTION check_valid_allowlist(arr TEXT[])
RETURNS BOOLEAN AS $$
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
$$ LANGUAGE plpgsql IMMUTABLE;

ALTER TABLE privacy_preferences
  ADD CONSTRAINT valid_profile_access_allowlist CHECK (check_valid_allowlist(profile_access_allowlist)),
  ADD CONSTRAINT valid_socials_allowlist CHECK (check_valid_allowlist(socials_allowlist)),
  ADD CONSTRAINT valid_reviews_allowlist CHECK (check_valid_allowlist(reviews_allowlist)),
  ADD CONSTRAINT valid_pods_tab_allowlist CHECK (check_valid_allowlist(pods_tab_allowlist));

-- Enable RLS
ALTER TABLE privacy_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view their own privacy preferences
CREATE POLICY "Users can view own privacy preferences"
  ON privacy_preferences FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own privacy preferences
CREATE POLICY "Users can insert own privacy preferences"
  ON privacy_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own privacy preferences
CREATE POLICY "Users can update own privacy preferences"
  ON privacy_preferences FOR UPDATE
  USING (auth.uid() = user_id);

-- Allow reading other users' privacy preferences for visibility checks
-- This is needed so the app can check if viewer is allowed to see target's content
CREATE POLICY "Authenticated users can read privacy preferences for visibility checks"
  ON privacy_preferences FOR SELECT
  TO authenticated
  USING (true);

-- Function to check if a viewer can see a specific section of a target user's profile
-- Returns true if the viewer is allowed to see the section
CREATE OR REPLACE FUNCTION can_view_profile_section(
  viewer_id UUID,
  target_user_id UUID,
  section TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  prefs privacy_preferences%ROWTYPE;
  allowlist TEXT[];
  is_connection BOOLEAN := false;
  is_shared_pod_member BOOLEAN := false;
  is_creator_for_applicant BOOLEAN := false;
  is_pod_creator BOOLEAN := false;
BEGIN
  -- Self can always see everything
  IF viewer_id = target_user_id THEN
    RETURN true;
  END IF;

  -- Get the target user's privacy preferences
  SELECT * INTO prefs FROM privacy_preferences WHERE user_id = target_user_id;
  
  -- If no preferences exist, default to 'everyone' (public)
  IF prefs IS NULL THEN
    RETURN true;
  END IF;

  -- Get the appropriate allowlist based on section
  CASE section
    WHEN 'profile_access' THEN allowlist := prefs.profile_access_allowlist;
    WHEN 'socials' THEN allowlist := prefs.socials_allowlist;
    WHEN 'reviews' THEN allowlist := prefs.reviews_allowlist;
    WHEN 'pods_tab' THEN allowlist := prefs.pods_tab_allowlist;
    ELSE RETURN false;
  END CASE;

  -- If allowlist is null or empty, default to public
  IF allowlist IS NULL OR array_length(allowlist, 1) IS NULL THEN
    RETURN true;
  END IF;

  -- Check for 'none' - blocks everyone except self
  IF 'none' = ANY(allowlist) THEN
    RETURN false;
  END IF;

  -- Check for 'everyone' - allows all
  IF 'everyone' = ANY(allowlist) THEN
    RETURN true;
  END IF;

  -- For profile_access section, check if target is a pod creator (special rule)
  IF section = 'profile_access' THEN
    SELECT EXISTS(
      SELECT 1 FROM pursuits WHERE creator_id = target_user_id
    ) INTO is_pod_creator;
    
    IF is_pod_creator THEN
      RETURN true;  -- Pod creators' profiles are always accessible
    END IF;
  END IF;

  -- If viewer is null (unauthenticated), only 'everyone' would have worked
  IF viewer_id IS NULL THEN
    RETURN false;
  END IF;

  -- Check if viewer is a connection
  IF 'connections' = ANY(allowlist) THEN
    SELECT EXISTS(
      SELECT 1 FROM connections
      WHERE status = 'accepted'
        AND ((user_id_1 = viewer_id AND user_id_2 = target_user_id)
          OR (user_id_1 = target_user_id AND user_id_2 = viewer_id))
    ) INTO is_connection;
    
    IF is_connection THEN
      RETURN true;
    END IF;
  END IF;

  -- Check if viewer shares a pod with target
  IF 'pod_members' = ANY(allowlist) THEN
    SELECT EXISTS(
      SELECT 1 FROM team_members tm1
      JOIN team_members tm2 ON tm1.pursuit_id = tm2.pursuit_id
      WHERE tm1.user_id = viewer_id 
        AND tm2.user_id = target_user_id
        AND tm1.status IN ('active', 'accepted')
        AND tm2.status IN ('active', 'accepted')
      UNION
      SELECT 1 FROM pursuits p
      JOIN team_members tm ON p.id = tm.pursuit_id
      WHERE (p.creator_id = viewer_id AND tm.user_id = target_user_id AND tm.status IN ('active', 'accepted'))
         OR (p.creator_id = target_user_id AND tm.user_id = viewer_id AND tm.status IN ('active', 'accepted'))
      UNION
      SELECT 1 FROM pursuits p1
      JOIN pursuits p2 ON p1.creator_id = viewer_id AND p2.creator_id = target_user_id AND p1.id = p2.id
    ) INTO is_shared_pod_member;
    
    IF is_shared_pod_member THEN
      RETURN true;
    END IF;
  END IF;

  -- Check if viewer is a pod creator who has an application from target
  IF 'pod_creator_when_applying' = ANY(allowlist) THEN
    SELECT EXISTS(
      SELECT 1 FROM pursuit_applications pa
      JOIN pursuits p ON pa.pursuit_id = p.id
      WHERE pa.applicant_id = target_user_id
        AND p.creator_id = viewer_id
        AND pa.status IN ('pending', 'interview_pending', 'interview_scheduled')
    ) INTO is_creator_for_applicant;
    
    IF is_creator_for_applicant THEN
      RETURN true;
    END IF;
  END IF;

  -- No matching conditions
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get or create privacy preferences for a user
CREATE OR REPLACE FUNCTION get_or_create_privacy_preferences(p_user_id UUID)
RETURNS privacy_preferences AS $$
DECLARE
  result privacy_preferences%ROWTYPE;
BEGIN
  -- Try to get existing preferences
  SELECT * INTO result FROM privacy_preferences WHERE user_id = p_user_id;
  
  -- If not found, create default preferences
  IF result IS NULL THEN
    INSERT INTO privacy_preferences (user_id)
    VALUES (p_user_id)
    RETURNING * INTO result;
  END IF;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION can_view_profile_section(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_or_create_privacy_preferences(UUID) TO authenticated;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_privacy_preferences_user_id ON privacy_preferences(user_id);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_privacy_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER privacy_preferences_updated_at
  BEFORE UPDATE ON privacy_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_privacy_preferences_updated_at();

