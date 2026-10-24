-- ============================================================
-- 084: get_viewable_profile — finish what 079 started.
--
-- 079 closed anonymous access to `profiles` (policy scoped TO authenticated,
-- SELECT revoked from anon). What it left open: any *signed-up* user can still
-- `select('*')` and read every column of every other profile — email, phone,
-- date_of_birth, is_admin, application_status, resume_url.
--
-- 079's own footnote proposed repointing those reads at the `public_profiles`
-- view. That turns out to be the wrong instrument. `public_profiles` omits
-- age, gender, hometown, alcohol, drugs, workout_level and the socials, all of
-- which UserProfileScreen renders — so repointing it would have deleted a
-- large part of the profile UI rather than secured it.
--
-- The better instrument already exists. `can_view_profile_section(viewer,
-- target, section)` (038, redefined in 042, hardened in 066) implements the
-- whole allowlist model server-side: self always passes, a missing
-- preferences row defaults to allow, and it resolves 'none' / 'everyone' /
-- 'connections' / 'pod_members' / 'pod_creator_when_applying'.
--
-- It has simply never been called at read time. `privacyService.ts`
-- reimplements the same logic in TypeScript and filters after the fact, which
-- is why the privacy screen is advisory today: the rows have already crossed
-- the wire by the time the client decides what to hide.
--
-- This RPC makes it load-bearing. One round trip returns exactly the sections
-- the viewer is entitled to, so the privacy settings become real AND profiles
-- stay rich for people allowed to see them.
-- ============================================================

