-- Migration: 079_restrict_profiles_pii.sql
-- Fixes: REVIEW.md C-1 (profiles readable by everyone, including anon)
--
-- BACKGROUND
-- The current policy, last rewritten in 043, is:
--
--     CREATE POLICY "Public profiles are viewable by everyone"
--       ON profiles FOR SELECT USING (true);
--
-- With no TO clause it applies to EVERY role, including `anon`. The anon key is
-- embedded in the shipped app binary and is public by design, so anyone holding
-- it can read every row of `profiles` — phone, date_of_birth, age, email,
-- hometown, employer, gender, alcohol, drugs, selfie_url, is_admin.
--
-- ⚠️ SCOPE — READ THIS. This migration closes the anonymous hole and ships the
-- view needed for the rest. It does NOT by itself stop one logged-in user from
-- reading another user's PII, because any attacker can simply sign up. Postgres
-- RLS is row-level, not column-level, so the complete fix requires repointing
-- the app's other-user reads at `public_profiles` (see FOLLOW-UP at the bottom).
-- That part needs app changes and testing and is intentionally not done here.

-- ============================================================
-- 1. Keep anonymous username availability working.
--
-- MUST come first. `UsernameStep` runs BEFORE auth.signUp() in ApplyFlow, so
-- the signup username check queries `profiles` as `anon`. Revoking anon access
-- without this would make that check error out — and its catch block treats
-- errors as "available", so every username would silently read as free and
-- duplicates would sail through.
--
-- This RPC leaks nothing beyond whether a name is taken, which is inherent to
-- any uniqueness check.
-- ============================================================
CREATE OR REPLACE FUNCTION public.username_available(p_username text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF p_username IS NULL OR btrim(p_username) = '' THEN
    RETURN FALSE;
  END IF;

  RETURN NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE username ILIKE btrim(p_username)
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.username_available(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.username_available(text) TO anon, authenticated;

-- ============================================================
-- 2. Close anonymous read access to profiles.
-- ============================================================
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;

CREATE POLICY "Authenticated users can view profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

-- Belt and braces: even if some future policy omits a TO clause again, anon
-- has no table privilege to fall back on.
REVOKE SELECT ON public.profiles FROM anon;

-- ============================================================
-- 3. public_profiles — the safe projection for viewing OTHER users.
--
-- Column list verified against the live schema on 2026-10-18 (an earlier draft
-- referenced `avatar_url`, which does not exist on this table).
--
-- Deliberately EXCLUDED as personal data:
--   phone, date_of_birth, age, gender, hometown, building, employer,
--   alcohol, drugs, workout_level, selfie_url, resume_url, email
--
-- Excluded as internal/account state, not profile content:
--   is_admin, application_status, applied_at, reviewed_at,
--   onboarding_completed, privacy_settings, updated_at
--
-- Socials (facebook, github, instagram, linkedin, portfolio_website) are also
-- excluded: they are gated by `socials_allowlist` in privacyService, and
-- publishing them in a blanket view would quietly defeat that setting.
--
-- `email` deserves a note. The app reads it for other users in several places
-- (e.g. `select('id, name, email, profile_picture')`), mostly to pass an
-- identifier into the messaging flow. Those call sites should move to `id`;
-- email is personal data and should not double as a display/identity token.
--
-- security_invoker = on so the view respects the querying user's RLS rather
-- than the view owner's. Requires Postgres 15+ (Supabase is well past this).
-- ============================================================
DROP VIEW IF EXISTS public.public_profiles;

CREATE VIEW public.public_profiles
WITH (security_invoker = on)
AS
SELECT
  id,
  name,
  username,
  bio,
  profile_picture,
  profile_pictures,
  college,
  work,
  interests,
  hobbies,
  looking_for,
  pod_types,
  pod_categories,
  team_role_preference,
  team_size_preference,
  connections_count,
  created_at
FROM public.profiles;

GRANT SELECT ON public.public_profiles TO authenticated;

-- ============================================================
-- VERIFY — run after applying.
-- ============================================================
-- -- (a) anon must have no SELECT on profiles:
-- SELECT grantee, privilege_type FROM information_schema.role_table_grants
--  WHERE table_schema='public' AND table_name='profiles' AND grantee='anon';
--   -- expect: zero rows
--
-- -- (b) the policy must be scoped to authenticated:
-- SELECT policyname, roles, cmd FROM pg_policies
--  WHERE schemaname='public' AND tablename='profiles' AND cmd='SELECT';
--   -- expect: roles = {authenticated}
--
-- -- (c) the signup path must still work anonymously:
-- SELECT public.username_available('somename');

-- ============================================================
-- FOLLOW-UP required to fully close C-1 (app changes + testing):
--
--   1. src/screens/UserProfileScreen.tsx:103 — `.from('profiles').select('*')`
--      is the main leak: it pulls every column for someone else's profile.
--      Repoint to `.from('public_profiles').select('*')`.
--
--   2. Audit the other-user reads that select `email`
--      (e.g. 'id, name, email, profile_picture') and drop the email column,
--      using `id` as the identifier instead.
--
--   3. ProfileScreen.tsx:58 and EditProfileScreen.tsx:73 also use select('*'),
--      but both read the CURRENT user's own row — leave them on `profiles`.
--
--   4. Once nothing reads another user's row from `profiles` directly, tighten
--      the policy in step 2 from `USING (true)` to
--      `USING (id = (select auth.uid()))`, which makes the base table
--      owner-only and leaves `public_profiles` as the sole cross-user path.
--      Do this last — it is the step that will break anything still missed.
--
--   5. The privacy allowlists in privacyService.ts are enforced in JavaScript
--      after rows arrive, so they are advisory only. Moving those checks into
--      `public_profiles` (or a SECURITY DEFINER RPC that consults
--      can_view_profile_section) is what makes them real.
-- ============================================================

-- ============================================================
-- ROLLBACK
-- ============================================================
-- DROP VIEW IF EXISTS public.public_profiles;
-- DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;
-- CREATE POLICY "Public profiles are viewable by everyone"
--   ON public.profiles FOR SELECT USING (true);
-- GRANT SELECT ON public.profiles TO anon;
-- DROP FUNCTION IF EXISTS public.username_available(text);
