-- ============================================================
-- 090: drop profiles.alcohol and profiles.drugs.
--
-- Added in 069 as optional "lifestyle" profile fields.
--
-- WHY THEY'RE GOING
-- They were the only reason the App Store privacy declaration needed
-- Health & Fitness → Health. Substance-use answers read naturally as "user
-- provided health data", which brings extra review scrutiny, stricter handling
-- expectations under GDPR special-category rules, and a disclosure obligation
-- in the privacy policy — all for two free-text fields that did nothing for
-- pod matching.
--
-- `workout_level` stays. It is genuinely relevant to fitness pods, and
-- Health & Fitness → Fitness is a much cheaper declaration than Health.
--
-- See APP_PRIVACY.md §3.1 for the decision this implements.
--
-- ⚠️ DESTRUCTIVE. Dropping a column deletes its data; there is no undo short
--    of a database restore. Run the count in step 1 first if you want to know
--    what you're discarding.
-- ============================================================

-- ------------------------------------------------------------
-- 1. What's being discarded (informational — read it, then continue)
-- ------------------------------------------------------------
SELECT
  count(*) FILTER (WHERE alcohol IS NOT NULL) AS rows_with_alcohol,
  count(*) FILTER (WHERE drugs   IS NOT NULL) AS rows_with_drugs
FROM public.profiles;

-- ------------------------------------------------------------
-- 2. Refresh get_viewable_profile WITHOUT the two keys.
--
-- Done BEFORE the drop so there is no window where the function advertises a
-- column that no longer exists.
--
-- Worth noting: 084 reads keys via `to_jsonb(p) -> k`, which yields NULL for a
-- missing key instead of raising. So this step is correctness and tidiness
-- rather than a crash fix — the app would have survived the drop either way.
-- That was the point of building it that way.
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

  c_identity text[] := ARRAY[
    'id', 'name', 'username', 'profile_picture'
  ];

  -- alcohol and drugs removed in 090.
  c_body text[] := ARRAY[
    'bio', 'profile_pictures', 'college', 'work', 'interests', 'hobbies',
    'looking_for', 'pod_types', 'pod_categories', 'team_role_preference',
    'team_size_preference', 'connections_count', 'created_at',
    'age', 'gender', 'hometown', 'workout_level'
  ];

  c_socials text[] := ARRAY[
    'instagram', 'linkedin', 'github', 'facebook', 'portfolio_website'
  ];
BEGIN
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
    -- always reachable, or applicants couldn't vet the pod they're joining.
    IF NOT v_can_access THEN
      SELECT EXISTS (
        SELECT 1 FROM public.pursuits WHERE creator_id = p_target_id
      ) INTO v_can_access;
    END IF;

    v_can_socials := public.can_view_profile_section(v_viewer, p_target_id, 'socials');
  END IF;

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

REVOKE ALL ON FUNCTION public.get_viewable_profile(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_viewable_profile(uuid) TO authenticated;

-- ------------------------------------------------------------
-- 3. Drop the columns.
--
-- `public_profiles` (079) never included either field, so the view does not
-- need rebuilding — verified against its column list.
-- ------------------------------------------------------------
ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS alcohol,
  DROP COLUMN IF EXISTS drugs;

-- ============================================================
-- VERIFY
-- ============================================================
-- -- (a) the columns are gone:
-- SELECT column_name FROM information_schema.columns
--  WHERE table_name = 'profiles' AND column_name IN ('alcohol', 'drugs');
-- -- expect: 0 rows
--
-- -- (b) workout_level survived:
-- SELECT column_name FROM information_schema.columns
--  WHERE table_name = 'profiles' AND column_name = 'workout_level';
-- -- expect: 1 row
--
-- -- (c) the RPC still works and no longer mentions them:
-- SELECT public.get_viewable_profile(auth.uid()) ? 'workout_level' AS has_workout,
--        public.get_viewable_profile(auth.uid()) ? 'alcohol'       AS has_alcohol,
--        public.get_viewable_profile(auth.uid()) ? 'drugs'         AS has_drugs;
-- -- expect: true, false, false
--
-- -- (d) the safe projection is unaffected:
-- SELECT count(*) > 0 AS view_ok FROM public.public_profiles;
-- -- expect: true

-- ============================================================
-- ROLLBACK — restores the columns, NOT the data
-- ============================================================
-- ALTER TABLE public.profiles
--   ADD COLUMN IF NOT EXISTS alcohol text,
--   ADD COLUMN IF NOT EXISTS drugs   text;
-- -- Then re-add 'alcohol','drugs' to c_body in get_viewable_profile, restore
-- -- the two inputs in EditProfileScreen and the two rows in the Lifestyle
-- -- sections of ProfileScreen / UserProfileScreen — and put Health back in
-- -- the App Store privacy declaration.
