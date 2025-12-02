-- Add missing foreign key constraint between kickoff_time_proposals and profiles
-- This is needed for the Supabase query to properly join the tables

-- First, drop the constraint if it exists to avoid errors
ALTER TABLE kickoff_time_proposals
DROP CONSTRAINT IF EXISTS kickoff_time_proposals_user_id_fkey;

-- Add the foreign key constraint
ALTER TABLE kickoff_time_proposals
ADD CONSTRAINT kickoff_time_proposals_user_id_fkey
FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- Enable realtime for notifications table by adding it to the supabase_realtime publication
-- This allows the real-time listener in App.tsx to receive INSERT events
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- Also enable realtime for push_tokens table in case we need it later
ALTER PUBLICATION supabase_realtime ADD TABLE push_tokens;

-- Verify everything was set up correctly
DO $$
BEGIN
  -- Check foreign key constraint
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'kickoff_time_proposals_user_id_fkey'
    AND table_name = 'kickoff_time_proposals'
  ) THEN
    RAISE NOTICE 'Foreign key constraint successfully created!';
  ELSE
    RAISE EXCEPTION 'Foreign key constraint was not created!';
  END IF;

  -- Check realtime publication
  IF EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND tablename = 'notifications'
  ) THEN
    RAISE NOTICE 'Notifications table added to realtime publication!';
  ELSE
    RAISE WARNING 'Notifications table may not have been added to realtime publication';
  END IF;
END $$;
