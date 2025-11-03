-- Check existing team members for your pursuit
SELECT
  tm.id,
  tm.pursuit_id,
  tm.user_id,
  tm.status,
  p.name as member_name,
  p.email as member_email
FROM team_members tm
JOIN profiles p ON tm.user_id = p.id
WHERE tm.pursuit_id = 'bf73182f-a956-438c-9a2b-3fc58de5198c';

-- Count accepted members
SELECT
  COUNT(*) as accepted_count,
  pursuit_id
FROM team_members
WHERE pursuit_id = 'bf73182f-a956-438c-9a2b-3fc58de5198c'
  AND status = 'accepted'
GROUP BY pursuit_id;

-- Check pursuit details
SELECT
  id,
  title,
  status,
  team_size_min,
  team_size_max,
  current_members_count
FROM pursuits
WHERE id = 'bf73182f-a956-438c-9a2b-3fc58de5198c';
