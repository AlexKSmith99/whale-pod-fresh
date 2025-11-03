# Kickoff Scheduling Feature - Testing Guide

**Status**: ✅ All Features Implemented
**Date**: 2025-11-03
**Branch**: `claude/add-project-status-docs-011CUjRgyPY68nGDRUv3Hv8o`

---

## ✅ Implementation Status

All kickoff scheduling features have been implemented and committed:
- ✅ Backend Services (kickoffService, calendarService, notificationService)
- ✅ UI Screens (TimeSlotProposalScreen, CreatorTimeSelectionScreen)
- ✅ Navigation wired in App.tsx
- ✅ PursuitDetailScreen with "Schedule Kick-Off" button
- ✅ Notification badges on all tabs

---

## 🚀 Quick Start - Get Code

Pull the latest changes:
```bash
git pull origin claude/add-project-status-docs-011CUjRgyPY68nGDRUv3Hv8o
npm start -- --clear
```

---

## 📋 Pre-Testing Setup

### 1. Install Required Packages

```bash
npm install @react-native-community/datetimepicker
npm install expo-auth-session expo-web-browser
npm install @react-native-async-storage/async-storage
```

### 2. Create Database Tables (Supabase)

Run these SQL commands in your Supabase SQL Editor:

#### **A. Notifications Table**
```sql
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  related_id UUID,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
```

#### **B. Time Slot Proposals Table**
```sql
CREATE TABLE IF NOT EXISTS time_slot_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pursuit_id UUID NOT NULL REFERENCES pursuits(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  proposed_slots JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(pursuit_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_time_slot_proposals_pursuit ON time_slot_proposals(pursuit_id);
CREATE INDEX IF NOT EXISTS idx_time_slot_proposals_user ON time_slot_proposals(user_id);
```

#### **C. Kickoff Meetings Table**
```sql
CREATE TABLE IF NOT EXISTS kickoff_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pursuit_id UUID NOT NULL REFERENCES pursuits(id) ON DELETE CASCADE,
  scheduled_date TIMESTAMP WITH TIME ZONE NOT NULL,
  location_type TEXT NOT NULL CHECK (location_type IN ('video', 'in_person')),
  location_details TEXT,
  google_calendar_event_id TEXT,
  meeting_notes_id UUID,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(pursuit_id)
);

CREATE INDEX IF NOT EXISTS idx_kickoff_meetings_pursuit ON kickoff_meetings(pursuit_id);
```

#### **D. Update Pursuits Table**
```sql
-- Add new columns if they don't exist
ALTER TABLE pursuits
  ADD COLUMN IF NOT EXISTS kickoff_scheduled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS kickoff_date TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS requesting_time_slots BOOLEAN DEFAULT FALSE;

-- Create index for status filtering
CREATE INDEX IF NOT EXISTS idx_pursuits_status ON pursuits(status);
```

#### **E. Ensure team_members Table Exists**
```sql
CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pursuit_id UUID NOT NULL REFERENCES pursuits(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'accepted' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(pursuit_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_team_members_pursuit ON team_members(pursuit_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_status ON team_members(status);
```

### 3. (Optional) Google Calendar Setup

For full calendar integration, follow `.claude/google-calendar-setup.md`

**Note**: The app works WITHOUT Google Calendar - it will just skip calendar event creation.

---

## 🧪 Testing Flow

### ✅ TEST 1: Creator Flow - Schedule Kickoff

**Prerequisites**:
- You need 3 user accounts (1 creator + 2 team members)
- Or you can simulate by manually adding team_members records

#### Step 1: Create a Pursuit (As Creator)
1. Open app, go to **Feed** tab
2. Tap **+ Create**
3. Fill out the form:
   - Title: "Test Kickoff Feature"
   - Description: (50+ chars)
   - **Team Size Min: 3** (IMPORTANT!)
   - Team Size Max: 8
   - Fill other required fields
4. Tap **Create Pursuit**
5. ✅ **VERIFY**: Pursuit appears in Feed with "YOURS" badge

#### Step 2: Accept Team Members
Since you need other users to apply, you have 2 options:

