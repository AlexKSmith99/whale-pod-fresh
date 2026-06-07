import React from 'react';
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

// Both themes share the floating pill tab bar (same layout, icons, and
// positioning); PieTabBar themes its own colors per mode.
export default function AppTabBar({
  currentScreen,
  unreadMessageCount,
  locallyReadCount,
  badgeCounts,
  onTabPress,
}: AppTabBarProps) {
  return (
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
  );
}
