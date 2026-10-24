-- ============================================================
-- 085: backfill notifications.actor_id for connection notifications.
--
-- 082 added `actor_id` so the Alerts tab could show the face of whoever
-- triggered a notification. Rows written before 082 ran have actor_id NULL
-- and fall back to a type icon forever — the avatar only appears on new
-- activity, which reads as "the feature doesn't work".
--
-- For two notification types the actor is recoverable from data already in
-- the row. Verified against src/services/notificationService.ts:
--
--   notifyConnectionRequest  → related_id = requesterId, actorId = requesterId
--   notifyConnectionAccepted → related_id = accepterId,  actorId = accepterId
--
-- In both, related_id and actor_id are the SAME value, so copying one to the
-- other is exact rather than a guess.
--
-- These are the only two types that pass related_type = 'user'. Every other
-- type stores a pursuit id in related_id, so their actor genuinely is not
-- present in the row and cannot be recovered — those stay on the icon until
-- new activity replaces them. That is the intended end state, not a gap.
-- ============================================================

-- ------------------------------------------------------------
-- Why the predicate is shaped this way
--
--   type IN (...)          Deliberately narrower than
--                          `related_type = 'user'`. Today the two are
--                          equivalent, but if a future notification type
--                          starts using related_type = 'user' for something
--                          that is NOT the actor, an explicit type list means
--                          re-running this file cannot put a wrong face on it.
--
--   actor_id IS NULL       Idempotent. Never overwrites an actor that a newer
--                          notification already set correctly.
--
--   EXISTS (profiles ...)  LOAD-BEARING, not defensive. actor_id is
--                          `REFERENCES public.profiles(id)`, so if any
--                          related_id points at a since-deleted profile the
--                          FK would reject the row and abort the ENTIRE
--                          update. The guard skips those instead.
--
--   related_id <> user_id  Nobody should be notified about their own action.
--                          If such a row exists it is a bug upstream, and
--                          showing the recipient their own face would make it
--                          look intentional.
-- ------------------------------------------------------------

WITH backfilled AS (
  UPDATE public.notifications n
     SET actor_id = n.related_id
   WHERE n.actor_id IS NULL
     AND n.related_id IS NOT NULL
     AND n.type IN ('connection_request', 'connection_accepted')
     AND n.related_id <> n.user_id
     AND EXISTS (
       SELECT 1 FROM public.profiles p WHERE p.id = n.related_id
     )
  RETURNING n.id, n.type
)
SELECT
  count(*)                                                   AS rows_backfilled,
  count(*) FILTER (WHERE type = 'connection_request')         AS connection_requests,
  count(*) FILTER (WHERE type = 'connection_accepted')        AS connections_accepted
FROM backfilled;

-- ============================================================
-- VERIFY (run after the statement above)
-- ============================================================
-- -- (a) No connection notification should still be missing an actor, unless
-- --     its profile was deleted or related_id was never set:
-- SELECT type, count(*) AS still_null
--   FROM public.notifications
--  WHERE actor_id IS NULL
--    AND type IN ('connection_request', 'connection_accepted')
--  GROUP BY type;
-- -- expect: 0 rows, or a small count explainable by deleted accounts
--
-- -- (b) Every actor now set must resolve to a real profile — this is what
-- --     the Alerts screen's `actor:profiles!notifications_actor_id_fkey`
-- --     embed depends on:
-- SELECT count(*) AS orphaned_actors
--   FROM public.notifications n
--   LEFT JOIN public.profiles p ON p.id = n.actor_id
--  WHERE n.actor_id IS NOT NULL AND p.id IS NULL;
-- -- expect: 0
--
-- -- (c) How many of your notifications will now show a face vs an icon.
-- --     Rows with an actor but no profile_picture render the initial-letter
-- --     circle, which is the intended fallback, not a failure:
-- SELECT
--   count(*) FILTER (WHERE n.actor_id IS NOT NULL AND p.profile_picture IS NOT NULL) AS shows_photo,
--   count(*) FILTER (WHERE n.actor_id IS NOT NULL AND p.profile_picture IS NULL)     AS shows_initial,
--   count(*) FILTER (WHERE n.actor_id IS NULL)                                       AS shows_icon
--   FROM public.notifications n
--   LEFT JOIN public.profiles p ON p.id = n.actor_id
--  WHERE n.user_id = (select auth.uid());

-- ============================================================
-- ROLLBACK
--
-- Cosmetic and non-destructive either way — clearing actor_id just returns
-- those notifications to the type icon.
--
-- The catch: this predicate cannot distinguish a row THIS migration set from
-- one a newer notification set legitimately, so it would clear both. If that
-- matters, scope it with the time you applied the migration:
--
--   UPDATE public.notifications
--      SET actor_id = NULL
--    WHERE type IN ('connection_request', 'connection_accepted')
--      AND actor_id = related_id
--      AND created_at < '<timestamp you ran 085>';
-- ============================================================
