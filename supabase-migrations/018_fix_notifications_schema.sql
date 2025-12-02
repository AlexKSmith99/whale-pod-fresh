-- Fix notifications table schema - ensure it has 'body' column instead of 'message'
-- This handles cases where the table was created manually or has an older schema

DO $$
BEGIN
  -- Check if 'body' column exists
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'notifications' AND column_name = 'body'
  ) THEN
    -- Check if 'message' column exists
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = 'notifications' AND column_name = 'message'
    ) THEN
      -- Rename 'message' to 'body'
      ALTER TABLE notifications RENAME COLUMN message TO body;
      RAISE NOTICE 'Renamed notifications.message to notifications.body';
    ELSE
      -- Neither exists, add 'body' column
      ALTER TABLE notifications ADD COLUMN body TEXT NOT NULL DEFAULT '';
      RAISE NOTICE 'Added notifications.body column';
    END IF;
  ELSE
    RAISE NOTICE 'notifications.body column already exists';
  END IF;

  -- Ensure all required columns exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='notifications' AND column_name='type'
  ) THEN
    ALTER TABLE notifications ADD COLUMN type TEXT NOT NULL DEFAULT 'general';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='notifications' AND column_name='related_id'
  ) THEN
    ALTER TABLE notifications ADD COLUMN related_id UUID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='notifications' AND column_name='related_type'
  ) THEN
    ALTER TABLE notifications ADD COLUMN related_type TEXT;
  END IF;
END $$;
