import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import PieTabBar, { PieTabKey } from './PieTabBar';

interface AppTabBarProps {
  isNewTheme: boolean;
  themeColors: any;
  currentScreen: string;
  unreadMessageCount: number;
  locallyReadCount: number;
  badgeCounts: {
    messages: number;
    connections: number;
    applications: number;
    pods: number;
    calendar: number;
    notifications: number;
  };
  onTabPress: (target: string) => void;
}

export default function AppTabBar({
  isNewTheme,
  themeColors,
  currentScreen,
  unreadMessageCount,
  locallyReadCount,
  badgeCounts,
  onTabPress,
}: AppTabBarProps) {
  return isNewTheme ? (
    <PieTabBar
      active={
        currentScreen === 'Feed' ? 'feed'
        : currentScreen === 'Pods' ? 'pods'
        : currentScreen === 'Calendar' ? 'calendar'
        : currentScreen === 'Messages' ? 'messages'
        : currentScreen === 'Notifications' ? 'alerts'
        : currentScreen === 'Profile' ? 'profile'
        : 'feed'
      }
      onChange={(k: PieTabKey) => {
        const map: Record<PieTabKey, string> = {
          feed: 'Feed', pods: 'Pods', calendar: 'Calendar',
          messages: 'Messages', alerts: 'Notifications', profile: 'Profile',
        };
        onTabPress(map[k]);
      }}
      badges={{
        messages: Math.max(0, unreadMessageCount - locallyReadCount),
        pods: badgeCounts.pods,
        calendar: badgeCounts.calendar,
        alerts: badgeCounts.notifications,
        profile: badgeCounts.connections,
      }}
    />
  ) : (
    <View style={[styles.tabBar, {
      backgroundColor: themeColors.tabBarBackground,
      borderTopColor: themeColors.tabBarBorder,
    }]}>
      <TouchableOpacity style={[styles.tab, { borderRightColor: isNewTheme ? themeColors.border : '#f0f0f0' }]} onPress={() => onTabPress('Feed')}>
        <Text style={[styles.tabIcon, { opacity: currentScreen === 'Feed' ? 1 : 0.4 }]}>🌊</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.tab, { borderRightColor: isNewTheme ? themeColors.border : '#f0f0f0' }]}
        onPress={() => onTabPress('Messages')}
      >
        <View style={styles.tabContent}>
          <Text style={[styles.tabIcon, { opacity: currentScreen === 'Messages' ? 1 : 0.4 }]}>🫧</Text>
          {(() => {
            const effectiveUnreadCount = Math.max(0, unreadMessageCount - locallyReadCount);
            return effectiveUnreadCount > 0 && currentScreen !== 'Messages' ? (
              <View style={[styles.badge, { backgroundColor: isNewTheme ? themeColors.accentGreen : '#ef4444' }]}>
                <Text style={[styles.badgeText, { color: isNewTheme ? themeColors.background : '#fff' }]}>{effectiveUnreadCount}</Text>
              </View>
            ) : null;
          })()}
        </View>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.tab, { borderRightColor: isNewTheme ? themeColors.border : '#f0f0f0' }]}
        onPress={() => onTabPress('Pods')}
      >
        <View style={styles.tabContent}>
          <Text style={[styles.tabIcon, { opacity: currentScreen === 'Pods' ? 1 : 0.4 }]}>🐳</Text>
          {badgeCounts.pods > 0 && (
            <View style={[styles.badge, { backgroundColor: isNewTheme ? themeColors.accentGreen : '#ef4444' }]}>
              <Text style={[styles.badgeText, { color: isNewTheme ? themeColors.background : '#fff' }]}>{badgeCounts.pods}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.tab, { borderRightColor: isNewTheme ? themeColors.border : '#f0f0f0' }]}
        onPress={() => onTabPress('Calendar')}
      >
        <View style={styles.tabContent}>
          <Text style={[styles.tabIcon, { opacity: currentScreen === 'Calendar' ? 1 : 0.4 }]}>🌙</Text>
          {badgeCounts.calendar > 0 && (
            <View style={[styles.badge, { backgroundColor: isNewTheme ? themeColors.accentGreen : '#ef4444' }]}>
              <Text style={[styles.badgeText, { color: isNewTheme ? themeColors.background : '#fff' }]}>{badgeCounts.calendar}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.tab, { borderRightColor: isNewTheme ? themeColors.border : '#f0f0f0' }]}
        onPress={() => onTabPress('Notifications')}
      >
        <View style={styles.tabContent}>
          <Text style={[styles.tabIcon, { opacity: currentScreen === 'Notifications' ? 1 : 0.4 }]}>✦</Text>
          {badgeCounts.notifications > 0 && (
            <View style={[styles.badge, { backgroundColor: isNewTheme ? themeColors.accentGreen : '#ef4444' }]}>
              <Text style={[styles.badgeText, { color: isNewTheme ? themeColors.background : '#fff' }]}>{badgeCounts.notifications}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.tab, { borderRightWidth: 0 }]}
        onPress={() => onTabPress('Profile')}
      >
        <View style={styles.tabContent}>
          <Text style={[styles.tabIcon, { opacity: currentScreen === 'Profile' ? 1 : 0.4 }]}>🪷</Text>
          {badgeCounts.connections > 0 && (
            <View style={[styles.badge, { backgroundColor: isNewTheme ? themeColors.accentGreen : '#ef4444' }]}>
              <Text style={[styles.badgeText, { color: isNewTheme ? themeColors.background : '#fff' }]}>{badgeCounts.connections}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingBottom: 20,
    paddingTop: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRightWidth: 1,
    borderRightColor: '#f0f0f0',
  },
  tabContent: {
    position: 'relative',
    alignItems: 'center',
  },
  tabIcon: {
    fontSize: 26,
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -10,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
});
