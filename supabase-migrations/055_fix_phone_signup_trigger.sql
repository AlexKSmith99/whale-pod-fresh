-- Fix: Allow phone-only signups (no email required)
-- The handle_new_user trigger assumed email was always present,
-- but phone OTP signups have no email, causing "Database error saving new user"

-- Allow email to be null for phone-only signups
ALTER TABLE public.profiles ALTER COLUMN email DROP NOT NULL;

-- Update trigger to handle phone-based signups
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, phone)
  VALUES (NEW.id, NEW.email, NEW.phone)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
