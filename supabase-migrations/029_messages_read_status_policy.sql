-- Migration: 029_messages_read_status_policy.sql
-- Description: Adds RLS policy to allow message recipients to mark messages as read
-- Date: 2025-12-15

-- Enable RLS on messages table if not already enabled
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists (to avoid conflicts)
DROP POLICY IF EXISTS "Recipients can mark messages as read" ON messages;

-- Create policy to allow recipients to update the is_read field on messages sent to them
CREATE POLICY "Recipients can mark messages as read" ON messages
  FOR UPDATE
  USING (recipient_id = auth.uid())
  WITH CHECK (recipient_id = auth.uid());

-- Also ensure senders and recipients can view their messages
DROP POLICY IF EXISTS "Users can view their messages" ON messages;
CREATE POLICY "Users can view their messages" ON messages
  FOR SELECT
  USING (sender_id = auth.uid() OR recipient_id = auth.uid());

-- Ensure users can send messages
DROP POLICY IF EXISTS "Users can send messages" ON messages;
CREATE POLICY "Users can send messages" ON messages
  FOR INSERT
  WITH CHECK (sender_id = auth.uid());

-- Allow users to delete their own sent or received messages
DROP POLICY IF EXISTS "Users can delete their messages" ON messages;
CREATE POLICY "Users can delete their messages" ON messages
  FOR DELETE
  USING (sender_id = auth.uid() OR recipient_id = auth.uid());
