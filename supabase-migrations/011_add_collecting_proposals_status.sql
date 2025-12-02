-- Add 'collecting_proposals' status to pursuits table for kickoff flow

-- Drop existing constraint
ALTER TABLE pursuits DROP CONSTRAINT IF EXISTS pursuits_status_check;

-- Add new constraint with additional status
ALTER TABLE pursuits
ADD CONSTRAINT pursuits_status_check
CHECK (status IN ('awaiting_kickoff', 'collecting_proposals', 'active', 'completed', 'archived'));

-- Add team_size_min if it doesn't exist
ALTER TABLE pursuits
ADD COLUMN IF NOT EXISTS team_size_min INTEGER DEFAULT 2;
