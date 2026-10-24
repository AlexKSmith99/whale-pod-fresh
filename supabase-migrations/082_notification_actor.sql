-- Migration: 082_notification_actor.sql
-- Records WHO triggered each notification, so the alerts tab can show their
-- profile picture.
--
-- BACKGROUND
-- notifications stores only user_id (the RECIPIENT). Of the 19 notification
-- types, just two carried the actor at all — connection_request kept
-- `requesterId` and connection_accepted kept `accepterId`, both buried in the
-- `data` JSON. Everything else carries the OBJECT (pursuitId, meetingId,
-- applicationId, conversationId) and the actor's NAME as free text, never their
-- id. So there was no way to look up a face for 17 of 19 types.
--
-- WHY profiles(id) AND NOT auth.users(id)
-- notifications.user_id references auth.users. PostgREST cannot traverse into
-- the auth schema, which is exactly why embedding a profile off
-- meetings.creator_id fails with PGRST200. Pointing actor_id at profiles(id)
-- instead lets the alerts screen fetch notifications and their actors in ONE
-- query:
--     .select('*, actor:profiles!notifications_actor_id_fkey(id, name, profile_picture)')
-- profiles.id is itself keyed to auth.users, so this is no weaker a reference.
--
-- ON DELETE SET NULL, not CASCADE: if someone deletes their account their
-- notifications to other people should survive and fall back to the typed
-- icon, not vanish from other users' inboxes.

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Supports the embed above.
CREATE INDEX IF NOT EXISTS idx_notifications_actor ON public.notifications(actor_id);

-- Existing rows keep actor_id NULL and render the typed icon they show today.
-- Deliberately no backfill: for pod notifications the only derivable candidate
-- is the pod's creator, who frequently is NOT who triggered the event, so a
-- backfill would attach confidently wrong faces to historical rows.

-- ============================================================
-- create_notifications must carry the new column.
-- It lists columns explicitly, so adding one to the table is not enough.
-- Body is otherwise unchanged from 020.
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_notifications(input_notifications jsonb)
RETURNS SETOF public.notifications
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
    data,
    actor_id
  )
  SELECT
    (notification ->> 'user_id')::uuid,
    COALESCE(notification ->> 'title', ''),
    COALESCE(notification ->> 'body', ''),
    COALESCE(notification ->> 'type', 'general'),
    NULLIF(notification ->> 'related_id', '')::uuid,
    NULLIF(notification ->> 'related_type', ''),
    NULLIF(notification ->> 'action_url', ''),
    notification -> 'data',
    -- NULLIF so an omitted or empty actor_id stays NULL rather than erroring.
    NULLIF(notification ->> 'actor_id', '')::uuid
  FROM jsonb_array_elements(input_notifications) AS notification
  RETURNING *;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_notifications(jsonb) TO authenticated;

-- ============================================================
-- VERIFY
-- ============================================================
-- select column_name from information_schema.columns
--  where table_name = 'notifications' and column_name = 'actor_id';   -- 1 row
--
-- -- the embed the alerts screen relies on must resolve:
-- select id, actor_id from notifications limit 1;
--
-- -- round-trip through the RPC:
-- select actor_id from create_notifications(
--   jsonb_build_array(jsonb_build_object(
--     'user_id', (select auth.uid())::text,
--     'title', 'test', 'body', 'test', 'type', 'general',
--     'actor_id', (select auth.uid())::text
--   ))
-- );   -- expect your uuid back, not null

-- ============================================================
-- ROLLBACK
-- ============================================================
-- Restore the 020 version of create_notifications (without actor_id), then:
-- DROP INDEX IF EXISTS idx_notifications_actor;
-- ALTER TABLE public.notifications DROP COLUMN IF EXISTS actor_id;
