/**
 * Notification preferences — Pie-style toggle cards, tailored to Whale Pod.
 * Preferences persist locally to AsyncStorage.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Switch, StyleSheet, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../theme/ThemeContext';
import { settingsTheme } from './settingsShared';

const PREFS_KEY = '@whale_pod_notification_prefs';

type PrefKey =
  | 'podAlertsPush'
  | 'podChatsPush'
  | 'applicationsPush'
  | 'connectionsPush'
  | 'fromWhalePodPush';

const DEFAULT_PREFS: Record<PrefKey, boolean> = {
  podAlertsPush: true,
  podChatsPush: true,
  applicationsPush: true,
  connectionsPush: true,
  fromWhalePodPush: true,
};

interface CardSpec {
  title: string;
  description: string;
  rows: { key: PrefKey; icon: 'notifications-outline' | 'chatbubble-outline'; label: string }[];
}

const SECTIONS: { label: string; cards: CardSpec[] }[] = [
  {
    label: 'your pods',
    cards: [
      {
        title: 'pod alerts',
        description: 'kickoffs, meetings & reminders for your pods',
        rows: [{ key: 'podAlertsPush', icon: 'notifications-outline', label: 'push' }],
      },
      {
        title: 'pod chats',
        description: "messages in pods you've joined",
        rows: [{ key: 'podChatsPush', icon: 'chatbubble-outline', label: 'push' }],
      },
    ],
  },
  {
    label: 'happenings',
    cards: [
      {
        title: 'applications',
        description: 'applications, acceptances & interview invites',
        rows: [{ key: 'applicationsPush', icon: 'notifications-outline', label: 'push' }],
      },
      {
        title: 'connections',
        description: 'connection requests and accepts',
        rows: [{ key: 'connectionsPush', icon: 'notifications-outline', label: 'push' }],
      },
      {
        title: 'from whale pod',
        description: 'product updates & ways to help shape the pod',
        rows: [{ key: 'fromWhalePodPush', icon: 'notifications-outline', label: 'push' }],
      },
    ],
  },
];

interface Props {
  onBack: () => void;
}

export default function NotificationPrefsScreen({ onBack }: Props) {
  const { isNewTheme } = useTheme();
  const t = settingsTheme(isNewTheme);
  const [prefs, setPrefs] = useState<Record<PrefKey, boolean>>(DEFAULT_PREFS);

  useEffect(() => {
    AsyncStorage.getItem(PREFS_KEY).then(raw => {
      if (raw) {
        try {
          setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(raw) });
        } catch {}
      }
    });
  }, []);

  const toggle = (key: PrefKey) => {
    setPrefs(prev => {
      const next = { ...prev, [key]: !prev[key] };
      AsyncStorage.setItem(PREFS_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

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

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.intro, { color: t.textSecondary, fontFamily: t.bodyFont }]}>
          control freak? respect. fine-tune your notifications and stay in the loop.
        </Text>

        {SECTIONS.map(section => (
          <View key={section.label}>
            <Text style={[styles.sectionLabel, { color: t.text, fontFamily: t.bodyFont }]}>{section.label}</Text>
            {section.cards.map(card => (
              <View key={card.title} style={[styles.card, { backgroundColor: t.card }, !isNewTheme && { borderWidth: 1, borderColor: t.hairline }]}>
                <Text style={[styles.cardTitle, { color: t.text, fontFamily: t.titleFont }, !isNewTheme && { fontSize: 18, letterSpacing: -0.3 }]}>{card.title}</Text>
                <Text style={[styles.cardDescription, { color: t.muted, fontFamily: t.bodyFont }]}>{card.description}</Text>
                {card.rows.map(row => (
                  <View key={row.key} style={styles.toggleRow}>
                    <View style={styles.toggleLabelWrap}>
                      <Ionicons name={row.icon} size={20} color={t.text} />
                      <Text style={[styles.toggleLabel, { color: t.text, fontFamily: t.bodyFont }]}>{row.label}</Text>
                    </View>
                    <Switch
                      value={prefs[row.key]}
                      onValueChange={() => toggle(row.key)}
                      trackColor={{ false: isNewTheme ? '#333333' : '#D6D3CC', true: t.accent }}
                      thumbColor={prefs[row.key] ? (isNewTheme ? '#555555' : '#FFFFFF') : '#f4f3f4'}
                    />
                  </View>
                ))}
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
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
  sectionLabel: { fontSize: 16, marginBottom: 10, marginTop: 8 },
  card: {
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
  },
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
