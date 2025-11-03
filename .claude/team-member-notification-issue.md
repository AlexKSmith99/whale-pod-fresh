# Team Member Notification Flow - Current Issue

## Problem
When the creator clicks "Schedule Kick-Off Meeting", team members receive notifications in the database but **cannot see them** in the app.

## Current Flow
1. ✅ Creator clicks "Schedule Kick-Off Meeting"
2. ✅ `notificationService.notifyTimeSlotRequest()` creates notifications in database
3. ✅ Notification badge appears on Pods tab (number increases)
4. ❌ **Team member clicks Pods tab but sees NO notifications**
5. ❌ **Team member has no way to know they need to propose time slots**

## Root Cause
The `PodsScreen` does NOT display notifications. There's no:
- Notification list
- Notification banner
- Visual alert

The notification exists in the database, but there's no UI to show it.

## Expected Flow
1. Creator clicks "Schedule Kick-Off Meeting"
2. Team members receive notifications
3. Team members see badge on Pods tab
4. **Team members open Pods tab and see a notification banner** (MISSING)
5. **Team members click notification to open TimeSlotProposalScreen** (MISSING)

## Solution Options

### Option 1: Add Notification Banner to PodsScreen
Add a section at the top of PodsScreen that shows active notifications:

```typescript
// At top of PodsScreen render:
{notifications.length > 0 && (
  <View style={styles.notificationsSection}>
    {notifications.map(notif => (
      <TouchableOpacity
        key={notif.id}
        style={styles.notificationBanner}
        onPress={() => handleNotificationClick(notif)}
      >
        <Text>{notif.title}</Text>
        <Text>{notif.message}</Text>
      </TouchableOpacity>
    ))}
  </View>
)}
```

### Option 2: Auto-Open TimeSlotProposalScreen
When user opens PodsScreen and has a time_slot_request notification:
- Automatically show a modal/alert
- User can click to open TimeSlotProposalScreen
- Mark notification as read

### Option 3: Add Notifications Tab
Create a dedicated Notifications screen in the main navigation.

## Recommended: Option 1 + Auto-Alert

1. Add notification banner to PodsScreen (shows all unread notifications)
2. On mount, check for time_slot_request notifications
3. If found, show an Alert with action button
4. Clicking "Propose Times" opens TimeSlotProposalScreen

## Implementation

### Step 1: Load Notifications in PodsScreen

```typescript
const [notifications, setNotifications] = useState<any[]>([]);

useEffect(() => {
  loadData();
  loadNotifications();
}, []);

const loadNotifications = async () => {
  if (!user) return;

  const allNotifs = await notificationService.getNotifications(user.id);
  const unreadPods = allNotifs.filter(n =>
    !n.read &&
    ['time_slot_request', 'kickoff_scheduled', 'pod_ready_for_kickoff'].includes(n.type)
  );

  setNotifications(unreadPods);

  // Auto-show alert for time slot requests
  const timeSlotRequests = unreadPods.filter(n => n.type === 'time_slot_request');
  if (timeSlotRequests.length > 0) {
    const notif = timeSlotRequests[0];
    Alert.alert(
      notif.title,
      notif.message,
      [
        {
          text: 'Propose Times',
          onPress: async () => {
            await notificationService.markAsRead(notif.id);
            // Get pursuit details
            const { data: pursuit } = await supabase
              .from('pursuits')
              .select('*')
              .eq('id', notif.related_id)
              .single();

            if (pursuit && onOpenTimeSlotProposal) {
              onOpenTimeSlotProposal(pursuit);
            }
          }
        },
        {
          text: 'Later',
          style: 'cancel'
        }
      ]
    );
  }
};
```

### Step 2: Add Notification Banner

```typescript
// In render, before pods list:
{notifications.length > 0 && (
  <View style={styles.notificationsSection}>
    <Text style={styles.notificationsSectionTitle}>
      📬 Notifications ({notifications.length})
    </Text>
    {notifications.map(notif => (
      <TouchableOpacity
        key={notif.id}
        style={styles.notificationCard}
        onPress={() => handleNotificationClick(notif)}
      >
        <View style={styles.notificationContent}>
          <Text style={styles.notificationTitle}>{notif.title}</Text>
          <Text style={styles.notificationMessage}>{notif.message}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
      </TouchableOpacity>
    ))}
  </View>
)}
```

### Step 3: Handle Notification Click

```typescript
const handleNotificationClick = async (notif: any) => {
  // Mark as read
  await notificationService.markAsRead(notif.id);

  // Remove from state
  setNotifications(prev => prev.filter(n => n.id !== notif.id));

  // Handle different notification types
  if (notif.type === 'time_slot_request') {
    // Get pursuit and open time slot proposal screen
    const { data: pursuit } = await supabase
      .from('pursuits')
      .select('*')
      .eq('id', notif.related_id)
      .single();

    if (pursuit && onOpenTimeSlotProposal) {
      onOpenTimeSlotProposal(pursuit);
    }
  }

  if (notif.type === 'kickoff_scheduled') {
    // Show pursuit details
    const { data: pursuit } = await supabase
      .from('pursuits')
      .select('*')
      .eq('id', notif.related_id)
      .single();

    if (pursuit) {
      setSelectedPod(pursuit);
    }
  }
};
```

## Testing

1. Creator schedules kickoff (notifications sent)
2. Team member refreshes/reopens app
3. Team member sees badge on Pods tab
4. Team member opens Pods tab
5. **Alert pops up: "📅 Time Slot Request - Please propose your available time slots for [Pursuit Title]"**
6. Team member clicks "Propose Times"
7. TimeSlotProposalScreen opens
8. Notification is marked as read
9. Badge count decreases

---

**Status**: Implementation needed
**Priority**: High - blocks kickoff feature testing
**Files to modify**: src/screens/PodsScreen.tsx
