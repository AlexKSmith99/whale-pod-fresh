# Whale Pod App - Project Status

**Last Updated**: 2025-01-08
**Current Branch**: `claude/add-project-status-docs-011CUjRgyPY68nGDRUv3Hv8o`
**Branch Purpose**: Major feature addition - Comprehensive notification system with LinkedIn-style Notifications tab

---

## 🎯 What We Just Built/Changed

### Latest Feature: Comprehensive Notification System (Jan 2025)

**🔔 New Notifications Tab** - Added a 5th tab to bottom navigation
- LinkedIn/Reddit-style notification feed with modern UI
- Shows all user interactions in one place
- Real-time updates via Supabase subscriptions
- Badge indicators showing unread counts
- Pull-to-refresh and tap-to-navigate functionality

**New Notification Types Added**:
1. **Application Received** (📬) - Pursuit creator notified when someone applies
2. **Application Accepted** (✅) - Applicant notified when accepted to team
3. **Application Rejected** (❌) - Applicant notified of rejection
4. **Connection Request** (🤝) - Notified when someone wants to connect
5. **Connection Accepted** (🤝) - Notified when connection request accepted

**Visual Indicators Throughout App**:
- Red badge on Notifications tab (total unread count)
- Red badge on My Pods tab (pursuit-related notifications)
- Numbered badge on "Review Applications" button (pending applications count)
- Unread dot indicators on individual notifications
- Color-coded notification icons (green=success, blue=info, red=error)

**Files Modified/Created**:
- `src/screens/NotificationsScreen.tsx` - NEW: Full notification feed UI
- `App.tsx` - Added Notifications tab and real-time subscription
- `src/services/notificationService.ts` - Added new notification types and helper functions
- `src/services/applicationService.ts` - Triggers notifications on apply/accept/reject
- `src/services/connectionService.ts` - Triggers notifications on connection actions
- `src/screens/PursuitDetailScreen.tsx` - Added pending applications badge
- `.claude/add-notification-types.sql` - Database migration script

**Real-Time Features**:
- Supabase subscriptions for instant notification updates
- Badge counts auto-refresh when new notifications arrive
- No manual refresh needed - everything updates live

**Database Changes Required**:
```sql
-- Run this in Supabase SQL Editor
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
CHECK (type IN (
  'pod_ready_for_kickoff', 'new_message', 'connection_request',
  'connection_accepted', 'pod_available', 'kickoff_scheduled',
  'time_slot_request', 'application_received', 'application_accepted',
  'application_rejected'
));
```

---

### Previous Work Summary

#### Button Text Clarity Update
- Changed "Schedule Kick-Off Meeting" → "Activate Kick-Off" for clarity
- Distinguishes two-step process: Activate (request time slots) vs Schedule (select final time)

#### Team Size & Application Tracking Fixes
- Fixed team member counting to include pursuit creator
- Added auto-sync for accepted applications → team_members records
- Proper pursuit status updates when minimum team size reached

#### Profile Links Instead of Emails
- Updated Applications page to show names/pictures as clickable profile links
- Made avatars clickable across Messages, Team Board, and Chat screens
- Consistent `onViewProfile` callback pattern

#### Connection Request Duplicate Key Fix
- Added "Request Sent" state to prevent duplicate connection requests
- Shows gray button after sending request
- Three-state button: Connect → Request Sent → Hidden (if connected)

#### Comprehensive Feed Filters
- Multi-select filters for pursuit type, categories, location, decision system, roles, status
- Filter badge showing active filter count
- Enhanced Supabase queries with `in()`, `contains()`, `overlaps()`, `ilike()`

---

## 🚀 Running the App

### Primary Command
```bash
npm start
# OR
npx expo start
```

### Clear Cache (if having issues)
```bash
npx expo start --clear
```

### Platform Options
After starting:
- Press `a` for Android emulator
- Press `i` for iOS simulator
- Scan QR code with Expo Go app on physical device

### Prerequisites
- Node.js 18+ and npm
- Expo Go app on your phone (for testing)
- Supabase project with environment variables set in `.env`
- For emulators: Android Studio or Xcode

---

## ⚠️ Gotchas & Important Decisions

### 1. **Google Calendar OAuth Issues** ⚠️ UNRESOLVED

**Problem**: Google Calendar integration doesn't work with Expo Go

