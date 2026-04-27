import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';

export type PieTabKey = 'feed' | 'pods' | 'calendar' | 'messages' | 'alerts' | 'profile';

interface Props {
  active: PieTabKey;
  onChange: (key: PieTabKey) => void;
  badges?: Partial<Record<PieTabKey, number>>;
  profilePictureUri?: string | null;
}

/**
 * Floating dark-pill tab bar — Pie-style.
 *  - 5 slots: feed, pods, calendar, messages, profile (last is the user's avatar)
 *  - Active slot gets a soft lime fill behind the icon
 *  - Badge dots (red) when there's unread activity
 */
export default function PieTabBar({ active, onChange, badges, profilePictureUri }: Props) {
  const { theme } = useTheme();
  const colors = theme.colors;

  const items: { key: PieTabKey; icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
    { key: 'feed',     icon: 'sparkles-outline',  label: 'feed' },
    { key: 'pods',     icon: 'people-outline',    label: 'pods' },
    { key: 'calendar', icon: 'calendar-outline',  label: 'cal' },
    { key: 'messages', icon: 'chatbubble-outline', label: 'chats' },
    { key: 'alerts',   icon: 'notifications-outline', label: 'alerts' },
    { key: 'profile',  icon: 'person-outline',    label: 'me' },
  ];

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={[styles.bar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {items.map(item => {
          const isActive = active === item.key;
          const badge = badges?.[item.key] || 0;
          const isAvatar = item.key === 'profile' && !!profilePictureUri;
          return (
            <TouchableOpacity
              key={item.key}
              activeOpacity={0.8}
              onPress={() => onChange(item.key)}
              style={styles.slot}
            >
              {isAvatar ? (
                <View style={[styles.avatarWrap, isActive && { borderColor: colors.accentGreen, borderWidth: 2 }]}>
                  <Image source={{ uri: profilePictureUri! }} style={styles.avatar} />
                </View>
              ) : (
                <View style={[styles.iconBubble, isActive && { backgroundColor: colors.accentGreen }]}>
                  <Ionicons
                    name={item.icon}
                    size={22}
                    color={isActive ? '#000000' : colors.textSecondary}
                  />
                </View>
              )}
              {badge > 0 && (
                <View style={[styles.badge, { backgroundColor: '#EF4444' }]}>
                  <Text style={styles.badgeText}>{badge > 9 ? '9+' : badge}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0, right: 0, bottom: 16,
    alignItems: 'center',
    zIndex: 100,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    minWidth: 340,
    width: '94%',
    maxWidth: 440,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  slot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBubble: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarWrap: {
    width: 38, height: 38, borderRadius: 19, overflow: 'hidden',
  },
  avatar: { width: '100%', height: '100%' },
  badge: {
    position: 'absolute', top: 2, right: 12,
    minWidth: 16, height: 16, borderRadius: 8,
    paddingHorizontal: 4,
    alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
});
