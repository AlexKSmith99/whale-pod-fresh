-- Migration: 068_application_targeted_roles.sql
-- Description: When a pod defines roles, applicants can now indicate which role(s)
-- they're targeting. NULL or empty array = "Any" (default).

ALTER TABLE public.pursuit_applications
  ADD COLUMN IF NOT EXISTS targeted_roles text[];
