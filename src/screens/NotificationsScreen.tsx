import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { notificationService } from '../services/notificationService';
import { supabase } from '../config/supabase';
import { colors as legacyColors, typography, spacing } from '../theme/designSystem';
import { useTheme } from '../theme/ThemeContext';
import GrainTexture from '../components/ui/GrainTexture';
import { getThemedStyles } from '../theme/themedStyles';

export default function NotificationsScreen({ navigation }: any) {
  const { user } = useAuth();
  const { theme, isNewTheme } = useTheme();
  const colors = theme.colors;
  const themedStyles = getThemedStyles(colors, isNewTheme);
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
      case 'pod_chat':
      case 'pod_chat_message':
        // Navigate to messages - would need conversation ID to navigate to specific chat
        if (notification.data?.conversationId || notification.data?.pursuitId) {
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
      case 'all_proposals_submitted':
        // Time proposal notifications are for creators - go to kickoff scheduling
        if (notification.related_id && notification.related_type === 'pursuit') {
          await navigateToPod(notification.related_id, 'kickoff', true);
        } else if (notification.data?.pursuitId) {
          await navigateToPod(notification.data.pursuitId, 'kickoff', true);
        } else {
          navigation?.navigate?.('Pods');
        }
        break;

      case 'kickoff_activated':
        // Kickoff activated - creators go to scheduling, team members go to propose times
        if (notification.related_id && notification.related_type === 'pursuit') {
          await navigateToPodWithCreatorCheck(notification.related_id, true);
        } else if (notification.data?.pursuitId) {
          await navigateToPodWithCreatorCheck(notification.data.pursuitId, true);
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

      case 'meeting_invitation':
        // Navigate to meeting invitation response screen
        if (notification.related_id) {
          navigation?.navigate?.('MeetingInvitation', { meetingId: notification.related_id });
        } else if (notification.data?.meetingId) {
          navigation?.navigate?.('MeetingInvitation', { meetingId: notification.data.meetingId });
        } else {
          navigation?.navigate?.('Calendar');
        }
        break;

      case 'interview_scheduling_requested':
        // Applicant needs to propose interview times
        if (notification.related_id || notification.data?.applicationId) {
          const applicationId = notification.related_id || notification.data?.applicationId;
          const pursuitId = notification.data?.pursuitId;
          navigation?.navigate?.('InterviewTimeSlotProposal', {
            applicationId,
            pursuitId,
          });
        }
        break;

      case 'interview_times_submitted':
        // Creator needs to schedule the interview
        if (notification.related_id || notification.data?.applicationId) {
          const applicationId = notification.related_id || notification.data?.applicationId;
          const pursuitId = notification.data?.pursuitId;
          navigation?.navigate?.('InterviewScheduling', {
            applicationId,
            pursuitId,
          });
        }
        break;

      case 'interview_scheduled':
        // Interview has been scheduled - go to calendar
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

      case 'member_left':
        // Navigate to member left screen (reusing RemovalReason with different title)
        navigation?.navigate?.('MemberLeft', {
          pursuitTitle: notification.data?.pursuitTitle || 'Unknown Pursuit',
          memberName: notification.data?.memberName || 'A team member',
          reason: notification.data?.leaveReason || 'No reason provided',
          leftAt: notification.data?.leftAt || notification.created_at,
        });
        break;

      default:
        // Unknown notification type
        console.log('Unknown notification type:', notification.type);
    }
  };

  const navigateToPod = async (pursuitId: string, subScreen?: string, fromNotifications?: boolean) => {
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

      // Navigate to pod detail screen with optional sub-screen and fromNotifications flag
      navigation?.navigate?.('PodDetail', { pod: pursuit, subScreen, fromNotifications });
    } catch (error) {
      console.error('Error navigating to pod:', error);
      navigation?.navigate?.('Pods');
    }
  };

  // Navigate to pod with creator check - creators go to kickoff scheduling, team members go to propose times
  const navigateToPodWithCreatorCheck = async (pursuitId: string, fromNotifications?: boolean) => {
    try {
      // Fetch the pursuit data to check if user is creator
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
        navigation?.navigate?.('Pods');
        return;
      }

      // Check if user is the creator
      const isCreator = pursuit.creator_id === user?.id;

      // Navigate to appropriate sub-screen based on role
      const subScreen = isCreator ? 'kickoff' : 'propose_times';
      navigation?.navigate?.('PodDetail', { pod: pursuit, subScreen, fromNotifications });
    } catch (error) {
      console.error('Error navigating to pod:', error);
      navigation?.navigate?.('Pods');
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'message':
      case 'new_message':
      case 'pod_chat':
      case 'pod_chat_message':
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
      case 'meeting_invitation':
        return 'calendar';
      case 'member_removed':
        return 'person-remove';
      case 'member_left':
        return 'exit-outline';
      case 'interview_scheduling_requested':
      case 'interview_times_submitted':
      case 'interview_scheduled':
        return 'videocam';
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
      style={[
        themedStyles.card,
        styles.notificationCard,
        !item.read && [styles.unreadCard, { backgroundColor: isNewTheme ? colors.surface : legacyColors.primaryLight, borderLeftColor: colors.primary }]
      ]}
      onPress={() => handleNotificationPress(item)}
    >
      <View style={[
        themedStyles.iconContainer,
        styles.iconContainer,
        !item.read && { backgroundColor: isNewTheme ? colors.accentGreen + '20' : colors.primary + '20' }
      ]}>
        <Ionicons
          name={getNotificationIcon(item.type) as any}
          size={24}
          color={!item.read ? themedStyles.accentIconColor : colors.textSecondary}
        />
      </View>
      <View style={styles.notificationContent}>
        <Text style={[themedStyles.cardTitle, styles.notificationTitle, !item.read && styles.unreadText]}>
          {item.title}
        </Text>
        <Text style={[themedStyles.cardDescription, styles.notificationBody]}>{item.body}</Text>
        <Text style={[themedStyles.cardSmallText, styles.timestamp]}>{formatTimestamp(item.created_at)}</Text>
      </View>
      {!item.read && <View style={[styles.unreadDot, { backgroundColor: themedStyles.accentIconColor }]} />}
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={[themedStyles.container, styles.centerContainer]}>
        <StatusBar barStyle={isNewTheme ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
        {isNewTheme && <GrainTexture opacity={0.06} />}
        <Text style={[themedStyles.bodyText, styles.loadingText]}>Loading notifications...</Text>
      </View>
    );
  }

  return (
    <View style={themedStyles.container}>
      <StatusBar barStyle={isNewTheme ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      {isNewTheme && <GrainTexture opacity={0.06} />}
      <View style={themedStyles.header}>
        <Text style={themedStyles.headerTitle}>Notifications</Text>
      </View>

      {notifications.length === 0 ? (
        <View style={themedStyles.emptyContainer}>
          <Ionicons name="notifications-off-outline" size={64} color={colors.textSecondary} />
          <Text style={themedStyles.emptyText}>No notifications yet</Text>
          <Text style={themedStyles.emptySubtext}>We'll notify you when something happens</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          renderItem={renderNotification}
          keyExtractor={item => item.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={themedStyles.refreshColor} />
          }
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  centerContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    // Additional styling beyond themedStyles.bodyText
  },
  listContent: {
    padding: spacing.base,
  },
  notificationCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  unreadCard: {
    borderLeftWidth: 3,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: spacing.base,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    marginBottom: spacing.xs,
  },
  unreadText: {
    fontWeight: typography.fontWeight.bold,
  },
  notificationBody: {
    marginBottom: spacing.xs,
    lineHeight: 18,
  },
  timestamp: {
    // Additional styling beyond themedStyles.cardSmallText
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    position: 'absolute',
    top: spacing.base,
    right: spacing.base,
  },
});
