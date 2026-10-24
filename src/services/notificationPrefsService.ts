import { supabase } from '../config/supabase';

/**
 * Notification preferences, stored in Supabase rather than on-device.
 *
 * They have to live server-side: push is sent client-side FROM THE SENDER'S
 * device (see notificationService.sendPushNotification), so the sender needs to
 * know the recipient's preference at send time. The previous AsyncStorage
 * toggles in NotificationPrefsScreen were unreachable from there, which is why
 * they never had any effect.
 *
 * Senders never read this table directly — the get_pushable_tokens RPC
 * (migration 081) applies the filter and returns only tokens.
 */

// PostgREST "table not in schema cache" — migration 081 not applied yet.
const TABLE_MISSING = 'PGRST205';
let warnedTableMissing = false;

export interface NotificationPrefs {
  push_enabled: boolean;
  pod_alerts_push: boolean;
  pod_chats_push: boolean;
  direct_messages_push: boolean;
  applications_push: boolean;
  connections_push: boolean;
  from_whale_pod_push: boolean;
  meeting_reminder_1_day: boolean;
  meeting_reminder_1_hour: boolean;
}

/** Mirrors the column defaults in 081 — everything on. */
export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  push_enabled: true,
  pod_alerts_push: true,
  pod_chats_push: true,
  direct_messages_push: true,
  applications_push: true,
  connections_push: true,
  from_whale_pod_push: true,
  meeting_reminder_1_day: true,
  meeting_reminder_1_hour: true,
};

function isTableMissing(error: any): boolean {
  if (error?.code !== TABLE_MISSING) return false;
  if (!warnedTableMissing) {
    warnedTableMissing = true;
    // console.log, not console.error: a missing optional table is a known setup
    // state, not a crash, and shouldn't red-box the app.
    console.log(
      '[notificationPrefs] table `notification_preferences` not found — apply supabase-migrations/081_notification_preferences.sql. Defaults (everything on) are in use until then.'
    );
  }
  return true;
}

export const notificationPrefsService = {
  /** Never throws for "no row" or "no table" — both mean "use defaults". */
  async get(userId: string): Promise<NotificationPrefs> {
    if (!userId) return { ...DEFAULT_NOTIFICATION_PREFS };

    const { data, error } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      if (!isTableMissing(error)) {
        console.error('Error loading notification preferences:', error);
      }
      return { ...DEFAULT_NOTIFICATION_PREFS };
    }

    // No row yet — the user has never opened the settings screen.
    return { ...DEFAULT_NOTIFICATION_PREFS, ...(data || {}) };
  },

  /**
   * Upserts a partial change and returns the full resulting preferences.
   * Returns the optimistic merge if the table isn't there yet, so the UI stays
   * responsive before 081 is applied.
   */
  async update(
    userId: string,
    patch: Partial<NotificationPrefs>
  ): Promise<NotificationPrefs> {
    const current = await notificationPrefsService.get(userId);
    const next = { ...current, ...patch };
    if (!userId) return next;

    const { error } = await supabase
      .from('notification_preferences')
      .upsert(
        { user_id: userId, ...next, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      );

    if (error && !isTableMissing(error)) {
      console.error('Error saving notification preferences:', error);
      throw error;
    }

    return next;
  },
};
