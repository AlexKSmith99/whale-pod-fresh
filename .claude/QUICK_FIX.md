# Quick Fix - Get "Schedule Kick-Off" Button Working

## Step 1: Fix the Database

Open Supabase SQL Editor and run this:

```sql
-- Add the missing status column
ALTER TABLE team_members
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'accepted';

-- Add constraint
ALTER TABLE team_members
ADD CONSTRAINT team_members_status_check
CHECK (status IN ('pending', 'accepted', 'rejected'));

-- Create index
CREATE INDEX IF NOT EXISTS idx_team_members_status ON team_members(status);
```

## Step 2: Verify It Worked

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'team_members';
```

You should see: `id`, `pursuit_id`, `user_id`, `status`, `created_at`

## Step 3: Get Your Pursuit ID

```sql
SELECT id, title, team_size_min
FROM pursuits
WHERE creator_id = (SELECT id FROM profiles WHERE email = 'YOUR_EMAIL')
ORDER BY created_at DESC
LIMIT 1;
```

Copy the `id` value.

## Step 4: Get Other User IDs

```sql
SELECT id, name, email
FROM profiles
WHERE email != 'YOUR_EMAIL'
LIMIT 5;
```

Copy 2 user `id` values.

## Step 5: Add Team Members

Replace with your actual IDs:

```sql
INSERT INTO team_members (pursuit_id, user_id, status)
VALUES
  ('PASTE_PURSUIT_ID', 'PASTE_USER_ID_1', 'accepted'),
  ('PASTE_PURSUIT_ID', 'PASTE_USER_ID_2', 'accepted');
```

## Step 6: Restart the App

```bash
npm start -- --clear
```

## Step 7: Check It Works

1. Open app
2. Go to Pods tab
3. Tap your pursuit
4. Look for debug output in console:

```
=== KICKOFF BUTTON DEBUG ===
Team members in team_members table: 2
Total members (including creator): 3
Minimum required: 3
Meets minimum? true
Button should show? true
============================
```

5. You should see the green "🎉 Schedule Kick-Off Meeting" button!

---

## If Something Goes Wrong

**Error: "constraint already exists"**
- This is fine, it means the constraint was already added. Continue to next step.

**Error: "relation team_members does not exist"**
- Run the full table creation SQL from `.claude/fix-team-members-table.md`

**Button still doesn't show**
- Check the debug output in the console
- Verify pursuit `status = 'awaiting_kickoff'` with:
  ```sql
  SELECT id, title, status FROM pursuits WHERE id = 'YOUR_PURSUIT_ID';
  ```
- If status is wrong, update it:
  ```sql
  UPDATE pursuits SET status = 'awaiting_kickoff' WHERE id = 'YOUR_PURSUIT_ID';
  ```

**No other users to add**
- Create test users or ask team members to sign up
- Or just test with minimum team size of 1 (creator only)

---

## Next Steps After Button Works

See `.claude/kickoff-testing-guide.md` for complete testing workflow:
1. Creator schedules kickoff
2. Members propose time slots
3. Creator selects best time
4. Pursuit becomes active

---

**Need More Help?**
- See `.claude/PROJECT_STATUS.md` for full project overview
- See `.claude/fix-team-members-table.md` for alternative fixes
