import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { notificationService } from '../services/notificationService';
import { supabase } from '../config/supabase';
import { colors, typography, spacing, borderRadius, shadows } from '../theme/designSystem';

export default function NotificationsScreen({ navigation }: any) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    if (!user) return;

    try {
      const data = await notificationService.getUserNotifications(user.id);
      setNotifications(data);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadNotifications();
  };

  const handleNotificationPress = async (notification: any) => {
    // Mark as read
    await notificationService.markAsRead(notification.id);

    // Update local state
    setNotifications(prev =>
      prev.map(n => n.id === notification.id ? { ...n, read: true } : n)
    );

    // Handle navigation based on notification type
    switch (notification.type) {
      case 'message':
      case 'new_message':
        // Navigate to messages - would need conversation ID to navigate to specific chat
        if (notification.data?.conversationId) {
          // TODO: Fetch conversation details and navigate
          navigation?.navigate?.('Messages');
        } else {
          navigation?.navigate?.('Messages');
        }
        break;

      case 'connection_request':
      case 'connection_accepted':
        navigation?.navigate?.('Connections');
        break;

      case 'application_received':
        // Navigate to applications review screen
        if (notification.related_id && notification.related_type === 'pursuit') {
          await navigateToPod(notification.related_id, 'applications');
        } else if (notification.data?.pursuitId) {
          await navigateToPod(notification.data.pursuitId, 'applications');
        } else {
          navigation?.navigate?.('Pods');
        }
        break;

      case 'time_proposal':
      case 'kickoff_activated':
        // Navigate to kickoff scheduling screen
        if (notification.related_id && notification.related_type === 'pursuit') {
          await navigateToPod(notification.related_id, 'kickoff');
        } else if (notification.data?.pursuitId) {
          await navigateToPod(notification.data.pursuitId, 'kickoff');
        } else {
          navigation?.navigate?.('Pods');
        }
        break;

      case 'team_board_update':
        // Navigate directly to team board
        if (notification.related_id && notification.related_type === 'pursuit') {
          navigation?.navigate?.('TeamBoard', { pursuitId: notification.related_id });
        } else if (notification.data?.pursuitId) {
          navigation?.navigate?.('TeamBoard', { pursuitId: notification.data.pursuitId });
        } else {
          navigation?.navigate?.('Pods');
        }
        break;

      case 'application_accepted':
      case 'application_rejected':
      case 'min_team_size_reached':
      case 'kickoff_scheduled':
      case 'kickoff_scheduled_creator':
      case 'kickoff_scheduled_team':
        // Other pod-related notifications - navigate to the pod detail
        if (notification.related_id && notification.related_type === 'pursuit') {
          await navigateToPod(notification.related_id);
        } else if (notification.data?.pursuitId) {
          await navigateToPod(notification.data.pursuitId);
        } else {
          navigation?.navigate?.('Pods');
        }
        break;

      case 'meeting':
      case 'new_meeting':
        // Navigate to calendar
        navigation?.navigate?.('Calendar');
        break;

      case 'member_removed':
        // Navigate to removal reason screen
        navigation?.navigate?.('RemovalReason', {
          pursuitTitle: notification.data?.pursuitTitle || 'Unknown Pursuit',
          reason: notification.data?.removalReason || 'No reason provided',
          removedAt: notification.data?.removedAt || notification.created_at,
        });
        break;

      default:
        // Unknown notification type
        console.log('Unknown notification type:', notification.type);
    }
  };

  const navigateToPod = async (pursuitId: string, subScreen?: string) => {
    try {
      // Fetch the full pod/pursuit data
      const { data: pursuit, error } = await supabase
        .from('pursuits')
        .select(`
          *,
          profiles:creator_id (
            id,
            email,
            name
          )
        `)
        .eq('id', pursuitId)
        .single();

      if (error || !pursuit) {
        console.error('Error fetching pursuit:', error);
        // Fallback to Pods tab
        navigation?.navigate?.('Pods');
        return;
      }

      // Navigate to pod detail screen with optional sub-screen
      navigation?.navigate?.('PodDetail', { pod: pursuit, subScreen });
    } catch (error) {
      console.error('Error navigating to pod:', error);
      navigation?.navigate?.('Pods');
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'message':
      case 'new_message':
        return 'chatbubble';
      case 'connection_request':
      case 'connection_accepted':
        return 'people';
      case 'application_received':
      case 'application_accepted':
      case 'application_rejected':
        return 'document-text';
      case 'kickoff_activated':
      case 'time_proposal':
        return 'time';
      case 'min_team_size_reached':
      case 'team_board_update':
        return 'people-circle';
      case 'kickoff_scheduled':
      case 'meeting':
      case 'new_meeting':
        return 'calendar';
      case 'member_removed':
        return 'person-remove';
      default:
        return 'notifications';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 7) {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } else if (days > 0) {
      return `${days}d ago`;
    } else if (hours > 0) {
      return `${hours}h ago`;
    } else if (minutes > 0) {
      return `${minutes}m ago`;
    } else {
      return 'Just now';
    }
  };

  const renderNotification = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={[styles.notificationCard, !item.read && styles.unreadCard]}
      onPress={() => handleNotificationPress(item)}
    >
      <View style={[styles.iconContainer, !item.read && styles.unreadIcon]}>
        <Ionicons
          name={getNotificationIcon(item.type) as any}
          size={24}
          color={!item.read ? colors.primary : colors.textSecondary}
        />
      </View>
      <View style={styles.notificationContent}>
        <Text style={[styles.notificationTitle, !item.read && styles.unreadText]}>
          {item.title}
        </Text>
        <Text style={styles.notificationBody}>{item.body}</Text>
        <Text style={styles.timestamp}>{formatTimestamp(item.created_at)}</Text>
      </View>
      {!item.read && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.loadingText}>Loading notifications...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notifications</Text>
      </View>

      {notifications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="notifications-off-outline" size={64} color={colors.textSecondary} />
          <Text style={styles.emptyText}>No notifications yet</Text>
          <Text style={styles.emptySubtext}>We'll notify you when something happens</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          renderItem={renderNotification}
          keyExtractor={item => item.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingTop: 50,
    paddingBottom: spacing.base,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  headerTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    marginTop: spacing.lg,
  },
  emptySubtext: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  listContent: {
    padding: spacing.base,
  },
  notificationCard: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    padding: spacing.base,
    borderRadius: borderRadius.base,
    marginBottom: spacing.sm,
    ...shadows.base,
  },
  unreadCard: {
    backgroundColor: colors.primaryLight,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.base,
  },
  unreadIcon: {
    backgroundColor: colors.primary + '20',
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  unreadText: {
    fontWeight: typography.fontWeight.bold,
  },
  notificationBody: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    lineHeight: 18,
  },
  timestamp: {
    fontSize: typography.fontSize.xs,
    color: colors.textTertiary,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
    position: 'absolute',
    top: spacing.base,
    right: spacing.base,
  },
});