**What We Tried**:
1. ❌ Expo auth proxy (`https://auth.expo.io/@alexksmith99/whale-pod-fresh`)
   - Error: "expo.io has not completed the Google verification process"
   - Would require Google to verify Expo's domain for Calendar API access

2. ❌ Custom scheme (`com.googleusercontent.apps.23113498288-...:/oauth2redirect`)
   - Error: "must use either http or https as the scheme"
   - Requires iOS/Android OAuth client (not Web client)

3. ❌ Localhost (`http://localhost:8081`)
   - Won't work on physical mobile devices

**Current State**:
- Google Calendar code is in place but non-functional
- Kickoff scheduling works fine without it
- Users can skip Google Calendar prompts

**Solutions**:
- **Short-term**: Remove/skip Google Calendar integration, users add to calendar manually
- **Long-term**: Set up iOS/Android OAuth clients when building production app (not Expo Go)

**Decision**: Leave as-is for now since kickoff scheduling works. Add proper OAuth when deploying production builds.

---

### 2. **Real-Time Subscriptions**

**Decision**: Using Supabase real-time subscriptions for notifications

**Why**: Instant updates without polling, better UX, less server load

**Implementation**:
- App.tsx subscribes to notifications table changes
- NotificationsScreen has its own subscription for the feed
- Badge counts refresh automatically

**Gotcha**: Subscriptions auto-reconnect but may have ~1-2 second delay on connection loss

---

### 3. **Notification Badge Logic**

**Different Tabs Track Different Notification Types**:
- **Feed Tab**: `pod_available` notifications
- **Messages Tab**: `new_message` notifications
- **Notifications Tab**: ALL notification types (total count)
- **My Pods Tab**: `pod_ready_for_kickoff`, `kickoff_scheduled`, `time_slot_request`
- **Profile Tab**: `connection_request`, `connection_accepted`

**Why**: Users can see at a glance where attention is needed

---

### 4. **Application Status Tracking**

**Three States**:
1. `pending` - Awaiting creator review
2. `accepted` - Accepted to team (creates team_member record)
3. `declined` - Rejected by creator

**Side Effects of Acceptance**:
- Creates `team_members` record
- Increments `pursuit.current_members_count`
- Updates pursuit status to `awaiting_kickoff` when minimum reached
- Sends notification to applicant

---

### 5. **Custom Tab Navigation**

**Why Not React Navigation Tabs**: Full control over styling and badge positioning

**Trade-off**: More manual state management but complete flexibility

**Location**: `App.tsx` - manages all screen state and tab bar rendering

---

## 📋 What to Work On Next

### High Priority

1. **Run Database Migration** ⚠️
   - Execute `.claude/add-notification-types.sql` in Supabase SQL Editor
   - Required for new notification types to work

2. **Test Notification System**
   - Create test accounts
   - Test all notification triggers:
     - Apply to pursuit → Creator receives notification
     - Accept/reject application → Applicant receives notification
     - Send connection request → Recipient receives notification
     - Accept connection → Sender receives notification
   - Verify badge counts update correctly
   - Test real-time updates (open on two devices)

3. **Google Calendar Decision**
   - **Option A**: Remove Google Calendar integration entirely
   - **Option B**: Make it easily skippable (current state is okay)
   - **Option C**: Set up iOS/Android OAuth clients (complex, for later)
   - **Recommendation**: Go with Option B for now

### Medium Priority

4. **Notification Settings Screen**
   - Allow users to control which notifications they receive
   - Push notification preferences
   - Email notification preferences

5. **Mark Multiple Notifications as Read**
   - Add "Select" mode to NotificationsScreen
   - Allow bulk actions (mark multiple as read, delete)

6. **Notification Grouping**
   - Group similar notifications (e.g., "3 people applied to your pursuit")
   - Reduces clutter for active pursuits

7. **Push Notifications**
   - Integrate Expo push notifications
   - Send push when app is closed
   - Requires Expo push notification setup

### Nice to Have

8. **Notification Sounds/Haptics**
   - Add subtle sound when receiving notification
   - Haptic feedback on interactions

9. **Email Notifications**
   - Send email for important notifications
   - Daily digest option

10. **Notification Analytics**
    - Track which notification types drive engagement
    - A/B test notification copy

---

## 🏗️ Project Structure

