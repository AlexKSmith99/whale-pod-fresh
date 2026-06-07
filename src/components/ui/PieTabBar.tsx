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

// Flappy-Bird-feely tab palette: chunky filled icons, each tab gets its own
// bright fill when active. Carolina blue is the dominant accent, gold appears
// only on the feed tab (rare tertiary), red stays for alerts (semantic).
const CAROLINA = '#4B9CD3';
const GOLD = '#C49B00';
const ALERT_RED = '#EF4444';
const TAB_INACTIVE = '#9A9A95';

const items: { key: PieTabKey; icon: keyof typeof Ionicons.glyphMap; label: string; color: string }[] = [
  { key: 'feed',     icon: 'sparkles',       label: 'feed',     color: GOLD },
  { key: 'pods',     icon: 'people',         label: 'pods',     color: CAROLINA },
  { key: 'calendar', icon: 'calendar',       label: 'cal',      color: CAROLINA },
  { key: 'messages', icon: 'chatbubble',     label: 'chats',    color: CAROLINA },
  { key: 'alerts',   icon: 'notifications',  label: 'alerts',   color: ALERT_RED },
  { key: 'profile',  icon: 'person',         label: 'me',       color: CAROLINA },
];

export default function PieTabBar({ active, onChange, badges, profilePictureUri }: Props) {
  const { theme, isNewTheme } = useTheme();
  const colors = theme.colors;

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      {/* Same layout/icons in both themes; light gets a softer shadow on paper */}
      <View style={[styles.bar, { backgroundColor: colors.surface, borderColor: colors.border, shadowOpacity: isNewTheme ? 0.4 : 0.10 }]}>
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
                <View style={[styles.avatarWrap, isActive && { borderColor: item.color, borderWidth: 2.5 }]}>
                  <Image source={{ uri: profilePictureUri! }} style={styles.avatar} />
                </View>
              ) : (
                <View style={[styles.iconBubble, isActive && { backgroundColor: item.color }]}>
                  <Ionicons
                    name={item.icon}
                    size={22}
                    color={isActive ? '#FFFFFF' : TAB_INACTIVE}
                  />
                </View>
              )}
              {badge > 0 && (
                <View style={[styles.badge, { backgroundColor: ALERT_RED }]}>
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
