-- Fix all pursuit member counts to match actual team_members count

UPDATE pursuits
SET current_members_count = (
  SELECT COUNT(*)
  FROM team_members
  WHERE team_members.pursuit_id = pursuits.id
    AND team_members.status IN ('active', 'accepted')
);