```
whale-pod-fresh/
├── App.tsx                          # Main router, tab navigation, notification subscriptions
├── src/
│   ├── components/
│   │   ├── Button.tsx              # Design system button
│   │   ├── Card.tsx                # Design system card
│   │   ├── Input.tsx               # Design system input
│   │   └── NotificationBadge.tsx   # Red dot badge for tabs
│   ├── contexts/
│   │   └── AuthContext.tsx         # Global auth state
│   ├── screens/
│   │   ├── FeedScreen.tsx
│   │   ├── MessagesListScreen.tsx
│   │   ├── NotificationsScreen.tsx # ✨ NEW: Notification feed
│   │   ├── PodsScreen.tsx
│   │   ├── ProfileScreen.tsx
│   │   ├── PursuitDetailScreen.tsx # Updated with application badge
│   │   ├── ApplicationsReviewScreen.tsx
│   │   └── ...
│   ├── services/
│   │   ├── applicationService.ts   # ✨ Updated: notification triggers
│   │   ├── connectionService.ts    # ✨ Updated: notification triggers
│   │   ├── notificationService.ts  # ✨ Updated: new types and functions
│   │   ├── googleCalendarService.ts # ⚠️ Non-functional in Expo Go
│   │   └── ...
│   └── theme/
│       └── designSystem.ts         # Design tokens
├── .claude/
│   ├── add-notification-types.sql  # ✨ NEW: Database migration
│   └── project-status.md           # This file
├── package.json
└── app.json
```

---

## 🛠️ Tech Stack

- **Framework**: React Native 0.81.5 with Expo ~54.0.20
- **Language**: TypeScript 5.9
- **Backend**: Supabase (PostgreSQL + Auth + Realtime)
- **Navigation**: Custom tab navigation (App.tsx manages state)
- **Storage**: AsyncStorage
- **UI**: Custom design system with Expo Vector Icons
- **Real-time**: Supabase subscriptions for notifications

---

## 📝 Key Commands Reference

```bash
# Development
npm start                    # Start Expo dev server
npx expo start --clear       # Start with cleared cache
npm run android              # Run on Android
npm run ios                  # Run on iOS

# Dependency Management
npm install                  # Install dependencies

# Git
git status                   # Check status
git pull origin <branch>     # Pull latest changes
git add -A                   # Stage all changes
git commit -m "message"      # Commit with message
git push -u origin <branch>  # Push to remote

# Expo
expo doctor                  # Check for issues
```

---

## 🔗 Important Links

- **Supabase Dashboard**: https://supabase.com/dashboard
- **Google Cloud Console**: https://console.cloud.google.com/apis/credentials
- **Expo Documentation**: https://docs.expo.dev/
- **React Native Docs**: https://reactnavigation.org/

---

## 💡 Development Tips

1. **Use Design System Tokens**: Always import from `designSystem.ts` for consistency
2. **Test Notifications with Multiple Accounts**: Best way to verify real-time updates
3. **Check Supabase Logs**: When data issues occur, check dashboard for query logs
4. **Clear Expo Cache**: If experiencing weird issues, use `npx expo start --clear`
5. **Restart Fully**: When pulling code changes, fully stop and restart Expo
6. **Real-time Debugging**: Check console logs for "Notification change detected" messages

---

## 🐛 Known Issues

1. **Google Calendar OAuth** - Doesn't work in Expo Go (see Gotchas section)
2. **Notification Sound** - No sound/haptic feedback yet (planned feature)
3. **Push Notifications** - Not implemented yet (only in-app notifications)
4. **Web Platform** - Limited testing, primarily focused on mobile

---

## ✅ Recent Test Checklist

When testing the notification system:
- [ ] Apply to a pursuit → Creator receives notification
- [ ] Accept application → Applicant receives notification
- [ ] Reject application → Applicant receives notification
- [ ] Send connection request → Recipient receives notification
- [ ] Accept connection → Sender receives notification
- [ ] Badge appears on Notifications tab
- [ ] Badge appears on My Pods tab (pursuit notifications)
- [ ] Badge appears on Review Applications button
- [ ] Tap notification → Navigate to correct screen
- [ ] Mark as read → Badge count decreases
- [ ] Mark all read → All badges clear
- [ ] Real-time updates (test with 2 devices)

---

**Status**: ✅ Notification system fully implemented, ready for database migration and testing

**Next Action**: Run SQL migration in Supabase, then test with multiple accounts
