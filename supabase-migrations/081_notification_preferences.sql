-- Migration: 081_notification_preferences.sql
-- Per-user notification preferences, plus a SECURITY DEFINER accessor that
-- applies them at send time.
--
-- WHY THIS HAS TO BE SERVER-SIDE
-- Push is sent client-side FROM THE SENDER'S DEVICE: sendPushNotification reads
-- the recipient's rows from push_tokens and POSTs to exp.host. So the sender
-- decides whether a push goes out, which means the recipient's preference must
-- be readable at send time. The existing toggles in NotificationPrefsScreen
-- persist to the recipient's own AsyncStorage, which the sender can never see —
-- that is exactly why they have never had any effect.
--
-- Senders still must not be able to READ other people's preferences. So the
-- filtering happens inside get_pushable_tokens(), which runs as definer and
-- returns only the tokens the caller is permitted to push to.

-- ============================================================
-- 1. Preferences
-- ============================================================
CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,

  -- Master switch for everything delivered by iOS/Android as a system
  -- notification. Off = in-app inbox still fills, the phone just stays quiet.
  push_enabled            boolean NOT NULL DEFAULT true,

  -- Per-category push
  pod_alerts_push         boolean NOT NULL DEFAULT true,
  pod_chats_push          boolean NOT NULL DEFAULT true,
  direct_messages_push    boolean NOT NULL DEFAULT true,
  applications_push       boolean NOT NULL DEFAULT true,
  connections_push        boolean NOT NULL DEFAULT true,
  from_whale_pod_push     boolean NOT NULL DEFAULT true,

  -- Local scheduled meeting reminders (scheduled on-device, not pushed)
  meeting_reminder_1_day  boolean NOT NULL DEFAULT true,
  meeting_reminder_1_hour boolean NOT NULL DEFAULT true,

  updated_at timestamptz DEFAULT now()
);

-- Every default is true so existing users keep receiving exactly what they get
-- today. Nobody goes quiet because a migration ran.

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own notification preferences" ON notification_preferences;
DROP POLICY IF EXISTS "Users can create their own notification preferences" ON notification_preferences;
DROP POLICY IF EXISTS "Users can update their own notification preferences" ON notification_preferences;

-- (select auth.uid()) per 043_optimize_rls_auth_calls.
CREATE POLICY "Users can view their own notification preferences"
  ON notification_preferences FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can create their own notification preferences"
  ON notification_preferences FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update their own notification preferences"
  ON notification_preferences FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- No DELETE policy: rows are per-user config, removed only by the profile
-- cascade. There is nothing a user gains by deleting rather than toggling.

-- ============================================================
-- 2. get_pushable_tokens — the filtering accessor
--
-- Returns the Expo tokens for p_user_ids that are willing to receive a push in
-- p_category. A user with NO preferences row is treated as all-true, so this
-- keeps working for everyone who hasn't opened the settings screen yet.
--
-- Deliberately returns only user_id + token: the caller learns nothing about
-- anyone's preferences beyond "there is a token to push to".
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_pushable_tokens(
  p_user_ids uuid[],
  p_category text
)
RETURNS TABLE (user_id uuid, expo_push_token text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF p_user_ids IS NULL OR array_length(p_user_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  -- Unknown category => deliver. Better a notification the user didn't
  -- fine-tune than silence from a typo in a category name.
  IF p_category IS NULL OR p_category NOT IN (
    'pod_alerts', 'pod_chats', 'direct_messages',
    'applications', 'connections', 'from_whale_pod'
  ) THEN
    RETURN QUERY
      SELECT pt.user_id, pt.expo_push_token
      FROM public.push_tokens pt
      WHERE pt.user_id = ANY(p_user_ids);
    RETURN;
  END IF;

  RETURN QUERY
    SELECT pt.user_id, pt.expo_push_token
    FROM public.push_tokens pt
    LEFT JOIN public.notification_preferences np ON np.user_id = pt.user_id
    WHERE pt.user_id = ANY(p_user_ids)
      -- COALESCE(..., true): no preferences row means defaults, i.e. allow.
      AND COALESCE(np.push_enabled, true)
      AND CASE p_category
            WHEN 'pod_alerts'      THEN COALESCE(np.pod_alerts_push, true)
            WHEN 'pod_chats'       THEN COALESCE(np.pod_chats_push, true)
            WHEN 'direct_messages' THEN COALESCE(np.direct_messages_push, true)
            WHEN 'applications'    THEN COALESCE(np.applications_push, true)
            WHEN 'connections'     THEN COALESCE(np.connections_push, true)
            WHEN 'from_whale_pod'  THEN COALESCE(np.from_whale_pod_push, true)
            ELSE true
          END;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_pushable_tokens(uuid[], text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_pushable_tokens(uuid[], text) TO authenticated;

-- ============================================================
-- VERIFY
-- ============================================================
-- -- (a) your own row is readable, nobody else's is:
-- select * from notification_preferences;           -- only your row
--
-- -- (b) defaults apply before a row exists:
-- select * from get_pushable_tokens(array['<a user with a token>']::uuid[], 'connections');
--   -- expect the token back
--
-- -- (c) turning a category off suppresses it:
-- insert into notification_preferences (user_id, connections_push)
--   values ((select auth.uid()), false)
--   on conflict (user_id) do update set connections_push = false;
-- select * from get_pushable_tokens(array[(select auth.uid())]::uuid[], 'connections');
--   -- expect zero rows
-- select * from get_pushable_tokens(array[(select auth.uid())]::uuid[], 'pod_alerts');
--   -- expect the token back (other categories unaffected)

-- ============================================================
-- ROLLBACK
-- ============================================================
-- DROP FUNCTION IF EXISTS public.get_pushable_tokens(uuid[], text);
-- DROP TABLE IF EXISTS notification_preferences;
