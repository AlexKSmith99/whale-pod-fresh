-- Fix team_members status: add 'accepted' as valid status

-- Drop the existing constraint
ALTER TABLE team_members DROP CONSTRAINT IF EXISTS team_members_status_check;

-- Add constraint that includes both 'active' and 'accepted'
ALTER TABLE team_members
ADD CONSTRAINT team_members_status_check
CHECK (status IN ('active', 'accepted', 'invited', 'removed'));
