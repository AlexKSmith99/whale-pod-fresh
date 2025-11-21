-- Add missing fields to pursuits table for Feed screen filters

-- Rename name to title for consistency with code
ALTER TABLE pursuits RENAME COLUMN name TO title;

-- Add status field
ALTER TABLE pursuits
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'awaiting_kickoff'
CHECK (status IN ('awaiting_kickoff', 'active', 'completed', 'archived'));

-- Add pursuit type field
ALTER TABLE pursuits
ADD COLUMN IF NOT EXISTS pursuit_type TEXT;

-- Add pursuit types array (for multiple types)
ALTER TABLE pursuits
ADD COLUMN IF NOT EXISTS pursuit_types TEXT[];

-- Add category and subcategory
ALTER TABLE pursuits
ADD COLUMN IF NOT EXISTS category TEXT;

ALTER TABLE pursuits
ADD COLUMN IF NOT EXISTS subcategory TEXT;

-- Add location
ALTER TABLE pursuits
ADD COLUMN IF NOT EXISTS location TEXT;

-- Add team size fields
ALTER TABLE pursuits
ADD COLUMN IF NOT EXISTS team_size_max INTEGER DEFAULT 10;

ALTER TABLE pursuits
ADD COLUMN IF NOT EXISTS current_members_count INTEGER DEFAULT 1;

-- Add meeting cadence
ALTER TABLE pursuits
ADD COLUMN IF NOT EXISTS meeting_cadence TEXT;

-- Create indexes for filter performance
CREATE INDEX IF NOT EXISTS idx_pursuits_status ON pursuits(status);
CREATE INDEX IF NOT EXISTS idx_pursuits_pursuit_type ON pursuits(pursuit_type);
CREATE INDEX IF NOT EXISTS idx_pursuits_category ON pursuits(category);
CREATE INDEX IF NOT EXISTS idx_pursuits_location ON pursuits(location);
