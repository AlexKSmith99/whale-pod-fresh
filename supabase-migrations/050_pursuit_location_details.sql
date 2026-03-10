-- Add location detail fields to pursuits for in-person meetings
ALTER TABLE pursuits ADD COLUMN IF NOT EXISTS neighborhood text;
ALTER TABLE pursuits ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE pursuits ADD COLUMN IF NOT EXISTS latitude double precision;
ALTER TABLE pursuits ADD COLUMN IF NOT EXISTS longitude double precision;
