-- Recurring meetings feature
-- Adds a meeting_series abstraction plus per-instance linkage on meetings.
-- Individual instances that are edited away from the series template set
-- is_series_exception = true so series-wide updates skip them.

-- 1. meeting_series table
CREATE TABLE IF NOT EXISTS meeting_series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pursuit_id UUID NOT NULL REFERENCES pursuits(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cadence TEXT NOT NULL CHECK (cadence IN ('weekly', 'biweekly', 'monthly')),
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date DATE,
  duration_minutes INTEGER DEFAULT 60,
  timezone TEXT DEFAULT 'America/New_York',
  title TEXT NOT NULL,
  description TEXT,
  meeting_type TEXT NOT NULL CHECK (meeting_type IN ('in_person', 'video', 'hybrid')),
  location TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meeting_series_pursuit ON meeting_series(pursuit_id);

-- 2. Link meetings → series
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS series_id UUID REFERENCES meeting_series(id) ON DELETE SET NULL;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS is_series_exception BOOLEAN DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_meetings_series ON meetings(series_id);

-- 3. Permission helper: creator of the pod OR a member with role_title ILIKE 'scheduler'
CREATE OR REPLACE FUNCTION is_pod_scheduler(p_pursuit_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM pursuits p
    WHERE p.id = p_pursuit_id AND p.creator_id = p_user_id
  ) OR EXISTS (
    SELECT 1 FROM member_roles mr
    WHERE mr.pursuit_id = p_pursuit_id
      AND mr.user_id = p_user_id
      AND mr.role_title ILIKE 'scheduler'
  );
$$;

GRANT EXECUTE ON FUNCTION is_pod_scheduler(UUID, UUID) TO authenticated;

-- 4. RLS on meeting_series
ALTER TABLE meeting_series ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pod members can view series"
  ON meeting_series FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM pursuits p
      WHERE p.id = meeting_series.pursuit_id
      AND (
        p.creator_id = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1 FROM team_members tm
          WHERE tm.pursuit_id = p.id
            AND tm.user_id = (SELECT auth.uid())
            AND tm.status IN ('active', 'accepted')
        )
      )
    )
  );

CREATE POLICY "Schedulers can create series"
  ON meeting_series FOR INSERT
  WITH CHECK (is_pod_scheduler(pursuit_id, (SELECT auth.uid())));

CREATE POLICY "Schedulers can update series"
  ON meeting_series FOR UPDATE
  USING (is_pod_scheduler(pursuit_id, (SELECT auth.uid())))
  WITH CHECK (is_pod_scheduler(pursuit_id, (SELECT auth.uid())));

CREATE POLICY "Schedulers can delete series"
  ON meeting_series FOR DELETE
  USING (is_pod_scheduler(pursuit_id, (SELECT auth.uid())));

-- 5. Trigger to keep updated_at fresh
CREATE OR REPLACE FUNCTION update_meeting_series_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS meeting_series_updated_at ON meeting_series;
CREATE TRIGGER meeting_series_updated_at
  BEFORE UPDATE ON meeting_series
  FOR EACH ROW
  EXECUTE FUNCTION update_meeting_series_updated_at();

GRANT ALL ON meeting_series TO authenticated;
