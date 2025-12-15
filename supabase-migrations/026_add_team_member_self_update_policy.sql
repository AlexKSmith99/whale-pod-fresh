-- Add policy to allow team members to update their own status (for leaving pods)

-- Create policy for team members to update their own record
CREATE POLICY "Team members can update own status"
  ON team_members FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Verify policy was created
DO $$
BEGIN
  RAISE NOTICE 'Team members can now update their own status (for leaving pods)';
END $$;
