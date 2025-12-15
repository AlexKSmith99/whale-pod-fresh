-- Migration: 028_pursuit_default_picture.sql
-- Description: Adds default_picture column to pursuits table for pod avatars
-- Date: 2025-12-12

-- Add default_picture column to pursuits table
ALTER TABLE pursuits ADD COLUMN IF NOT EXISTS default_picture TEXT;

-- Add comment for documentation
COMMENT ON COLUMN pursuits.default_picture IS 'URL to the default picture/avatar for the pursuit/pod';