-- ------------------------------------------------------------
-- Column policy
--
-- ALWAYS returned (identity — a restricted profile still needs to say whose
-- it is, or the app can't render "this profile is private" sensibly):
--   id, name, username, profile_picture
--
-- Returned when 'profile_access' passes:
--   bio, profile_pictures, college, work, interests, hobbies, looking_for,
--   pod_types, pod_categories, team_role_preference, team_size_preference,
--   connections_count, created_at, age, gender, hometown, alcohol, drugs,
--   workout_level
--
-- Returned when 'socials' passes (a separate allowlist, deliberately):
--   instagram, linkedin, github, facebook, portfolio_website
--
-- NEVER returned for anyone but the owner — these have no place in a profile
-- view and the owner reads their own row directly via ProfileScreen /
-- EditProfileScreen:
--   email, phone, date_of_birth, selfie_url, resume_url, building, employer,
--   is_admin, application_status, applied_at, reviewed_at,
--   onboarding_completed, privacy_settings, updated_at
--
-- `age` is kept while `date_of_birth` is withheld on purpose: age is the
-- coarse value the profile is built to show, DOB is the identifying one.
--
-- The lists below are an explicit allowlist, so the function fails CLOSED — a
-- column added to `profiles` later is withheld until someone opts it in here.
-- Keys are pulled through `to_jsonb` rather than named as record fields so a
-- name that doesn't exist yields NULL instead of raising, which keeps the
-- function safe to apply ahead of any migration that adds these columns.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_viewable_profile(p_target_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_viewer        uuid := auth.uid();
  v_row           jsonb;
  v_out           jsonb;
  v_can_access    boolean;
  v_can_socials   boolean;
  v_is_self       boolean;
  k               text;

  -- Identity: always returned.
  c_identity text[] := ARRAY[
    'id', 'name', 'username', 'profile_picture'
  ];

  -- Profile body: gated by the 'profile_access' allowlist.
  c_body text[] := ARRAY[
    'bio', 'profile_pictures', 'college', 'work', 'interests', 'hobbies',
    'looking_for', 'pod_types', 'pod_categories', 'team_role_preference',
    'team_size_preference', 'connections_count', 'created_at',
    'age', 'gender', 'hometown', 'alcohol', 'drugs', 'workout_level'
  ];

  -- Socials: gated by the separate 'socials' allowlist.
  c_socials text[] := ARRAY[
    'instagram', 'linkedin', 'github', 'facebook', 'portfolio_website'
  ];
BEGIN
  -- No anonymous reads. 079 revoked anon's SELECT on the table; this keeps the
  -- RPC from reopening that door.
  IF v_viewer IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT to_jsonb(p) INTO v_row FROM public.profiles p WHERE p.id = p_target_id;
  IF v_row IS NULL THEN
    RETURN NULL;
  END IF;

  v_is_self := (v_viewer = p_target_id);

  IF v_is_self THEN
    v_can_access  := TRUE;
    v_can_socials := TRUE;
  ELSE
    v_can_access  := public.can_view_profile_section(v_viewer, p_target_id, 'profile_access');

    -- Parity with privacyService.canViewSection: a pod creator's profile is
    -- always reachable regardless of their allowlist. Without this, someone
    -- browsing the feed couldn't vet the person whose pod they're applying to,
    -- which would make the pod unjoinable in practice.
    IF NOT v_can_access THEN
      SELECT EXISTS (
        SELECT 1 FROM public.pursuits WHERE creator_id = p_target_id
      ) INTO v_can_access;
    END IF;

    v_can_socials := public.can_view_profile_section(v_viewer, p_target_id, 'socials');
  END IF;

  -- Identity first.
  v_out := jsonb_build_object('can_access', v_can_access, 'is_self', v_is_self);
  FOREACH k IN ARRAY c_identity LOOP
    v_out := v_out || jsonb_build_object(k, v_row -> k);
  END LOOP;

  IF NOT v_can_access THEN
    RETURN v_out;
  END IF;

  FOREACH k IN ARRAY c_body LOOP
    v_out := v_out || jsonb_build_object(k, v_row -> k);
  END LOOP;

  IF v_can_socials THEN
    FOREACH k IN ARRAY c_socials LOOP
      v_out := v_out || jsonb_build_object(k, v_row -> k);
    END LOOP;
  END IF;

  RETURN v_out;
END;
$$;

-- Hardened the same way as 065/066: no PUBLIC execute, authenticated only.
-- anon is excluded deliberately — the function would return NULL for it
-- anyway, but there's no reason to let it probe for existence.
REVOKE ALL ON FUNCTION public.get_viewable_profile(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_viewable_profile(uuid) TO authenticated;

COMMENT ON FUNCTION public.get_viewable_profile(uuid) IS
  'Returns another user''s profile as jsonb, limited to the sections the '
  'calling user is entitled to per their privacy_preferences allowlists. '
  'Never returns email, phone, date_of_birth or account-state columns. '
  'Explicit column allowlist — fails closed on new columns. See 084.';

-- ============================================================
-- Verification (run these after applying)
-- ============================================================
-- -- (a) The function exists and is locked to authenticated:
-- SELECT p.proname, p.prosecdef, array_agg(a.privilege_type) AS grants
--   FROM pg_proc p
--   LEFT JOIN information_schema.routine_privileges a
--     ON a.routine_name = p.proname AND a.grantee = 'authenticated'
--  WHERE p.proname = 'get_viewable_profile'
--  GROUP BY p.proname, p.prosecdef;
-- -- expect: prosecdef = true, grants = {EXECUTE}
--
-- -- (b) Reading your own profile returns the body:
-- SELECT public.get_viewable_profile(auth.uid()) ? 'bio' AS has_bio,
--        public.get_viewable_profile(auth.uid()) ? 'email' AS leaks_email;
-- -- expect: has_bio = true, leaks_email = false
--
-- -- (c) No column outside the allowlist can come back. This asserts over the
-- --     live schema rather than trusting the lists above:
-- WITH allowed AS (
--   SELECT unnest(ARRAY[
--     'can_access','is_self','id','name','username','profile_picture',
--     'bio','profile_pictures','college','work','interests','hobbies',
--     'looking_for','pod_types','pod_categories','team_role_preference',
--     'team_size_preference','connections_count','created_at','age','gender',
--     'hometown','alcohol','drugs','workout_level',
--     'instagram','linkedin','github','facebook','portfolio_website'
--   ]) AS k
-- )
-- SELECT t.key AS unexpected_key
--   FROM jsonb_object_keys(public.get_viewable_profile(auth.uid())) AS t(key)
--  WHERE t.key NOT IN (SELECT k FROM allowed);
-- -- expect: 0 rows
--
-- -- (d) A profile that has opted out returns identity only. Set a second
-- --     account's profile_access_allowlist to '{none}' and read it:
-- -- UPDATE privacy_preferences SET profile_access_allowlist = '{none}'
-- --  WHERE user_id = '<other-user-id>';
-- -- SELECT public.get_viewable_profile('<other-user-id>');
-- -- expect: can_access = false, and no 'bio'/'age'/'instagram' keys
-- --     (unless that user has created a pod — see the pod-creator rule above)

-- ============================================================
-- Rollback
-- ============================================================
-- DROP FUNCTION IF EXISTS public.get_viewable_profile(uuid);
-- -- and revert UserProfileScreen.loadProfile to select('*') on profiles.
