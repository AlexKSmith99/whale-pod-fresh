import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { meetingReminderService } from '../services/meetingReminderService';
import { notificationPrefsService } from '../services/notificationPrefsService';

/**
 * Keeps the user's local meeting reminders in sync with their actual meetings.
 *
 * Resyncs on mount and on every foreground, mirroring the AppState pattern in
 * useKickoffReminder. Foreground is the right trigger: meetings can be created,
 * moved or cancelled by other members while the app is closed, and a resync is
 * cheap (one query plus a handful of schedule calls).
 */
export function useMeetingReminders(auth: any) {
  const userId = auth?.user?.id as string | undefined;
  // Guards against overlapping syncs — a foreground event can land while the
  // mount sync is still awaiting, and two concurrent runs would cancel each
  // other's freshly scheduled notifications.
  const syncing = useRef(false);

  useEffect(() => {
    if (!userId) {
      // Signed out: drop any reminders left from the previous session so a
      // shared device doesn't buzz about someone else's pods.
      meetingReminderService.cancelAll().catch(() => {});
      return;
    }

    let cancelled = false;

    const sync = async () => {
      if (syncing.current) return;
      syncing.current = true;
      try {
        const prefs = await notificationPrefsService.get(userId);
        if (cancelled) return;
        await meetingReminderService.sync(userId, {
          // push_enabled is the master "does my phone notify me at all" switch,
          // and a local reminder is still a phone notification. Must match the
          // gating in NotificationPrefsScreen, or the next foreground would
          // reschedule what the screen just cancelled.
          oneDay: prefs.push_enabled && prefs.meeting_reminder_1_day,
          oneHour: prefs.push_enabled && prefs.meeting_reminder_1_hour,
        });
      } catch (error) {
        console.error('Error syncing meeting reminders:', error);
      } finally {
        syncing.current = false;
      }
    };

    sync();

    const onChange = (state: AppStateStatus) => {
      if (state === 'active') sync();
    };
    const sub = AppState.addEventListener('change', onChange);

    return () => {
      cancelled = true;
      sub.remove();
    };
  }, [userId]);
}
