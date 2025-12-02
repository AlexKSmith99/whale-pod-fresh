-- Enhance notifications table with type and reference fields
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS related_id UUID,
  ADD COLUMN IF NOT EXISTS related_type TEXT,
  ADD COLUMN IF NOT EXISTS action_url TEXT;

-- Add index for notification type
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read);

-- Comment on columns for clarity
COMMENT ON COLUMN notifications.type IS 'Type of notification: message, connection_request, application, application_accepted, application_rejected, kickoff_activated, time_proposal, meeting_scheduled, team_board_update, minimum_members_reached';
COMMENT ON COLUMN notifications.related_id IS 'ID of the related entity (pursuit_id, message_id, application_id, etc.)';
COMMENT ON COLUMN notifications.related_type IS 'Type of related entity: pursuit, message, application, meeting, etc.';
COMMENT ON COLUMN notifications.action_url IS 'Deep link or action to perform when notification is tapped';
