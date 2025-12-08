-- Fix team_members update policy for creators to remove team members

-- First, drop the existing "Creators can manage team members" policy if it exists
DROP POLICY IF EXISTS "Creators can manage team members" ON team_members;

-- Create separate policies for each operation for clarity

-- SELECT policy for creators
CREATE POLICY "Creators can select team members"
  ON team_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM pursuits
      WHERE pursuits.id = team_members.pursuit_id
      AND pursuits.creator_id = auth.uid()
    )
  );

-- INSERT policy for creators
CREATE POLICY "Creators can insert team members"
  ON team_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pursuits
      WHERE pursuits.id = team_members.pursuit_id
      AND pursuits.creator_id = auth.uid()
    )
  );

-- UPDATE policy for creators (this is the key one for member removal)
CREATE POLICY "Creators can update team members"
  ON team_members FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM pursuits
      WHERE pursuits.id = team_members.pursuit_id
      AND pursuits.creator_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pursuits
      WHERE pursuits.id = team_members.pursuit_id
      AND pursuits.creator_id = auth.uid()
    )
  );

-- DELETE policy for creators
CREATE POLICY "Creators can delete team members"
  ON team_members FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM pursuits
      WHERE pursuits.id = team_members.pursuit_id
      AND pursuits.creator_id = auth.uid()
    )
  );

-- Verify policies were created
DO $$
BEGIN
  RAISE NOTICE 'Team members update policies have been created for creators';
END $$;
