-- ============================================================
-- 087: in-app account deletion.
--
-- WHY THIS IS REQUIRED
-- App Store Review Guideline 5.1.1(v): an app that lets you create an account
-- must let you delete it *in the app*. Pointing at a support email is called
-- out as insufficient. SettingsScreen currently opens a mailto, so the app is
-- not submittable as-is.
--
-- It is also a correctness problem independent of Apple:
-- src/constants/legalContent.ts already tells users "Profile → Settings →
-- Delete Account. Account deletion is immediate." The privacy policy has been
-- describing a feature that does not exist.
--
-- THE PROBLEM THIS FUNCTION EXISTS TO SOLVE
-- `pursuits.creator_id REFERENCES auth.users(id) ON DELETE CASCADE`.
--
-- So the naive implementation — delete the auth user and let the database
-- cascade — destroys every pod the person created, and with it the chat
-- history, meetings, team board and membership of everyone else in those
-- pods. Four people lose an active pod because a fifth closed their account.
-- No confirmation dialog makes that acceptable.
--
-- Instead: leadership is handed to the longest-standing active member, and
-- only pods where nobody else remains are deleted. Deletion therefore always
-- succeeds (Apple's requirement) without taking other people's work with it.
--
-- WHAT IS DELETED, and the UI copy must match this exactly:
--   • the profile and everything personal hanging off it
--   • their photos in profile-pictures/ and pod-covers/
--   • pods they created where they were the only member
--   • their messages, in DMs and pod chats
--   • their applications, reviews, saved pods, notifications
--
-- WHAT SURVIVES:
--   • pods they created that still have members — reassigned, not deleted
--   • content other people wrote
-- ============================================================

CREATE OR REPLACE FUNCTION public.delete_own_account()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, storage
AS $$
DECLARE
  v_uid           uuid := auth.uid();
  v_reassigned    int  := 0;
  v_pods_deleted  int  := 0;
  v_heir          uuid;
  rec             record;
BEGIN
  -- Only ever deletes the caller. There is deliberately no user_id parameter:
  -- an admin delete would be a different function with a different audit trail.
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'delete_own_account: not authenticated';
  END IF;

  -- 1. Hand over or retire the pods they lead, BEFORE touching auth.users,
  --    so the cascade never gets the chance to take them.
  FOR rec IN SELECT id FROM public.pursuits WHERE creator_id = v_uid LOOP
    SELECT tm.user_id
      INTO v_heir
      FROM public.team_members tm
     WHERE tm.pursuit_id = rec.id
       AND tm.user_id <> v_uid
       AND tm.status IN ('active', 'accepted')
     ORDER BY tm.created_at ASC   -- longest-standing member inherits
     LIMIT 1;

    IF v_heir IS NOT NULL THEN
      UPDATE public.pursuits SET creator_id = v_heir WHERE id = rec.id;
      v_reassigned := v_reassigned + 1;
    ELSE
      -- Nobody else is in it, so nothing of anyone else's is lost.
      DELETE FROM public.pursuits WHERE id = rec.id;
      v_pods_deleted := v_pods_deleted + 1;
    END IF;
  END LOOP;

  -- 2. Drop their membership rows. The cascade would do this, but doing it
  --    explicitly keeps step 1's heir lookup honest if this is ever re-run.
  DELETE FROM public.team_members WHERE user_id = v_uid;

  -- 3. Their uploaded files. Storage rows are not covered by any FK to
  --    auth.users, so without this the images stay in the bucket — and they
  --    are served from public URLs. Both uploaders write to a `<uid>/` prefix.
  DELETE FROM storage.objects
   WHERE bucket_id IN ('profile-pictures', 'pod-covers')
     AND name LIKE v_uid::text || '/%';

  -- 4. The account itself. Everything still keyed to this user — profile,
  --    messages, applications, notifications, saved pods, RSVPs — goes with it
  --    via the existing ON DELETE CASCADE constraints.
  DELETE FROM auth.users WHERE id = v_uid;

  RETURN jsonb_build_object(
    'deleted', true,
    'pods_reassigned', v_reassigned,
    'pods_deleted', v_pods_deleted
  );
END;
$$;

-- Hardened like 065/066. anon deliberately excluded: there is no account to
-- delete without a session, and the function would raise anyway.
REVOKE ALL ON FUNCTION public.delete_own_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_own_account() TO authenticated;

COMMENT ON FUNCTION public.delete_own_account() IS
  'Deletes the calling user''s account. Reassigns pods they lead to the '
  'longest-standing active member rather than cascading them away; deletes '
  'only pods with no remaining members. Required by App Store guideline '
  '5.1.1(v). See 087.';

-- ============================================================
-- VERIFY
-- ============================================================
-- -- (a) exists, is a definer, authenticated-only:
-- SELECT p.prosecdef, p.proconfig,
--        has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_can,
--        has_function_privilege('anon',          p.oid, 'EXECUTE') AS anon_can
--   FROM pg_proc p WHERE p.proname = 'delete_own_account';
-- -- expect: prosecdef true, auth_can true, anon_can false
--
-- -- (b) THE IMPORTANT ONE — handover works and nothing else is lost.
-- --     With a throwaway second account:
-- --       1. account B creates a pod, account C joins it
-- --       2. as B: SELECT public.delete_own_account();
-- --       3. the pod still exists and C is now creator_id:
-- --          SELECT id, creator_id FROM pursuits WHERE id = '<pod>';
-- --       4. C's chat history in that pod is intact
--
-- -- (c) a solo pod is removed rather than orphaned:
-- --     create a pod as a throwaway account with no other members, delete the
-- --     account, then confirm the pod is gone.
--
-- -- (d) nothing is left behind pointing at the deleted uid:
-- SELECT 'profiles' t, count(*) FROM profiles       WHERE id      = '<deleted-uid>'
-- UNION ALL SELECT 'team_members', count(*) FROM team_members WHERE user_id = '<deleted-uid>'
-- UNION ALL SELECT 'pursuits',     count(*) FROM pursuits     WHERE creator_id = '<deleted-uid>'
-- UNION ALL SELECT 'storage',      count(*) FROM storage.objects
--            WHERE name LIKE '<deleted-uid>/%';
-- -- expect: 0 everywhere

-- ============================================================
-- ROLLBACK
-- ============================================================
-- DROP FUNCTION IF EXISTS public.delete_own_account();
-- -- Note: deletions already performed are irreversible, which is the point.
-- -- Reverting also makes the app unsubmittable again — see the header.
