-- Drop the restrictive type check constraint entirely.
-- New notification types can be added freely without migrations.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'notifications_type_check'
  ) THEN
    ALTER TABLE notifications DROP CONSTRAINT notifications_type_check;
    RAISE NOTICE 'Dropped notifications_type_check constraint';
  ELSE
    RAISE NOTICE 'No notifications_type_check constraint found — nothing to drop';
  END IF;
END $$;
