# Fix: team_members table missing status column

## Problem
The team_members table exists but doesn't have a `status` column.

## Solution

Run these SQL commands in Supabase:

### Option 1: Add the status column (Recommended)
```sql
-- Add the status column
ALTER TABLE team_members
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'accepted';

-- Add the constraint
ALTER TABLE team_members
ADD CONSTRAINT team_members_status_check
CHECK (status IN ('pending', 'accepted', 'rejected'));

-- Create index
CREATE INDEX IF NOT EXISTS idx_team_members_status ON team_members(status);
```

### Option 2: Drop and recreate (if Option 1 fails)
```sql
-- Drop the existing table
DROP TABLE IF EXISTS team_members CASCADE;

-- Recreate with all columns
CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pursuit_id UUID NOT NULL REFERENCES pursuits(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'accepted' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(pursuit_id, user_id)
);

-- Add indexes
CREATE INDEX idx_team_members_pursuit ON team_members(pursuit_id);
CREATE INDEX idx_team_members_user ON team_members(user_id);
CREATE INDEX idx_team_members_status ON team_members(status);
```

After running this, continue with the previous steps to add team members!
