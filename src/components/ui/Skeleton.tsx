/**
 * Skeleton loader components for smooth loading states
 * Shows content shapes instead of spinners for better perceived performance
 */
import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, ViewStyle } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function Skeleton({ width = '100%', height = 20, borderRadius = 4, style }: SkeletonProps) {
  const { theme, isNewTheme } = useTheme();
  const colors = theme.colors;
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: isNewTheme ? colors.surfaceAlt : '#e5e7eb',
          opacity,
        },
        style,
      ]}
    />
  );
}

// Pre-built skeleton layouts for common patterns

export function SkeletonCard() {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Skeleton width={40} height={40} borderRadius={20} />
        <View style={styles.cardHeaderText}>
          <Skeleton width={120} height={16} />
          <Skeleton width={80} height={12} style={{ marginTop: 6 }} />
        </View>
      </View>
      <Skeleton width="100%" height={14} style={{ marginTop: 12 }} />
      <Skeleton width="80%" height={14} style={{ marginTop: 8 }} />
      <Skeleton width="60%" height={14} style={{ marginTop: 8 }} />
    </View>
  );
}

export function SkeletonListItem() {
  return (
    <View style={styles.listItem}>
      <Skeleton width={48} height={48} borderRadius={24} />
      <View style={styles.listItemText}>
        <Skeleton width={140} height={16} />
        <Skeleton width={200} height={12} style={{ marginTop: 6 }} />
      </View>
    </View>
  );
}

export function SkeletonFeedCard() {
  const { theme, isNewTheme } = useTheme();
  const colors = theme.colors;

  return (
    <View style={[styles.feedCard, {
      backgroundColor: isNewTheme ? colors.surface : '#fff',
      borderColor: isNewTheme ? colors.border : '#e5e7eb',
    }]}>
      <View style={styles.feedCardHeader}>
        <Skeleton width={36} height={36} borderRadius={18} />
        <View style={styles.feedCardHeaderText}>
          <Skeleton width={100} height={14} />
          <Skeleton width={60} height={10} style={{ marginTop: 4 }} />
        </View>
        <Skeleton width={60} height={24} borderRadius={12} style={{ marginLeft: 'auto' }} />
      </View>
      <Skeleton width="90%" height={18} style={{ marginTop: 12 }} />
      <Skeleton width="100%" height={14} style={{ marginTop: 8 }} />
      <Skeleton width="70%" height={14} style={{ marginTop: 6 }} />
      <View style={styles.feedCardTags}>
        <Skeleton width={70} height={24} borderRadius={12} />
        <Skeleton width={90} height={24} borderRadius={12} />
        <Skeleton width={60} height={24} borderRadius={12} />
      </View>
    </View>
  );
}

export function SkeletonProfile() {
  return (
    <View style={styles.profile}>
      <Skeleton width={100} height={100} borderRadius={50} />
      <Skeleton width={150} height={20} style={{ marginTop: 16 }} />
      <Skeleton width={200} height={14} style={{ marginTop: 8 }} />
      <View style={styles.profileStats}>
        <View style={styles.profileStat}>
          <Skeleton width={40} height={24} />
          <Skeleton width={60} height={12} style={{ marginTop: 4 }} />
        </View>
        <View style={styles.profileStat}>
          <Skeleton width={40} height={24} />
          <Skeleton width={60} height={12} style={{ marginTop: 4 }} />
        </View>
        <View style={styles.profileStat}>
          <Skeleton width={40} height={24} />
          <Skeleton width={60} height={12} style={{ marginTop: 4 }} />
        </View>
      </View>
    </View>
  );
}

export function SkeletonMessage() {
  return (
    <View style={styles.message}>
      <Skeleton width={36} height={36} borderRadius={18} />
      <View style={styles.messageBubble}>
        <Skeleton width={180} height={14} />
        <Skeleton width={120} height={14} style={{ marginTop: 4 }} />
      </View>
    </View>
  );
}

export function SkeletonConversation() {
  return (
    <View style={styles.conversation}>
      <Skeleton width={56} height={56} borderRadius={28} />
      <View style={styles.conversationText}>
        <Skeleton width={120} height={16} />
        <Skeleton width={180} height={12} style={{ marginTop: 6 }} />
      </View>
      <View style={styles.conversationRight}>
        <Skeleton width={40} height={10} />
      </View>
    </View>
  );
}

// Loading list helpers
export function SkeletonFeedList({ count = 3 }: { count?: number }) {
  return (
    <View style={styles.list}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonFeedCard key={i} />
      ))}
    </View>
  );
}

export function SkeletonConversationList({ count = 5 }: { count?: number }) {
  return (
    <View>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonConversation key={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardHeaderText: {
    marginLeft: 12,
    flex: 1,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  listItemText: {
    marginLeft: 12,
    flex: 1,
  },
  feedCard: {
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  feedCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  feedCardHeaderText: {
    marginLeft: 10,
  },
  feedCardTags: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  profile: {
    alignItems: 'center',
    padding: 20,
  },
  profileStats: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 30,
  },
  profileStat: {
    alignItems: 'center',
  },
  message: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 8,
    paddingHorizontal: 16,
  },
  messageBubble: {
    marginLeft: 8,
    padding: 12,
    borderRadius: 16,
  },
  conversation: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  conversationText: {
    flex: 1,
    marginLeft: 12,
  },
  conversationRight: {
    alignItems: 'flex-end',
  },
  list: {
    paddingTop: 12,
  },
});
