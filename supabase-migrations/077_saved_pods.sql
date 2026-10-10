-- Migration: 077_saved_pods.sql
-- Description: Lets a user bookmark ("save") a pod. Saved pods surface in the
-- Saved Pods section of Profile -> Pods.
--
-- Unlike message_likes (048), saves are PRIVATE: there is no public-read
-- policy. Only the owner of a row may read, create, or delete it.

CREATE TABLE IF NOT EXISTS saved_pods (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  pursuit_id uuid NOT NULL REFERENCES pursuits(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(pursuit_id, user_id)
);

-- user_id index drives "my saved pods"; pursuit_id index keeps the
-- ON DELETE CASCADE from a pursuit delete cheap.
CREATE INDEX IF NOT EXISTS idx_saved_pods_user ON saved_pods(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_pods_pursuit ON saved_pods(pursuit_id);

ALTER TABLE saved_pods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own saved pods" ON saved_pods;
DROP POLICY IF EXISTS "Users can save pods" ON saved_pods;
DROP POLICY IF EXISTS "Users can unsave pods" ON saved_pods;

-- (select auth.uid()) rather than auth.uid() — see 043_optimize_rls_auth_calls.
CREATE POLICY "Users can view their own saved pods"
  ON saved_pods FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can save pods"
  ON saved_pods FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can unsave pods"
  ON saved_pods FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);
