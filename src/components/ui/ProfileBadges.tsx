/**
 * Credential badges shown next to a name while vetting someone.
 *
 * Two independent marks, computed server-side (migration 083):
 *   Pod Leader — led a pod that reached 'active' and ran 4+ weeks of meetings
 *   Regular    — has been involved in 3+ pods
 *
 * Deliberately discreet: small icons beside the name, with the explanation one
 * tap away rather than always on screen. A badge nobody can interpret is just
 * decoration, so tapping explains what it means and what it took to earn.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';
import { editorial } from '../../theme/designSystem';
import { badgeService, UserBadges, NO_BADGES } from '../../services/badgeService';

interface Props {
  userId?: string;
  /** Pass if the caller already has them, to avoid a second fetch. */
  badges?: UserBadges;
  size?: number;
}

interface BadgeSpec {
  key: 'pod_leader' | 'regular';
  icon: keyof typeof Ionicons.glyphMap;
  name: string;
  meaning: string;
  earned: string;
}

export default function ProfileBadges({ userId, badges: provided, size = 16 }: Props) {
  const { theme, isNewTheme } = useTheme();
  const colors = theme.colors;
  const [badges, setBadges] = useState<UserBadges>(provided || NO_BADGES);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (provided || !userId) return;
    let cancelled = false;
    badgeService.get(userId).then(b => { if (!cancelled) setBadges(b); });
    return () => { cancelled = true; };
  }, [userId, provided]);

  // Gold for leadership, Carolina for participation — in Pie dark both fall
  // back to lime, which is the only accent that theme allows.
  const leaderColor = isNewTheme ? colors.accentGreen : editorial.gold;
  const regularColor = isNewTheme ? colors.accentGreen : editorial.carolina;

  const specs: BadgeSpec[] = [
    {
      key: 'pod_leader',
      icon: 'ribbon',
      name: 'Pod Leader',
      meaning: 'Has led a pod that stayed active.',
      earned: `Led ${badges.led_count} pod${badges.led_count === 1 ? '' : 's'} that ran four weeks or more with regular meetings.`,
    },
    {
      key: 'regular',
      icon: 'people-circle',
      name: 'Regular',
      meaning: 'Has been part of pods before.',
      earned: `Involved in ${badges.pod_count} pods.`,
    },
  ];

  const earned = specs.filter(s => badges[s.key]);
  if (earned.length === 0) return null;

  const colorFor = (key: BadgeSpec['key']) => (key === 'pod_leader' ? leaderColor : regularColor);

  return (
    <>
      <TouchableOpacity
        style={styles.row}
        onPress={() => setOpen(true)}
        activeOpacity={0.6}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityRole="button"
        accessibilityLabel={`Credentials: ${earned.map(b => b.name).join(', ')}. Tap for details.`}
      >
        {earned.map(b => (
          <Ionicons key={b.key} name={b.icon} size={size} color={colorFor(b.key)} />
        ))}
      </TouchableOpacity>

      <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable
          style={[styles.backdrop, { backgroundColor: isNewTheme ? 'rgba(0,0,0,0.70)' : 'rgba(27,27,24,0.45)' }]}
          onPress={() => setOpen(false)}
        >
          {/* Stop taps inside the card from closing it. */}
          <Pressable
            style={[
              styles.card,
              { backgroundColor: colors.surface },
              !isNewTheme && { borderWidth: 1, borderColor: editorial.hairline },
            ]}
            onPress={() => {}}
          >
            {earned.map((b, i) => (
              <View key={b.key} style={[styles.item, i > 0 && styles.itemSpaced]}>
                <View style={styles.itemHeader}>
                  <Ionicons name={b.icon} size={20} color={colorFor(b.key)} />
                  <Text
                    style={[
                      styles.itemName,
                      {
                        color: colors.textPrimary,
                        fontFamily: isNewTheme ? 'Sora_700Bold' : 'PlayfairDisplay_700Bold',
                      },
                    ]}
                  >
                    {b.name}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.itemMeaning,
                    { color: colors.textPrimary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' },
                  ]}
                >
                  {b.meaning}
                </Text>
                <Text
                  style={[
                    styles.itemEarned,
                    { color: colors.textSecondary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' },
                  ]}
                >
                  {b.earned}
                </Text>
              </View>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  card: { width: '100%', maxWidth: 330, borderRadius: 16, paddingHorizontal: 22, paddingVertical: 20 },
  item: {},
  itemSpaced: { marginTop: 18, paddingTop: 18, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: editorial.hairline },
  itemHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  itemName: { fontSize: 17, letterSpacing: -0.2 },
  itemMeaning: { fontSize: 14, lineHeight: 20 },
  itemEarned: { fontSize: 13, lineHeight: 18, marginTop: 4 },
});
