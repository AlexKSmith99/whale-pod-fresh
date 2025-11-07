-- Add new notification types to the notifications table
-- Run this in your Supabase SQL Editor

-- First, drop the existing CHECK constraint if it exists
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

-- Add the new CHECK constraint with all notification types
ALTER TABLE notifications
ADD CONSTRAINT notifications_type_check
CHECK (type IN (
  'pod_ready_for_kickoff',
  'new_message',
  'connection_request',
  'connection_accepted',
  'pod_available',
  'kickoff_scheduled',
  'time_slot_request',
  'application_received',
  'application_accepted',
  'application_rejected'
));

-- Verify the constraint was added
SELECT constraint_name, check_clause
FROM information_schema.check_constraints
WHERE constraint_name = 'notifications_type_check';
