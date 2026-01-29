-- Migration: 037_fix_pod_chat_read_status.sql
-- Description: Fix pod_chat_read_status RLS policy

DROP POLICY IF EXISTS "Users can manage their own read status" ON pod_chat_read_status;

CREATE POLICY "Users can manage their own read status"
  ON pod_chat_read_status FOR ALL
  TO authenticated
  USING (user_id = auth.uid());
