/**
 * About Whale Pod — blurb + legal pages + version.
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useTheme } from '../../theme/ThemeContext';
import { settingsTheme } from './settingsShared';

interface Props {
  onBack: () => void;
  onOpenLegal: (doc: 'terms' | 'privacy' | 'support') => void;
}

const LEGAL_ROWS: { doc: 'terms' | 'privacy' | 'support'; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { doc: 'terms', label: 'terms of service', icon: 'document-text-outline' },
  { doc: 'privacy', label: 'privacy policy', icon: 'shield-outline' },
  { doc: 'support', label: 'support', icon: 'help-circle-outline' },
];

export default function AboutScreen({ onBack, onOpenLegal }: Props) {
  const { isNewTheme } = useTheme();
  const t = settingsTheme(isNewTheme);
  const version = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <View style={[styles.container, { backgroundColor: t.bg }]}>
      <StatusBar barStyle={isNewTheme ? 'light-content' : 'dark-content'} backgroundColor={t.bg} />
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} activeOpacity={0.6} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={[styles.backBtn, isNewTheme && { backgroundColor: '#1F1F1F' }]}>
          <Ionicons name="chevron-back" size={22} color={t.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: t.text, fontFamily: t.titleFont }, !isNewTheme && { fontSize: 20, letterSpacing: -0.3 }]}>about</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        <Text style={[styles.headline, { color: t.text, fontFamily: t.titleFont }, !isNewTheme && { letterSpacing: -0.8 }]}>
          join the pod 🐋
        </Text>
        <Text style={[styles.copy, { color: t.textSecondary, fontFamily: t.bodyFont }]}>
          whale pod is where you find your people and chase goals together — pods for accountability, side hustles, hobbies, and everything in between.
        </Text>

        <View style={{ marginTop: 24 }}>
          {LEGAL_ROWS.map((row, i) => (
            <TouchableOpacity
              key={row.doc}
              style={[styles.row, i < LEGAL_ROWS.length - 1 && { borderBottomWidth: 1, borderBottomColor: t.hairline }]}
              onPress={() => onOpenLegal(row.doc)}
              activeOpacity={0.6}
            >
              <Ionicons name={row.icon} size={22} color={t.text} />
              <Text style={[styles.rowLabel, { color: t.text, fontFamily: t.bodyFont }]}>{row.label}</Text>
              <Ionicons name="chevron-forward" size={20} color={t.muted} />
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <Text style={[styles.version, { color: t.muted, fontFamily: t.bodyFont }]}>version {version}</Text>
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
  content: { paddingHorizontal: 24, paddingTop: 24, flex: 1 },
  headline: { fontSize: 34, lineHeight: 40, marginBottom: 14 },
  copy: { fontSize: 16, lineHeight: 24 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 18,
  },
  rowLabel: { flex: 1, fontSize: 17 },
  version: {
    textAlign: 'center',
    fontSize: 13,
    paddingBottom: 40,
  },
});
