-- Add pursuit_categories array column to support multiple categories
ALTER TABLE pursuits
ADD COLUMN IF NOT EXISTS pursuit_categories TEXT[];

-- Create index for filter performance
CREATE INDEX IF NOT EXISTS idx_pursuits_pursuit_categories ON pursuits USING GIN (pursuit_categories);
