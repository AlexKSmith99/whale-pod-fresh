# Debug: Schedule Kick-Off Button Not Appearing

## Issue
The "Schedule Kick-Off" button is not showing even though:
- Team size shows 3/8
- Minimum teammates is 3
- User is the creator

## Root Cause
The button requires `pursuit.status === 'awaiting_kickoff'`, but new pursuits are created with status `'open'` by default.

## Solution

### Check Your Pursuit Status
Run this query in Supabase SQL Editor:

```sql
SELECT id, title, status, current_members_count, team_size_min, team_size_max
FROM pursuits
WHERE creator_id = 'YOUR_USER_ID'
ORDER BY created_at DESC
LIMIT 5;
```

If the status shows `'open'` instead of `'awaiting_kickoff'`, that's the problem.

### Fix Option 1: Update Existing Pursuit (Quick)
```sql
UPDATE pursuits
SET status = 'awaiting_kickoff'
WHERE id = 'YOUR_PURSUIT_ID';
```

After running this, refresh the app and the button should appear!

### Fix Option 2: Update CreateScreen to Set Correct Status

The CreateScreen should set status to 'awaiting_kickoff' instead of 'open':

File: `src/screens/CreateScreen.tsx`

Find the `handleCreate` function where it calls:
```typescript
await pursuitService.createPursuit({
  // ...
  status: 'open', // ❌ Change this
```

Change to:
```typescript
await pursuitService.createPursuit({
  // ...
  status: 'awaiting_kickoff', // ✅ Correct
```

### Fix Option 3: Relax the Button Condition (Alternative)

If you want the button to show for ALL pursuits (not just awaiting_kickoff), you can modify PursuitDetailScreen:

File: `src/screens/PursuitDetailScreen.tsx` around line 239

Change:
```typescript
{pursuit.status === 'awaiting_kickoff' && minTeammatesReached && (
```

To:
```typescript
{minTeammatesReached && pursuit.status !== 'active' && (
```

This will show the button for any non-active pursuit once minimum teammates are met.

## Verification

After applying the fix, verify:
1. ✅ Pursuit status is 'awaiting_kickoff' (or condition is relaxed)
2. ✅ current_members_count >= team_size_min
3. ✅ You are the creator
4. ✅ Button appears in pursuit details

## Additional Check: Team Members Table

Also verify your team members are properly recorded:

```sql
SELECT
  tm.id,
  tm.status,
  p.name as member_name,
  tm.created_at
FROM team_members tm
JOIN profiles p ON tm.user_id = p.id
WHERE tm.pursuit_id = 'YOUR_PURSUIT_ID'
ORDER BY tm.created_at;
```

You should see at least 2 team members with status 'accepted' (plus you as creator = 3 total).
