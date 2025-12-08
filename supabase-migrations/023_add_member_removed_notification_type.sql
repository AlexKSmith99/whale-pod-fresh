-- Add member_removed notification type for team member removal feature

-- Step 1: Drop the existing check constraint
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

-- Step 2: Add a new check constraint with member_removed included
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

    -- Team member management
    'member_removed',

    -- General
    'general'
  )
);

-- Verify the constraint was created
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'notifications_type_check'
    AND conrelid = 'notifications'::regclass
  ) THEN
    RAISE NOTICE '✅ Successfully updated notifications_type_check constraint with member_removed type';
  ELSE
    RAISE WARNING '⚠️ Failed to create notifications_type_check constraint';
  END IF;
END $$;
