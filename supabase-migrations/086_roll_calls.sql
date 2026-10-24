-- ============================================================
-- 086: Roll Call — "are you IN or are you OUT" in pod chat.
--
-- A roll call is posted into a pod chat and points at one of two things:
--
--   1. an upcoming meeting that already exists on the calendar
--   2. a proposed date that is NOT on the calendar yet
--
-- THE IMPORTANT DESIGN DECISION — WHERE THE ANSWER LIVES
--
-- Case 1 already has an RSVP mechanism. `meeting_participants.status` is
-- ('invited','accepted','declined','maybe') and it is what MeetingDetailScreen,
-- the calendar, and the reminder scheduler all read. If a roll call stored its
-- own IN/OUT for an existing meeting, the app would have two different answers
-- to "is Maya coming on Thursday" and no way to decide which is right.
--
-- So meeting-backed roll calls DO NOT store responses here at all. Tapping IN
-- writes meeting_participants.status = 'accepted'; OUT writes 'declined'. The
-- roll call is a *view* into data that already exists, and answering in chat
-- correctly updates that person's calendar. One source of truth.
--
-- Case 2 has no meeting, so there is nowhere for the answer to go — that is
-- what `roll_call_responses` below is for, and the only thing it is for. Once
-- enough people are IN, the roll call can be promoted into a real meeting
-- (status 'promoted'), after which the meeting's own participants take over.
--
-- The service layer normalises both into one shape so the UI never branches.
--
-- NOTE ON notifications.type: migration 052 dropped
-- `notifications_type_check` entirely, so the new 'roll_call' type needs no
-- constraint change. Verified, not assumed.
-- ============================================================

