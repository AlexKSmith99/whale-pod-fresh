-- Add missing columns to notifications and pursuits tables

-- 1. Add 'data' column to notifications table (for storing extra notification data)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notifications' AND column_name = 'data'
  ) THEN
    ALTER TABLE notifications ADD COLUMN data JSONB;
    RAISE NOTICE 'Added notifications.data column';
  ELSE
    RAISE NOTICE 'notifications.data column already exists';
  END IF;
END $$;

-- 2. Add 'action_url' column to notifications table (referenced in RPC function)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notifications' AND column_name = 'action_url'
  ) THEN
    ALTER TABLE notifications ADD COLUMN action_url TEXT;
    RAISE NOTICE 'Added notifications.action_url column';
  ELSE
    RAISE NOTICE 'notifications.action_url column already exists';
  END IF;
END $$;

-- 3. Add min_team_size to pursuits table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pursuits' AND column_name = 'min_team_size'
  ) THEN
    ALTER TABLE pursuits ADD COLUMN min_team_size INTEGER DEFAULT 2;
    RAISE NOTICE 'Added pursuits.min_team_size column';
  ELSE
    RAISE NOTICE 'pursuits.min_team_size column already exists';
  END IF;
END $$;

-- 4. Add max_team_size to pursuits table (likely also needed)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pursuits' AND column_name = 'max_team_size'
  ) THEN
    ALTER TABLE pursuits ADD COLUMN max_team_size INTEGER;
    RAISE NOTICE 'Added pursuits.max_team_size column';
  ELSE
    RAISE NOTICE 'pursuits.max_team_size column already exists';
  END IF;
END $$;

-- 5. Add current_members_count to pursuits table (tracks team size)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pursuits' AND column_name = 'current_members_count'
  ) THEN
    ALTER TABLE pursuits ADD COLUMN current_members_count INTEGER DEFAULT 1;
    RAISE NOTICE 'Added pursuits.current_members_count column';
  ELSE
    RAISE NOTICE 'pursuits.current_members_count column already exists';
  END IF;
END $$;

-- Verify the changes
DO $$
DECLARE
  notif_columns INTEGER;
  pursuit_columns INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO notif_columns
  FROM information_schema.columns
  WHERE table_name = 'notifications'
    AND column_name IN ('data', 'action_url', 'body', 'type', 'related_id', 'related_type');

  SELECT COUNT(*)
  INTO pursuit_columns
  FROM information_schema.columns
  WHERE table_name = 'pursuits'
    AND column_name IN ('min_team_size', 'max_team_size', 'current_members_count');

  RAISE NOTICE 'Notifications table has %/6 required columns', notif_columns;
  RAISE NOTICE 'Pursuits table has %/3 team size columns', pursuit_columns;

  IF notif_columns = 6 AND pursuit_columns = 3 THEN
    RAISE NOTICE '✅ All required columns are present!';
  ELSE
    RAISE WARNING '⚠️ Some columns may be missing. Check above notices.';
  END IF;
END $$;
