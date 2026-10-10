-- Add employer ("where do you work") field to profiles.
-- Distinct from `work` ("what do you do" / role), collected on the
-- consolidated "Your Details" onboarding step.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS employer text;
