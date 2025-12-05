-- Fix notifications type check constraint to allow all notification types used in the app

-- Step 1: Drop the existing check constraint if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'notifications_type_check'
    AND conrelid = 'notifications'::regclass
  ) THEN
    ALTER TABLE notifications DROP CONSTRAINT notifications_type_check;
    RAISE NOTICE 'Dropped existing notifications_type_check constraint';
  END IF;
END $$;

-- Step 2: Clean up any existing rows with invalid types
-- Update any rows with types not in our allowed list to 'general'
UPDATE notifications
SET type = 'general'
WHERE type IS NULL
   OR type NOT IN (
    -- Application-related
    'application_received',
    'application_accepted',
    'application_rejected',

    -- Pursuit/Pod lifecycle
    'pursuit_created',
    'min_team_size_reached',
    'kickoff_activated',
    'all_proposals_submitted',
    'time_proposal',
    'team_board_update',

    -- Meeting/Calendar
    'kickoff_scheduled',
    'kickoff_scheduled_team',
    'kickoff_scheduled_creator',
    'meeting',
    'new_meeting',

    -- Messaging & Connections
    'message',
    'new_message',
    'connection_request',
    'connection_accepted',

    -- General
    'general'
  );

-- Step 3: Add a new check constraint with all the notification types used in the app
ALTER TABLE notifications
ADD CONSTRAINT notifications_type_check CHECK (
  type IN (
    -- Application-related
    'application_received',
    'application_accepted',
    'application_rejected',

    -- Pursuit/Pod lifecycle
    'pursuit_created',
    'min_team_size_reached',
    'kickoff_activated',
    'all_proposals_submitted',
    'time_proposal',
    'team_board_update',

    -- Meeting/Calendar
    'kickoff_scheduled',
    'kickoff_scheduled_team',
    'kickoff_scheduled_creator',
    'meeting',
    'new_meeting',

    -- Messaging & Connections
    'message',
    'new_message',
    'connection_request',
    'connection_accepted',

    -- General
    'general'
  )
);

-- Verify the constraint was created
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  -- Get count of rows that were updated
  SELECT COUNT(*) INTO updated_count
  FROM notifications
  WHERE type = 'general';

  RAISE NOTICE 'Updated % rows to use "general" type', updated_count;

  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'notifications_type_check'
    AND conrelid = 'notifications'::regclass
  ) THEN
    RAISE NOTICE '✅ Successfully created notifications_type_check constraint with all notification types';
  ELSE
    RAISE WARNING '⚠️ Failed to create notifications_type_check constraint';
  END IF;
END $$;
