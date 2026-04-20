-- Add granular resume/portfolio requirement modes to pursuits
-- Values: 'off' (don't ask), 'optional' (ask but not required), 'mandatory' (required)

ALTER TABLE pursuits ADD COLUMN IF NOT EXISTS resume_mode text DEFAULT 'off';
ALTER TABLE pursuits ADD COLUMN IF NOT EXISTS portfolio_mode text DEFAULT 'off';
