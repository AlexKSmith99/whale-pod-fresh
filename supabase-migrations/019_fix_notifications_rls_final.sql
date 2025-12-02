-- Completely fix notifications RLS policies
-- The issue is that authenticated users need to be able to create notifications for OTHER users
-- This is required for the application flow (e.g., when user A applies to user B's pursuit)

-- First, disable RLS temporarily to clean up
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
DROP POLICY IF EXISTS "System can insert notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
DROP POLICY IF EXISTS "Allow all inserts" ON notifications;
DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON notifications;

-- Re-enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Create new policies with correct permissions

-- 1. SELECT: Users can only view their own notifications
CREATE POLICY "Users can view their own notifications"
  ON notifications
  FOR SELECT
  USING (auth.uid() = user_id);

-- 2. INSERT: Authenticated users can create notifications for ANY user
-- This is needed because when user A applies to user B's pursuit,
-- user A needs to create a notification for user B
CREATE POLICY "Authenticated users can insert notifications"
  ON notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 3. UPDATE: Users can only update their own notifications (e.g., marking as read)
CREATE POLICY "Users can update their own notifications"
  ON notifications
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4. DELETE: Users can only delete their own notifications
CREATE POLICY "Users can delete their own notifications"
  ON notifications
  FOR DELETE
  USING (auth.uid() = user_id);

-- Verify policies were created
DO $$
DECLARE
  policy_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO policy_count
  FROM pg_policies
  WHERE tablename = 'notifications';

  IF policy_count >= 4 THEN
    RAISE NOTICE 'Successfully created % RLS policies for notifications table', policy_count;
  ELSE
    RAISE WARNING 'Only % policies were created for notifications table', policy_count;
  END IF;
END $$;
