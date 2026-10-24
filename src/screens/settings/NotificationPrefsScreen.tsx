/**
 * Notification preferences.
 *
 * Preferences live in Supabase, not AsyncStorage. Push is sent client-side from
 * the SENDER's device, so the sender has to be able to read the recipient's
 * preference at send time — a local-only toggle is unreachable from there,
 * which is why the previous version of this screen had no effect on anything.
 * Filtering itself happens in the get_pushable_tokens RPC (migration 081), so
 * senders never see anyone else's preferences.
 *
 * Meeting reminders are different: they're local notifications scheduled
 * on-device, so toggling them reschedules immediately.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Switch, StyleSheet, StatusBar, Linking, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { useTheme } from '../../theme/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { settingsTheme } from './settingsShared';
import {
  notificationPrefsService,
  DEFAULT_NOTIFICATION_PREFS,
  NotificationPrefs,
} from '../../services/notificationPrefsService';
import { meetingReminderService } from '../../services/meetingReminderService';

type PrefKey = keyof NotificationPrefs;

interface CardSpec {
  title: string;
  description: string;
  rows: { key: PrefKey; icon: keyof typeof Ionicons.glyphMap; label: string }[];
}

const REMINDER_SECTION: CardSpec = {
  title: 'meeting reminders',
  description: 'a nudge before your pod meets, even if the app is closed',
  rows: [
    { key: 'meeting_reminder_1_day', icon: 'calendar-outline', label: '1 day before' },
    { key: 'meeting_reminder_1_hour', icon: 'time-outline', label: '1 hour before' },
  ],
};

const SECTIONS: { label: string; cards: CardSpec[] }[] = [
  {
    label: 'your pods',
    cards: [
      {
        title: 'pod alerts',
        description: 'kickoffs, meetings & pod updates',
        rows: [{ key: 'pod_alerts_push', icon: 'notifications-outline', label: 'push' }],
      },
      {
        title: 'pod chats',
        description: "messages in pods you've joined",
        rows: [{ key: 'pod_chats_push', icon: 'chatbubble-outline', label: 'push' }],
      },
    ],
  },
  {
    label: 'happenings',
    cards: [
      {
        title: 'direct messages',
        description: 'one-to-one messages',
        rows: [{ key: 'direct_messages_push', icon: 'chatbubble-outline', label: 'push' }],
      },
      {
        title: 'applications',
        description: 'applications, acceptances & interview invites',
        rows: [{ key: 'applications_push', icon: 'notifications-outline', label: 'push' }],
      },
      {
        title: 'connections',
        description: 'connection requests and accepts',
        rows: [{ key: 'connections_push', icon: 'notifications-outline', label: 'push' }],
      },
      {
        title: 'from whale pod',
        description: 'product updates & ways to help shape the pod',
        rows: [{ key: 'from_whale_pod_push', icon: 'notifications-outline', label: 'push' }],
      },
    ],
  },
];

interface Props {
  onBack: () => void;
}

export default function NotificationPrefsScreen({ onBack }: Props) {
  const { isNewTheme } = useTheme();
  const { user } = useAuth();
  const t = settingsTheme(isNewTheme);

  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_NOTIFICATION_PREFS);
  const [loading, setLoading] = useState(true);
  const [permission, setPermission] = useState<Notifications.PermissionStatus | null>(null);

  const refreshPermission = useCallback(async () => {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      setPermission(status);
    } catch {
      setPermission(null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const loaded = await notificationPrefsService.get(user?.id || '');
      if (!cancelled) {
        setPrefs(loaded);
        setLoading(false);
      }
      refreshPermission();
    })();
    return () => { cancelled = true; };
  }, [user?.id, refreshPermission]);

  // Reminders are scheduled locally, so a change has to reschedule right away
  // rather than waiting for the next app foreground.
  const resyncReminders = useCallback(async (next: NotificationPrefs) => {
    if (!user?.id) return;
    try {
      await meetingReminderService.sync(user.id, {
        // The master switch covers local reminders too — it reads as "does my
        // phone notify me at all", and a reminder is still a phone notification.
        oneDay: next.push_enabled && next.meeting_reminder_1_day,
        oneHour: next.push_enabled && next.meeting_reminder_1_hour,
      });
    } catch (error) {
      console.error('Error resyncing reminders:', error);
    }
  }, [user?.id]);

  const toggle = useCallback(async (key: PrefKey) => {
    // Optimistic: the switch should move under the finger, not after a round trip.
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);

    try {
      await notificationPrefsService.update(user?.id || '', { [key]: next[key] });
    } catch {
      setPrefs(prefs); // revert on failure
      return;
    }

    if (key === 'meeting_reminder_1_day' || key === 'meeting_reminder_1_hour' || key === 'push_enabled') {
      resyncReminders(next);
    }
  }, [prefs, user?.id, resyncReminders]);

  const handlePermissionPress = useCallback(async () => {
    if (permission === 'denied') {
      // iOS won't re-prompt once denied — Settings is the only route back.
      Linking.openSettings().catch(() => {});
      return;
    }
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      setPermission(status);
    } catch {}
  }, [permission]);

  const granted = permission === 'granted';
  // Categories are meaningless when the master switch is off or iOS is blocking
  // everything — dim them so the screen tells the truth about what's live.
  const categoriesActive = prefs.push_enabled && granted;

  const renderToggleRow = (
    row: { key: PrefKey; icon: keyof typeof Ionicons.glyphMap; label: string },
    disabled: boolean
  ) => (
    <View key={row.key} style={styles.toggleRow}>
      <View style={styles.toggleLabelWrap}>
        <Ionicons name={row.icon} size={20} color={t.text} />
        <Text style={[styles.toggleLabel, { color: t.text, fontFamily: t.bodyFont }]}>{row.label}</Text>
      </View>
      <Switch
        value={prefs[row.key]}
        onValueChange={() => toggle(row.key)}
        disabled={disabled}
        trackColor={{ false: isNewTheme ? '#333333' : '#D6D3CC', true: t.accent }}
        thumbColor={prefs[row.key] ? (isNewTheme ? '#555555' : '#FFFFFF') : '#f4f3f4'}
      />
    </View>
  );

  const renderCard = (card: CardSpec, active: boolean) => (
    <View
      key={card.title}
      style={[
        styles.card,
        { backgroundColor: t.card },
        !isNewTheme && { borderWidth: 1, borderColor: t.hairline },
        !active && styles.cardInactive,
      ]}
    >
      <Text style={[styles.cardTitle, { color: t.text, fontFamily: t.titleFont }, !isNewTheme && { fontSize: 18, letterSpacing: -0.3 }]}>{card.title}</Text>
      <Text style={[styles.cardDescription, { color: t.muted, fontFamily: t.bodyFont }]}>{card.description}</Text>
      {card.rows.map(row => renderToggleRow(row, !active))}
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: t.bg }]}>
      <StatusBar barStyle={isNewTheme ? 'light-content' : 'dark-content'} backgroundColor={t.bg} />
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} activeOpacity={0.6} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={[styles.backBtn, isNewTheme && { backgroundColor: '#1F1F1F' }]}>
          <Ionicons name="chevron-back" size={22} color={t.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: t.text, fontFamily: t.titleFont }, !isNewTheme && { fontSize: 20, letterSpacing: -0.3 }]}>notifications</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={t.accent} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={[styles.intro, { color: t.textSecondary, fontFamily: t.bodyFont }]}>
            control freak? respect. fine-tune what reaches your phone.
          </Text>

          {/* iOS permission is the gate above every preference here — without it
              nothing can be delivered, and nothing else on screen would explain
              the silence. */}
          {permission !== null && !granted && (
            <TouchableOpacity
              style={[styles.permissionBanner, { backgroundColor: t.cardAlt, borderColor: t.accent }]}
              onPress={handlePermissionPress}
              activeOpacity={0.7}
            >
              <Ionicons name="notifications-off-outline" size={22} color={t.accent} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.permissionTitle, { color: t.text, fontFamily: t.bodyFont }]}>
                  notifications are off in iOS
                </Text>
                <Text style={[styles.permissionBody, { color: t.muted, fontFamily: t.bodyFont }]}>
                  {permission === 'denied'
                    ? 'tap to open Settings and turn them on'
                    : 'tap to allow whale pod to notify you'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={t.muted} />
            </TouchableOpacity>
          )}

          {/* Master switch */}
          <View style={[styles.card, { backgroundColor: t.card }, !isNewTheme && { borderWidth: 1, borderColor: t.hairline }]}>
            <Text style={[styles.cardTitle, { color: t.text, fontFamily: t.titleFont }, !isNewTheme && { fontSize: 18, letterSpacing: -0.3 }]}>iphone notifications</Text>
            <Text style={[styles.cardDescription, { color: t.muted, fontFamily: t.bodyFont }]}>
              banners and lock screen alerts when the app is closed. your in-app alerts tab stays complete either way.
            </Text>
            {renderToggleRow({ key: 'push_enabled', icon: 'phone-portrait-outline', label: 'allow' }, !granted)}
          </View>

          <Text style={[styles.sectionLabel, { color: t.text, fontFamily: t.bodyFont }]}>{REMINDER_SECTION.title}</Text>
          {renderCard(REMINDER_SECTION, categoriesActive)}

          {SECTIONS.map(section => (
            <View key={section.label}>
              <Text style={[styles.sectionLabel, { color: t.text, fontFamily: t.bodyFont }]}>{section.label}</Text>
              {section.cards.map(card => renderCard(card, categoriesActive))}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 58,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 18 },
  content: { paddingHorizontal: 20, paddingBottom: 60 },
  intro: { fontSize: 15, lineHeight: 22, marginTop: 8, marginBottom: 20 },
  permissionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 18,
  },
  permissionTitle: { fontSize: 15 },
  permissionBody: { fontSize: 13, lineHeight: 18, marginTop: 2 },
  sectionLabel: { fontSize: 16, marginBottom: 10, marginTop: 8 },
  card: {
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
  },
  cardInactive: { opacity: 0.45 },
  cardTitle: { fontSize: 17 },
  cardDescription: { fontSize: 13, lineHeight: 19, marginTop: 4, marginBottom: 6 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  toggleLabelWrap: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  toggleLabel: { fontSize: 16 },
});