**Option A: Manual Database (Quick Test)**
```sql
-- Add 2 team members directly
INSERT INTO team_members (pursuit_id, user_id, status)
VALUES
  ('YOUR_PURSUIT_ID', 'MEMBER_USER_ID_1', 'accepted'),
  ('YOUR_PURSUIT_ID', 'MEMBER_USER_ID_2', 'accepted');

-- Update member count
UPDATE pursuits
SET current_members_count = 3
WHERE id = 'YOUR_PURSUIT_ID';
```

**Option B: Real Applications (Full Test)**
1. Login as User 2
2. Go to Feed → find the pursuit → Apply
3. Logout, login as Creator
4. Go to pursuit → Review Applications → Accept User 2
5. Repeat for User 3

#### Step 3: Verify "Schedule Kick-Off" Button
1. As creator, tap the pursuit in **My Pods** or **Feed**
2. ✅ **VERIFY**: Green "🎉 Schedule Kick-Off Meeting" button appears
3. ✅ **VERIFY**: Shows "3/3 minimum teammates ready!"

#### Step 4: Request Time Slots
1. Tap **"🎉 Schedule Kick-Off Meeting"**
2. ✅ **VERIFY**: Alert appears: "Time Slot Request Sent!"
3. Choose **"View Proposals"**
4. ✅ **VERIFY**: CreatorTimeSelectionScreen opens
5. ✅ **VERIFY**: Shows "0/2 teammates have submitted"

---

### ✅ TEST 2: Member Flow - Propose Time Slots

#### Step 1: Check Notification (As Team Member)
1. Logout as creator
2. Login as team member
3. Go to **Pods** tab
4. ✅ **VERIFY**: Red notification badge on Pods tab
5. Tap into the pursuit

#### Step 2: Open Time Slot Proposal
**Note**: Currently you need to open TimeSlotProposalScreen from:
- Notification system (not yet wired to open screen directly)
- Or manually navigate via pursuit details

For testing, you can temporarily add a button or use the notification flow once fully wired.

#### Step 3: Submit Time Slots
1. In TimeSlotProposalScreen:
   - Tap **"+ Add Time Slot"**
   - Select Date (within next 7 days)
   - Select Time (15-min intervals)
   - Choose Video Call or In-Person
   - Repeat to add 3-5 time slots
2. ✅ **VERIFY**: Progress shows "3/5 slots" or "5/5 slots"
3. ✅ **VERIFY**: Each slot shows date, time, and location type
4. Tap **"Submit Proposals"**
5. ✅ **VERIFY**: Success alert: "Time slots submitted!"

#### Step 4: Verify Submission
1. Go back to pursuit details
2. ✅ **VERIFY**: Can't submit again (button disabled or not shown)

---

### ✅ TEST 3: Creator - Select Best Time

#### Step 1: View Proposals (As Creator)
1. Login as creator
2. Go to **Feed** → tap your pursuit → **"View Time Slot Proposals"**
   - Or navigate from Pods tab
3. ✅ **VERIFY**: CreatorTimeSelectionScreen shows "2/2 teammates submitted"

#### Step 2: Review Popular Times
1. ✅ **VERIFY**: Time slots are listed
2. ✅ **VERIFY**: Shows popularity count (e.g., "2 members available")
3. ✅ **VERIFY**: Most popular times are at the top

#### Step 3: Schedule Meeting
1. Tap on a time slot
2. ✅ **VERIFY**: Confirmation dialog appears
3. Tap **"Confirm & Schedule"**
4. ✅ **VERIFY**: Success alert appears
5. ✅ **VERIFY**: Pursuit status changes to **"Active"**

#### Step 4: Verify Active Status
1. Go to **Feed** tab → tap filter **"Active"**
2. ✅ **VERIFY**: Your pursuit now shows under "Active"
3. Go to **Pods** tab
4. ✅ **VERIFY**: Pursuit shows as "Active" status

---

### ✅ TEST 4: Notification System

