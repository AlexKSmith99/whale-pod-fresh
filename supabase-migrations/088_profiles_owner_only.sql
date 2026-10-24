-- ============================================================
-- 088: close C-1 — make `profiles` owner-only.
--
-- The last step of the finding 079 and 084 were working through.
--
--   079  closed anonymous access (policy scoped TO authenticated, SELECT
--        revoked from anon) and added the `public_profiles` projection.
--   084  added get_viewable_profile(), so cross-user profile reads go through
--        a SECURITY DEFINER RPC that applies the viewer's entitlements, and
--        removed `email` from ~35 other-user reads.
--
-- What remained: the SELECT policy is still `USING (true)` for any
-- authenticated user, so the *table* is still readable row-by-row even though
-- nothing in the app does that any more. This closes it.
--
-- ⚠️ THIS IS THE STEP THAT BREAKS ANYTHING STILL MISSED.
--
-- It was deliberately held back from 079/084 because the failure mode is a
-- blank or broken screen at runtime, not a type error at build time — tsc
-- cannot tell you that a screen reads someone else's profile row. Before
-- applying, exercise the app: open another user's profile from the feed and
-- from the Pods tab, open a pod chat, a DM, the team board, the members list,
-- a meeting, and the alerts tab.
--
-- A rollback block is at the bottom. If something does break, reverting is a
-- single statement and costs nothing but the open finding.
-- ============================================================

-- ------------------------------------------------------------
-- The new policy: you can read your own row, nothing else.
--
-- `(select auth.uid())` rather than bare `auth.uid()` per 043 — the subquery
-- form is evaluated once per statement instead of once per row.
--
-- Cross-user reads keep working through:
--   • public.get_viewable_profile(uuid)  — the rich, entitlement-aware path
--   • public.public_profiles             — the flat safe projection
--   • public.username_available(text)    — signup, runs as anon
--   • the SECURITY DEFINER helpers (is_pod_member, get_user_badges, …)
-- all of which bypass RLS internally, which is the whole reason they exist.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = (select auth.uid()));

-- `public_profiles` is declared WITH (security_invoker = on), which means it
-- runs under the *querying* user's RLS — so the policy above would now make
-- the view return nothing but your own row, defeating it entirely.
--
-- Flipping it to security_invoker = off makes it run as the view owner, which
-- is the correct reading of what the view is for: a curated projection that is
-- safe precisely because of its column list, not because of row filtering.
-- Its 17 columns were verified against the live schema in 079 and exclude
-- email, phone, DOB and all account state.
ALTER VIEW public.public_profiles SET (security_invoker = off);

COMMENT ON VIEW public.public_profiles IS
  'Safe cross-user projection of profiles: 17 curated columns, no email, no '
  'phone, no DOB, no account state. Runs as owner (security_invoker = off) '
  'because the base table became owner-only in 088.';

-- ============================================================
-- VERIFY — run every one of these, in this order
-- ============================================================
-- -- (a) exactly one SELECT policy, scoped to the owner:
-- SELECT policyname, roles, qual FROM pg_policies
--  WHERE schemaname = 'public' AND tablename = 'profiles' AND cmd = 'SELECT';
-- -- expect: 1 row, {authenticated}, qual mentioning auth.uid()
--
-- -- (b) you can still read yourself:
-- SELECT count(*) AS own_row FROM public.profiles WHERE id = (select auth.uid());
-- -- expect: 1
--
-- -- (c) the table no longer leaks anyone else:
-- SELECT count(*) AS other_rows FROM public.profiles WHERE id <> (select auth.uid());
-- -- expect: 0
--
-- -- (d) the sanctioned paths still work — THIS IS THE IMPORTANT CHECK.
-- --     If (d) fails, the app is broken and you should roll back:
-- SELECT public.get_viewable_profile('<some other user id>') IS NOT NULL AS rpc_ok;
-- SELECT count(*) > 0 AS view_ok FROM public.public_profiles;
-- SELECT public.username_available('definitely_not_taken_12345') AS signup_ok;
-- -- expect: true, true, true
--
-- -- (e) badges still resolve (they read profiles internally as a definer):
-- SELECT public.get_user_badges('<some other user id>') IS NOT NULL AS badges_ok;
-- -- expect: true

-- ============================================================
-- ROLLBACK — one statement, no data loss
-- ============================================================
-- DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
-- CREATE POLICY "Authenticated users can view profiles"
--   ON public.profiles FOR SELECT TO authenticated USING (true);
-- ALTER VIEW public.public_profiles SET (security_invoker = on);
-- -- This restores the state after 079: anon still has no access, but any
-- -- signed-in user can read any profile row again. C-1 reopens.