-- ------------------------------------------------------------
-- 1. roll_calls
--
-- created_by references public.profiles(id), NOT auth.users. PostgREST cannot
-- embed across into the auth schema, so an auth.users FK would make
-- `creator:profiles!roll_calls_created_by_fkey(...)` fail with PGRST200 — the
-- same trap that `meetings.creator_id` and `pursuits.creator_id` are already
-- stuck in.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.roll_calls (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pursuit_id    uuid NOT NULL REFERENCES public.pursuits(id) ON DELETE CASCADE,
  created_by    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- exactly one of these identifies what is being called
  meeting_id    uuid REFERENCES public.meetings(id) ON DELETE CASCADE,
  proposed_time timestamptz,

  -- free text shown on the card: "post-work run?", "moving it to Saturday?"
  note          text,

  status        text NOT NULL DEFAULT 'open'
                  CHECK (status IN ('open', 'closed', 'promoted')),

  -- set when a proposed-date roll call becomes a real meeting
  promoted_meeting_id uuid REFERENCES public.meetings(id) ON DELETE SET NULL,

  created_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT roll_call_has_one_target CHECK (
    (meeting_id IS NOT NULL AND proposed_time IS NULL) OR
    (meeting_id IS NULL     AND proposed_time IS NOT NULL)
  ),

  -- only a proposed-date roll call can be promoted; a meeting-backed one
  -- already has its meeting
  CONSTRAINT roll_call_promotion_valid CHECK (
    promoted_meeting_id IS NULL OR meeting_id IS NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_roll_calls_pursuit ON public.roll_calls(pursuit_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_roll_calls_meeting ON public.roll_calls(meeting_id) WHERE meeting_id IS NOT NULL;

-- ------------------------------------------------------------
-- 2. roll_call_responses — proposed-date roll calls ONLY.
--
-- Deliberately has no 'maybe'. The feature exists to force a commitment;
-- meeting_participants keeps 'maybe' for the calendar's own RSVP, where a
-- soft answer is still useful.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.roll_call_responses (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  roll_call_id uuid NOT NULL REFERENCES public.roll_calls(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  response     text NOT NULL CHECK (response IN ('in', 'out')),
  responded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (roll_call_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_roll_call_responses_call ON public.roll_call_responses(roll_call_id);

-- ------------------------------------------------------------
-- 3. Carry roll calls in the chat stream.
--
-- Rather than a second query merged by timestamp on the client, a roll call
-- posts a pod_chat_messages row with kind='roll_call'. Ordering, the 3-second
-- poll in PodChatScreen, and unread counts then all work unchanged.
--
-- `content` stays NOT NULL on that table, so the service writes a plain-text
-- fallback into it. That text is what older app builds and push previews show.
-- ------------------------------------------------------------
ALTER TABLE public.pod_chat_messages
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS roll_call_id uuid REFERENCES public.roll_calls(id) ON DELETE CASCADE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pod_chat_messages_kind_check'
  ) THEN
    ALTER TABLE public.pod_chat_messages
      ADD CONSTRAINT pod_chat_messages_kind_check CHECK (kind IN ('text', 'roll_call'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pod_chat_messages_roll_call_shape'
  ) THEN
    ALTER TABLE public.pod_chat_messages
      ADD CONSTRAINT pod_chat_messages_roll_call_shape CHECK (
        (kind = 'roll_call' AND roll_call_id IS NOT NULL) OR
        (kind = 'text'      AND roll_call_id IS NULL)
      );
  END IF;
END $$;

-- ------------------------------------------------------------
-- 4. RLS — pod members only, both tables.
--
-- Delegates to the existing is_pod_member SECURITY DEFINER helper, which
-- bypasses RLS internally and therefore cannot recurse. Same approach as 078,
-- which is already applied and working on the meetings tables.
--
-- is_pod_member self-guards (returns FALSE unless p_user_id = auth.uid()), so
-- every call below must pass auth.uid() and not a column.
-- ------------------------------------------------------------
ALTER TABLE public.roll_calls          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roll_call_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Pod members can view roll calls"    ON public.roll_calls;
DROP POLICY IF EXISTS "Pod members can create roll calls"  ON public.roll_calls;
DROP POLICY IF EXISTS "Author or pod creator can update"   ON public.roll_calls;

CREATE POLICY "Pod members can view roll calls"
  ON public.roll_calls FOR SELECT
  TO authenticated
  USING (public.is_pod_member(pursuit_id, (select auth.uid())));

-- Any member can call a roll call. It is a chat affordance, not an
-- administrative one — gating it to the leader would defeat the point of
-- someone floating "anyone free Saturday?".
CREATE POLICY "Pod members can create roll calls"
  ON public.roll_calls FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = (select auth.uid())
    AND public.is_pod_member(pursuit_id, (select auth.uid()))
  );

-- Closing or promoting is restricted to whoever called it, plus the pod
-- creator as a backstop for an absent author.
CREATE POLICY "Author or pod creator can update"
  ON public.roll_calls FOR UPDATE
  TO authenticated
  USING (
    created_by = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.pursuits p
       WHERE p.id = roll_calls.pursuit_id
         AND p.creator_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Pod members can view responses"  ON public.roll_call_responses;
DROP POLICY IF EXISTS "Members answer for themselves"   ON public.roll_call_responses;
DROP POLICY IF EXISTS "Members change their own answer" ON public.roll_call_responses;

-- Responses are visible to the whole pod — seeing who is in is the feature.
CREATE POLICY "Pod members can view responses"
  ON public.roll_call_responses FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.roll_calls rc
     WHERE rc.id = roll_call_responses.roll_call_id
       AND public.is_pod_member(rc.pursuit_id, (select auth.uid()))
  ));

CREATE POLICY "Members answer for themselves"
  ON public.roll_call_responses FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.roll_calls rc
       WHERE rc.id = roll_call_responses.roll_call_id
         AND rc.status = 'open'
         AND public.is_pod_member(rc.pursuit_id, (select auth.uid()))
    )
  );

-- Changing your mind is allowed while the roll call is open.
CREATE POLICY "Members change their own answer"
  ON public.roll_call_responses FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (
    user_id = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.roll_calls rc
       WHERE rc.id = roll_call_responses.roll_call_id
         AND rc.status = 'open'
    )
  );

COMMENT ON TABLE public.roll_calls IS
  'A chat prompt asking the pod who is coming. Points at an existing meeting '
  '(answers live in meeting_participants) or a proposed date (answers live in '
  'roll_call_responses). See 086.';

COMMENT ON TABLE public.roll_call_responses IS
  'IN/OUT answers for PROPOSED-DATE roll calls only. Meeting-backed roll calls '
  'write meeting_participants.status instead, so there is one source of truth '
  'for whether someone is attending. See 086.';

-- ============================================================
-- VERIFY
-- ============================================================
-- -- (a) tables exist with RLS on:
-- SELECT relname, relrowsecurity FROM pg_class
--  WHERE relname IN ('roll_calls','roll_call_responses');
-- -- expect: both true
--
-- -- (b) the new chat columns landed:
-- SELECT column_name, data_type, column_default FROM information_schema.columns
--  WHERE table_name = 'pod_chat_messages' AND column_name IN ('kind','roll_call_id');
-- -- expect: 2 rows, kind default 'text'
--
-- -- (c) the one-target constraint actually bites — both of these must FAIL:
-- -- INSERT INTO roll_calls (pursuit_id, created_by) VALUES (<pod>, auth.uid());
-- -- INSERT INTO roll_calls (pursuit_id, created_by, meeting_id, proposed_time)
-- --   VALUES (<pod>, auth.uid(), <meeting>, now());
--
-- -- (d) existing messages were not disturbed:
-- SELECT kind, count(*) FROM pod_chat_messages GROUP BY kind;
-- -- expect: every pre-existing row is 'text'
--
-- -- (e) a non-member cannot see a pod's roll calls. From a second account:
-- -- SELECT count(*) FROM roll_calls WHERE pursuit_id = '<a pod you are not in>';
-- -- expect: 0

-- ============================================================
-- ROLLBACK
-- ============================================================
-- ALTER TABLE public.pod_chat_messages DROP CONSTRAINT IF EXISTS pod_chat_messages_roll_call_shape;
-- ALTER TABLE public.pod_chat_messages DROP CONSTRAINT IF EXISTS pod_chat_messages_kind_check;
-- DELETE FROM public.pod_chat_messages WHERE kind = 'roll_call';
-- ALTER TABLE public.pod_chat_messages DROP COLUMN IF EXISTS roll_call_id;
-- ALTER TABLE public.pod_chat_messages DROP COLUMN IF EXISTS kind;
-- DROP TABLE IF EXISTS public.roll_call_responses;
-- DROP TABLE IF EXISTS public.roll_calls;
-- -- NOTE: meeting_participants rows written by meeting-backed roll calls are
-- -- real RSVPs and are intentionally NOT reverted — they are indistinguishable
-- -- from an RSVP made on the meeting screen, which is the whole point.
