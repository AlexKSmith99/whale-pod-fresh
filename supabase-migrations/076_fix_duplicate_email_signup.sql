-- 076_fix_duplicate_email_signup.sql
--
-- Fixes: signup at the end of onboarding fails with
--   "Database error saving new user"
--   -> 23505 duplicate key value violates unique constraint "profiles_email_key"
--
-- Root cause:
--   auth.signUp() (deferred to the final onboarding step) inserts an auth.users
--   row, which fires on_auth_user_created -> handle_new_user(), which does
--   INSERT INTO public.profiles (id, email, phone) ... ON CONFLICT (id) DO NOTHING.
--   A UNIQUE constraint "profiles_email_key" exists on profiles.email (added
--   out-of-band in the dashboard; it is NOT in any migration). When a profile
--   row already exists for that email -- e.g. a prior unconfirmed/retried signup
--   created a *different* auth.users id with the same email -- the trigger's
--   INSERT collides on email. ON CONFLICT (id) does not cover the email index,
--   so the whole auth transaction aborts and GoTrue returns the generic error.
--
-- profiles.email is a denormalized copy of auth.users.email; uniqueness is
-- already guaranteed at the auth layer. The redundant UNIQUE constraint on
-- profiles.email is what breaks retried signups, so we drop it. The original
-- schema (001) only ever declared a NON-unique index (idx_profiles_email),
-- which we recreate to keep email lookups fast.

BEGIN;

-- 1. Drop the redundant unique constraint / index on profiles.email, whichever
--    form it was created as (constraint vs. bare unique index).
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_email_key;
DROP INDEX IF EXISTS public.profiles_email_key;

-- 2. Keep a non-unique index for email lookups (matches 001_initial_schema.sql).
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles (email);

-- 3. Re-assert the trigger body. With the email uniqueness gone, the insert now
--    succeeds for a brand-new id even if the email is already present, so the
--    new user always gets a profile row (which onboarding then UPDATEs by id).
CREATE OR REPLACE FUNCTION public.handle_new_user()
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

COMMIT;
