-- Admin review of waitlist applications.
-- Adds admin flag + review timestamps, guards the privileged fields against
-- self-service tampering, and exposes an admin-only approve/reject RPC.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS applied_at timestamptz;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

-- ---------------------------------------------------------------------------
-- Guard: a non-admin may set their OWN application_status to 'pending' (i.e.
-- submit an application) but may never move it to 'approved'/'rejected', and
-- may never flip is_admin. Admins (and the service role / SQL editor, where
-- auth.uid() is NULL) are unrestricted.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION guard_privileged_profile_fields()
RETURNS trigger AS $$
DECLARE caller_is_admin boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW; -- service role / SQL editor
  END IF;

  caller_is_admin := COALESCE((SELECT p.is_admin FROM profiles p WHERE p.id = auth.uid()), false);

  IF NEW.is_admin IS DISTINCT FROM OLD.is_admin AND NOT caller_is_admin THEN
    RAISE EXCEPTION 'Not authorized to change is_admin';
  END IF;

  IF NEW.application_status IS DISTINCT FROM OLD.application_status
     AND NEW.application_status <> 'pending'
     AND NOT caller_is_admin THEN
    RAISE EXCEPTION 'Not authorized to change application_status';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- CREATE OR REPLACE avoids a DROP (Postgres 14+ / Supabase). Fully additive.
CREATE OR REPLACE TRIGGER guard_privileged_profile_fields_trg
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION guard_privileged_profile_fields();

-- ---------------------------------------------------------------------------
-- Admin-only approve/reject action. Centralizes the status change so the app
-- never has to grant broad UPDATE rights on application_status.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION review_application(target_user uuid, decision text)
RETURNS void AS $$
BEGIN
  IF NOT COALESCE((SELECT is_admin FROM profiles WHERE id = auth.uid()), false) THEN
    RAISE EXCEPTION 'Admin only';
  END IF;
  IF decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid decision: %', decision;
  END IF;

  UPDATE profiles
     SET application_status = decision,
         reviewed_at = now()
   WHERE id = target_user;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION review_application(uuid, text) TO authenticated;

-- Make your own account an admin once (run manually with your user id):
--   UPDATE profiles SET is_admin = true WHERE id = '<your-auth-user-id>';

NOTIFY pgrst, 'reload schema';
