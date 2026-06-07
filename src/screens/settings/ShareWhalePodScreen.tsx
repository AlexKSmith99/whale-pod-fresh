/**
 * Share Whale Pod — Pie's "share pie" page, tailored to Whale Pod.
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Share, StatusBar } from 'react-native';
// RN's Clipboard is deprecated but available without adding a dependency.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Clipboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';
import { HapticManager } from '../../services/hapticManager';
import { settingsTheme, SHARE_URL } from './settingsShared';

interface Props {
  onBack: () => void;
}

export default function ShareWhalePodScreen({ onBack }: Props) {
  const { isNewTheme } = useTheme();
  const t = settingsTheme(isNewTheme);
  const [copied, setCopied] = React.useState(false);

  const copyLink = () => {
    Clipboard.setString(SHARE_URL);
    HapticManager.success?.();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareLink = async () => {
    try {
      await Share.share({ message: `join the pod 🐋 ${SHARE_URL}` });
    } catch {}
  };

  return (
    <View style={[styles.container, { backgroundColor: t.bg }]}>
      <StatusBar barStyle={isNewTheme ? 'light-content' : 'dark-content'} backgroundColor={t.bg} />
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} activeOpacity={0.6} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={[styles.backBtn, isNewTheme && { backgroundColor: '#1F1F1F' }]}>
          <Ionicons name="chevron-back" size={22} color={t.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: t.text, fontFamily: t.titleFont }, !isNewTheme && { fontSize: 20, letterSpacing: -0.3 }]}>share whale pod</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        <Text style={[styles.headline, { color: t.text, fontFamily: t.titleFont }, !isNewTheme && { letterSpacing: -0.8 }]}>
          spread the word, grow the pod
        </Text>
        <Text style={[styles.copy, { color: t.textSecondary, fontFamily: t.bodyFont }]}>
          share whale pod with your crew and start chasing goals together. more people, more pods, more momentum.
        </Text>

        <View style={[styles.urlBox, { backgroundColor: t.card, borderColor: t.hairline }]}>
          <Text style={[styles.urlLabel, { color: t.muted, fontFamily: t.bodyFont }]}>your shareable url</Text>
          <Text style={[styles.urlText, { color: t.text, fontFamily: t.bodyFont }]} numberOfLines={1}>{SHARE_URL}</Text>
        </View>
      </View>

      <View style={styles.bottomRow}>
        <TouchableOpacity style={[styles.pill, { backgroundColor: t.pill }]} onPress={copyLink} activeOpacity={0.85}>
          <Text style={[styles.pillText, { color: t.pillText, fontFamily: t.bodyFont }]}>{copied ? 'copied!' : 'copy link'}</Text>
          <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={18} color={t.pillText} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.pill, { backgroundColor: t.pill }]} onPress={shareLink} activeOpacity={0.85}>
          <Text style={[styles.pillText, { color: t.pillText, fontFamily: t.bodyFont }]}>share</Text>
          <Ionicons name="share-outline" size={18} color={t.pillText} />
        </TouchableOpacity>
      </View>
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
  headline: { fontSize: 38, lineHeight: 44, marginBottom: 16 },
  copy: { fontSize: 16, lineHeight: 24, marginBottom: 28 },
  urlBox: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  urlLabel: { fontSize: 13, marginBottom: 4 },
  urlText: { fontSize: 16 },
  bottomRow: {
    flexDirection: 'row',
    gap: 14,
    paddingHorizontal: 24,
    paddingBottom: 48,
  },
  pill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 54,
    borderRadius: 999,
  },
  pillText: { fontSize: 16 },
});