#### Check Notification Badges
1. ✅ **VERIFY**: Red badges appear on tabs when there are unread notifications
2. ✅ **VERIFY**: Badge clears when notifications are read
3. ✅ **VERIFY**: Badge counts refresh every 30 seconds

#### Check Notification Types
Test each notification type:
- **Pods tab**: Time slot requests, kickoff scheduled
- **Messages tab**: New messages
- **Profile tab**: Connection requests

---

## 🐛 Troubleshooting

### Issue: "Schedule Kick-Off" button doesn't appear
**Solution**:
- Verify pursuit status is 'awaiting_kickoff'
- Check current_members_count >= team_size_min
- Ensure you are the pursuit creator

### Issue: Time slots don't save
**Solution**:
- Check `time_slot_proposals` table exists
- Verify JSONB column is correct type
- Check user permissions in Supabase RLS

### Issue: Pursuit doesn't become "Active"
**Solution**:
- Check `kickoff_meetings` table exists
- Verify `pursuitService.scheduleKickoff()` is called
- Check pursuit status in database

### Issue: Notifications don't show
**Solution**:
- Verify `notifications` table exists
- Check if `notificationService` calls are working
- Look for console errors related to notifications

### Issue: Google Calendar not working
**Solution**:
- This is optional - app works without it
- See `.claude/google-calendar-setup.md` for full setup
- Check OAuth credentials in `calendarService.ts`

---

## 📊 Database Verification Queries

### Check Pursuits Status
```sql
SELECT id, title, status, current_members_count, team_size_min, kickoff_scheduled
FROM pursuits
WHERE creator_id = 'YOUR_USER_ID'
ORDER BY created_at DESC;
```

### Check Team Members
```sql
SELECT tm.*, p.name as member_name
FROM team_members tm
JOIN profiles p ON tm.user_id = p.id
WHERE tm.pursuit_id = 'YOUR_PURSUIT_ID'
AND tm.status = 'accepted';
```

### Check Time Slot Proposals
```sql
SELECT tsp.*, p.name as proposer_name
FROM time_slot_proposals tsp
JOIN profiles p ON tsp.user_id = p.id
WHERE tsp.pursuit_id = 'YOUR_PURSUIT_ID';
```

### Check Kickoff Meetings
```sql
SELECT *
FROM kickoff_meetings
WHERE pursuit_id = 'YOUR_PURSUIT_ID';
```

### Check Notifications
```sql
SELECT *
FROM notifications
WHERE user_id = 'YOUR_USER_ID'
ORDER BY created_at DESC
LIMIT 10;
```

---

## 🎉 Success Criteria

The feature is working correctly if:

1. ✅ Creator can see "Schedule Kick-Off" button when minimum teammates are met
2. ✅ Clicking button notifies all team members
3. ✅ Team members can propose 3-5 time slots
4. ✅ Creator can view all proposals ranked by popularity
5. ✅ Scheduling a meeting changes pursuit to "Active" status
6. ✅ Active pursuits appear under "Active" filter
7. ✅ Notification badges appear on relevant tabs
8. ✅ (Optional) Google Calendar events are created

---

## 📝 Notes

- **Google Calendar is optional** - core functionality works without it
- Time slots are within a **7-day window** from current date
- Each team member proposes **3-5 slots**
- Time intervals are **15 minutes**
- Creator sees **popularity ranking** of time slots
- Pursuit becomes **"Active"** after scheduling
- All team members are **notified** via in-app notifications

---

## 🚧 Known Limitations

1. **Direct navigation to TimeSlotProposalScreen** from notifications needs wiring
   - Workaround: Access through pursuit details or manual navigation
2. **Google Calendar** requires OAuth setup (optional feature)
3. **Notification tap actions** not yet fully wired to open specific screens
4. **Real-time updates** - requires manual refresh (pull to refresh works)

---

## 📚 Additional Documentation

- **Full feature overview**: `.claude/kickoff-feature-summary.md`
- **Google Calendar setup**: `.claude/google-calendar-setup.md`
- **Database schema**: See "Pre-Testing Setup" section above

---

**Last Updated**: 2025-11-03
**Questions?** Check the implementation files or git commit history for details.
