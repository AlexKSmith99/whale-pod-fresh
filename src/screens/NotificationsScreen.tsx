import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, StatusBar, Dimensions, Modal, TouchableWithoutFeedback, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { notificationService } from '../services/notificationService';
import { supabase } from '../config/supabase';
import { useTheme } from '../theme/ThemeContext';
import GrainTexture from '../components/ui/GrainTexture';
import { getThemedStyles } from '../theme/themedStyles';

const { height: SCREEN_H } = Dimensions.get('window');
// Each notification card takes up 1/7 of available space (below header + filter)
const CARD_HEIGHT = Math.floor((SCREEN_H - 180) / 7);

export default function NotificationsScreen({ navigation }: any) {
  const { user } = useAuth();
  const { theme, isNewTheme } = useTheme();
  const colors = theme.colors;
  const themedStyles = getThemedStyles(colors, isNewTheme);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [podFilter, setPodFilter] = useState<string | null>(null); // null = All
  const [podNames, setPodNames] = useState<Record<string, string>>({}); // pursuitId → title
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    if (!user) return;
    try {
      const data = await notificationService.getUserNotifications(user.id);
      setNotifications(data);

      // Extract unique pursuit IDs and fetch pod names for filter
      const pursuitIds = new Set<string>();
      data.forEach((n: any) => {
        const pid = n.related_type === 'pursuit' ? n.related_id : n.data?.pursuitId;
        if (pid) pursuitIds.add(pid);
      });

      if (pursuitIds.size > 0) {
        const { data: pursuits } = await supabase
          .from('pursuits')
          .select('id, title')
          .in('id', Array.from(pursuitIds));
        if (pursuits) {
          const map: Record<string, string> = {};
          pursuits.forEach((p: any) => { map[p.id] = p.title; });
          setPodNames(map);
        }
      }
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

  // Get the pursuit ID from a notification
  const getPursuitId = (n: any): string | null => {
    if (n.related_type === 'pursuit' && n.related_id) return n.related_id;
    return n.data?.pursuitId || null;
  };

  // Filter pods that actually have notifications
  const availablePods = useMemo(() => {
    const pods: { id: string; title: string }[] = [];
    const seen = new Set<string>();
    notifications.forEach(n => {
      const pid = getPursuitId(n);
      if (pid && podNames[pid] && !seen.has(pid)) {
        seen.add(pid);
        pods.push({ id: pid, title: podNames[pid] });
      }
    });
    return pods.sort((a, b) => a.title.localeCompare(b.title));
  }, [notifications, podNames]);

  // Filtered notifications
  const filteredNotifications = useMemo(() => {
    if (!podFilter) return notifications;
    return notifications.filter(n => getPursuitId(n) === podFilter);
  }, [notifications, podFilter]);

  const handleNotificationPress = async (notification: any) => {
    await notificationService.markAsRead(notification.id);
    setNotifications(prev =>
      prev.map(n => n.id === notification.id ? { ...n, read: true } : n)
    );

    switch (notification.type) {
      case 'message':
      case 'new_message':
      case 'pod_chat':
      case 'pod_chat_message':
        navigation?.navigate?.('Messages');
        break;
      case 'connection_request':
      case 'connection_accepted':
        navigation?.navigate?.('Connections');
        break;
      case 'application_received':
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
        if (notification.related_id && notification.related_type === 'pursuit') {
          await navigateToPod(notification.related_id, 'kickoff', true);
        } else if (notification.data?.pursuitId) {
          await navigateToPod(notification.data.pursuitId, 'kickoff', true);
        } else {
          navigation?.navigate?.('Pods');
        }
        break;
      case 'kickoff_activated':
        if (notification.related_id && notification.related_type === 'pursuit') {
          await navigateToPodWithCreatorCheck(notification.related_id, true);
        } else if (notification.data?.pursuitId) {
          await navigateToPodWithCreatorCheck(notification.data.pursuitId, true);
        } else {
          navigation?.navigate?.('Pods');
        }
        break;
      case 'team_board_update':
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
        navigation?.navigate?.('Calendar');
        break;
      case 'meeting_invitation':
        if (notification.related_id) {
          navigation?.navigate?.('MeetingInvitation', { meetingId: notification.related_id });
        } else if (notification.data?.meetingId) {
          navigation?.navigate?.('MeetingInvitation', { meetingId: notification.data.meetingId });
        } else {
          navigation?.navigate?.('Calendar');
        }
        break;
      case 'interview_scheduling_requested':
        if (notification.related_id || notification.data?.applicationId) {
          navigation?.navigate?.('InterviewTimeSlotProposal', {
            applicationId: notification.related_id || notification.data?.applicationId,
            pursuitId: notification.data?.pursuitId,
          });
        }
        break;
      case 'interview_times_submitted':
        if (notification.related_id || notification.data?.applicationId) {
          navigation?.navigate?.('InterviewScheduling', {
            applicationId: notification.related_id || notification.data?.applicationId,
            pursuitId: notification.data?.pursuitId,
          });
        }
        break;
      case 'interview_scheduled':
        navigation?.navigate?.('Calendar');
        break;
      case 'member_removed':
        navigation?.navigate?.('RemovalReason', {
          pursuitTitle: notification.data?.pursuitTitle || 'Unknown Pursuit',
          reason: notification.data?.removalReason || 'No reason provided',
          removedAt: notification.data?.removedAt || notification.created_at,
        });
        break;
      case 'member_left':
        navigation?.navigate?.('MemberLeft', {
          pursuitTitle: notification.data?.pursuitTitle || 'Unknown Pursuit',
          memberName: notification.data?.memberName || 'A team member',
          reason: notification.data?.leaveReason || 'No reason provided',
          leftAt: notification.data?.leftAt || notification.created_at,
        });
        break;
      default:
        console.log('Unknown notification type:', notification.type);
    }
  };

  const navigateToPod = async (pursuitId: string, subScreen?: string, fromNotifications?: boolean) => {
    try {
      const { data: pursuit, error } = await supabase
        .from('pursuits')
        .select('*, profiles:creator_id (id, email, name)')
        .eq('id', pursuitId)
        .single();
      if (error || !pursuit) {
        navigation?.navigate?.('Pods');
        return;
      }
      navigation?.navigate?.('PodDetail', { pod: pursuit, subScreen, fromNotifications });
    } catch {
      navigation?.navigate?.('Pods');
    }
  };

  const navigateToPodWithCreatorCheck = async (pursuitId: string, fromNotifications?: boolean) => {
    try {
      const { data: pursuit, error } = await supabase
        .from('pursuits')
        .select('*, profiles:creator_id (id, email, name)')
        .eq('id', pursuitId)
        .single();
      if (error || !pursuit) {
        navigation?.navigate?.('Pods');
        return;
      }
      const isCreator = pursuit.creator_id === user?.id;
      navigation?.navigate?.('PodDetail', { pod: pursuit, subScreen: isCreator ? 'kickoff' : 'propose_times', fromNotifications });
    } catch {
      navigation?.navigate?.('Pods');
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'message': case 'new_message': case 'pod_chat': case 'pod_chat_message': return 'chatbubble';
      case 'connection_request': case 'connection_accepted': return 'people';
      case 'application_received': case 'application_accepted': case 'application_rejected': return 'document-text';
      case 'kickoff_activated': case 'time_proposal': return 'time';
      case 'min_team_size_reached': case 'team_board_update': return 'people-circle';
      case 'kickoff_scheduled': case 'meeting': case 'new_meeting': case 'meeting_invitation': return 'calendar';
      case 'member_removed': return 'person-remove';
      case 'member_left': return 'exit-outline';
      case 'review_received': return 'star';
      case 'interview_scheduling_requested': case 'interview_times_submitted': case 'interview_scheduled': return 'videocam';
      default: return 'notifications';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const diff = Date.now() - new Date(timestamp).getTime();
    const mins = Math.floor(diff / 60000);
    const hrs = Math.floor(mins / 60);
    const days = Math.floor(hrs / 24);
    if (days > 7) return new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (days > 0) return `${days}d`;
    if (hrs > 0) return `${hrs}h`;
    if (mins > 0) return `${mins}m`;
    return 'now';
  };

  const renderNotification = ({ item }: { item: any }) => {
    const isUnread = !item.read;
    return (
      <TouchableOpacity
        style={[styles.card, isUnread && styles.cardUnread]}
        onPress={() => handleNotificationPress(item)}
        activeOpacity={0.7}
      >
        {/* Icon */}
        <View style={[styles.iconCircle, isUnread && styles.iconCircleUnread]}>
          <Ionicons
            name={getNotificationIcon(item.type) as any}
            size={20}
            color={isUnread ? '#2D5016' : '#8A8A85'}
          />
        </View>

        {/* Content */}
        <View style={styles.content}>
          <Text style={[styles.title, isUnread && styles.titleUnread]} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.body} numberOfLines={2}>
            {item.body}
          </Text>
        </View>

        {/* Timestamp + unread dot */}
        <View style={styles.meta}>
          <Text style={styles.time}>{formatTimestamp(item.created_at)}</Text>
          {isUnread && <View style={styles.dot} />}
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <StatusBar barStyle={isNewTheme ? 'light-content' : 'dark-content'} />
        {isNewTheme && <GrainTexture opacity={0.06} />}
        <Text style={styles.body}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isNewTheme ? 'light-content' : 'dark-content'} />
      {isNewTheme && <GrainTexture opacity={0.06} />}

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notifications</Text>
      </View>

      {/* Pod filter dropdown */}
      {availablePods.length > 0 && (
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.filterButton, podFilter && styles.filterButtonActive]}
            onPress={() => setShowFilterDropdown(true)}
          >
            <Ionicons name="filter-outline" size={16} color={podFilter ? '#FFFFFF' : '#52524E'} />
            <Text style={[styles.filterButtonText, podFilter && styles.filterButtonTextActive]} numberOfLines={1}>
              {podFilter ? podNames[podFilter] || 'Pod' : 'Filter by pod'}
            </Text>
            <Ionicons name="chevron-down" size={14} color={podFilter ? '#FFFFFF' : '#8A8A85'} />
          </TouchableOpacity>
          {podFilter && (
            <TouchableOpacity style={styles.clearFilter} onPress={() => setPodFilter(null)}>
              <Ionicons name="close-circle" size={18} color="#8A8A85" />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Filter dropdown modal */}
      <Modal visible={showFilterDropdown} transparent animationType="fade" onRequestClose={() => setShowFilterDropdown(false)}>
        <TouchableWithoutFeedback onPress={() => setShowFilterDropdown(false)}>
          <View style={styles.dropdownOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.dropdownContainer}>
                <Text style={styles.dropdownTitle}>Filter by Pod</Text>
                <ScrollView style={styles.dropdownScroll} showsVerticalScrollIndicator={false}>
                  <TouchableOpacity
                    style={[styles.dropdownItem, !podFilter && styles.dropdownItemActive]}
                    onPress={() => { setPodFilter(null); setShowFilterDropdown(false); }}
                  >
                    <Text style={[styles.dropdownItemText, !podFilter && styles.dropdownItemTextActive]}>All Notifications</Text>
                    {!podFilter && <Ionicons name="checkmark" size={18} color="#2D5016" />}
                  </TouchableOpacity>
                  {availablePods.map(pod => {
                    const active = podFilter === pod.id;
                    return (
                      <TouchableOpacity
                        key={pod.id}
                        style={[styles.dropdownItem, active && styles.dropdownItemActive]}
                        onPress={() => { setPodFilter(pod.id); setShowFilterDropdown(false); }}
                      >
                        <Text style={[styles.dropdownItemText, active && styles.dropdownItemTextActive]} numberOfLines={1}>{pod.title}</Text>
                        {active && <Ionicons name="checkmark" size={18} color="#2D5016" />}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Notification list */}
      {filteredNotifications.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="notifications-off-outline" size={48} color="#D6D3CC" />
          <Text style={[styles.body, { marginTop: 12 }]}>No notifications</Text>
        </View>
      ) : (
        <FlatList
          data={filteredNotifications}
          renderItem={renderNotification}
          keyExtractor={item => item.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#2D5016" />
          }
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF9F6',
  },
  header: {
    paddingTop: 60,
    paddingBottom: 12,
    paddingHorizontal: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1B1B18',
    fontFamily: 'PlayfairDisplay_700Bold',
  },

  // Filter
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E8E6E0',
    gap: 8,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F2F0EB',
  },
  filterButtonActive: {
    backgroundColor: '#2D5016',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#52524E',
    fontFamily: 'Sora_400Regular',
    maxWidth: 180,
  },
  filterButtonTextActive: {
    color: '#FFFFFF',
  },
  clearFilter: {
    padding: 4,
  },

  // Dropdown modal
  dropdownOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'flex-start',
    paddingTop: 160,
    paddingHorizontal: 20,
  },
  dropdownContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    maxHeight: 360,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
  dropdownTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1B1B18',
    fontFamily: 'Sora_600SemiBold',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 8,
  },
  dropdownScroll: {
    paddingBottom: 8,
  },
  dropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F2F0EB',
  },
  dropdownItemActive: {
    backgroundColor: '#F2F7F0',
  },
  dropdownItemText: {
    fontSize: 15,
    color: '#1B1B18',
    fontFamily: 'Sora_400Regular',
    flex: 1,
    marginRight: 8,
  },
  dropdownItemTextActive: {
    color: '#2D5016',
    fontWeight: '600',
    fontFamily: 'Sora_600SemiBold',
  },

  // List
  list: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 100,
  },

  // Card — condensed, uniform height
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    height: CARD_HEIGHT,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E8E6E0',
  },
  cardUnread: {
    backgroundColor: '#F2F7F0',
  },

  // Icon
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F2F0EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  iconCircleUnread: {
    backgroundColor: '#E4EDDE',
  },

  // Content
  content: {
    flex: 1,
    marginRight: 8,
    justifyContent: 'center',
  },
  title: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1B1B18',
    fontFamily: 'Sora_600SemiBold',
    marginBottom: 2,
  },
  titleUnread: {
    fontWeight: '700',
  },
  body: {
    fontSize: 14,
    color: '#8A8A85',
    fontFamily: 'Sora_400Regular',
    lineHeight: 18,
  },

  // Meta
  meta: {
    alignItems: 'flex-end',
    gap: 6,
  },
  time: {
    fontSize: 12,
    color: '#8A8A85',
    fontFamily: 'Sora_400Regular',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2D5016',
  },

  // Empty
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
