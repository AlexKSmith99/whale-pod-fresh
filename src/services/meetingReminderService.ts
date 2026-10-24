import * as Notifications from 'expo-notifications';
import { meetingService } from './meetingService';

/**
 * Local scheduled reminders for a user's upcoming pod meetings.
 *
 * WHY LOCAL RATHER THAN PUSH
 * A reminder is for yourself, about a time the device already knows. Scheduling
 * locally needs no server, no push token and no network at fire time — it works
 * in Airplane mode — and iOS delivers it as a banner / lock-screen alert
 * exactly like a remote push. Server-side would need a scheduler that doesn't
 * exist in this project, and would still fire for meetings cancelled offline.
 *
 * It is also the only half of the notification work that can be tested in the
 * Simulator: registerPushToken bails on `!Device.isDevice`, so remote push
 * needs real hardware, while local notifications fire fine in the Simulator.
 */

/** Tags our notifications so we can cancel ours without touching anyone else's. */
const REMINDER_KIND = 'meeting_reminder';

/**
 * iOS allows an app only 64 pending local notifications; past that it silently
 * drops the furthest-out ones. Two reminders per meeting means a hard ceiling
 * of 32 meetings, so cap at 24 and keep headroom for anything else the app may
 * schedule later.
 */
const MAX_MEETINGS = 24;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export interface ReminderPrefs {
  oneDay: boolean;
  oneHour: boolean;
}

export interface SyncResult {
  scheduled: number;
  truncated: number;
  skippedNoPermission?: boolean;
}

interface UpcomingMeeting {
  id: string;
  label: string;
  startsAt: Date;
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

/**
 * Flattens getUserMeetings() — which returns meeting_participants rows with the
 * meeting (and its pursuit) nested — into the few fields a reminder needs.
 * Keeps only meetings still 'scheduled' and still in the future.
 */
function toUpcoming(rows: any[]): UpcomingMeeting[] {
  const now = Date.now();
  return (rows || [])
    .map(row => {
      const m = row?.meeting;
      if (!m?.id || !m?.scheduled_time) return null;
      if (m.status && m.status !== 'scheduled') return null;

      const startsAt = new Date(m.scheduled_time);
      if (isNaN(startsAt.getTime()) || startsAt.getTime() <= now) return null;

      // Prefer the pod name — "Fish Pod meets in 1 hour" reads better than the
      // meeting's own title, which is often generic ("Check In").
      const label = m.pursuit?.title || m.title || 'Your pod';
      return { id: m.id, label, startsAt };
    })
    .filter((m): m is UpcomingMeeting => m !== null)
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

export const meetingReminderService = {
  /**
   * Cancels only the reminders this service scheduled, identified by
   * data.kind. Deliberately NOT cancelAllScheduledNotificationsAsync(), which
   * would also wipe anything else the app ever schedules.
   */
  async cancelAll(): Promise<number> {
    try {
      const pending = await Notifications.getAllScheduledNotificationsAsync();
      const ours = pending.filter(
        n => (n.content?.data as any)?.kind === REMINDER_KIND
      );
      await Promise.all(
        ours.map(n => Notifications.cancelScheduledNotificationAsync(n.identifier))
      );
      return ours.length;
    } catch (error) {
      console.error('Error cancelling meeting reminders:', error);
      return 0;
    }
  },

  /**
   * Rebuilds the full reminder set from scratch: cancel ours, then reschedule.
   *
   * A full resync is idempotent, which is far easier to keep correct than
   * diffing individual meetings as they're created, moved, cancelled or left.
   * Call it on app foreground and after any meeting change.
   */
  async sync(userId: string, prefs: ReminderPrefs): Promise<SyncResult> {
    await meetingReminderService.cancelAll();

    if (!userId || (!prefs.oneDay && !prefs.oneHour)) {
      return { scheduled: 0, truncated: 0 };
    }

    // Scheduling without permission silently no-ops on iOS, so check first and
    // report it rather than appearing to succeed.
    try {
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') {
        return { scheduled: 0, truncated: 0, skippedNoPermission: true };
      }
    } catch {
      // If the permission check itself fails, try to schedule anyway.
    }

    let meetings: UpcomingMeeting[];
    try {
      meetings = toUpcoming(await meetingService.getUserMeetings(userId));
    } catch (error) {
      console.error('Error loading meetings for reminders:', error);
      return { scheduled: 0, truncated: 0 };
    }

    const truncated = Math.max(0, meetings.length - MAX_MEETINGS);
    if (truncated > 0) {
      // Say so rather than quietly dropping the tail.
      console.log(
        `[meetingReminders] ${meetings.length} upcoming meetings; scheduling the soonest ${MAX_MEETINGS} (iOS caps pending local notifications at 64). ${truncated} not scheduled.`
      );
    }

    const now = Date.now();
    let scheduled = 0;

    for (const meeting of meetings.slice(0, MAX_MEETINGS)) {
      const start = meeting.startsAt.getTime();
      const at = formatTime(meeting.startsAt);

      const triggers: { when: number; body: string }[] = [];
      if (prefs.oneDay) {
        triggers.push({
          when: start - DAY_MS,
          body: `${meeting.label} meets tomorrow at ${at}`,
        });
      }
      if (prefs.oneHour) {
        triggers.push({
          when: start - HOUR_MS,
          body: `${meeting.label} meets in 1 hour — ${at}`,
        });
      }

      for (const t of triggers) {
        // A meeting booked for tonight has already passed its 24h mark; it
        // should still get the 1-hour reminder.
        if (t.when <= now) continue;

        try {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: 'Upcoming meeting',
              body: t.body,
              data: { kind: REMINDER_KIND, meetingId: meeting.id },
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: new Date(t.when),
            },
          });
          scheduled += 1;
        } catch (error) {
          console.error('Error scheduling meeting reminder:', error);
        }
      }
    }

    return { scheduled, truncated };
  },
};
