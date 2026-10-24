import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, StatusBar, Dimensions, Modal, TouchableWithoutFeedback, ScrollView, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { notificationService } from '../services/notificationService';
import { supabase } from '../config/supabase';
import { useTheme } from '../theme/ThemeContext';
import GrainTexture from '../components/ui/GrainTexture';
import { getThemedStyles } from '../theme/themedStyles';
import { editorial } from '../theme/designSystem';

const { height: SCREEN_H } = Dimensions.get('window');

interface NotificationActor {
  id: string;
  name?: string | null;
  profile_picture?: string | null;
}

interface NotificationGroup {
  key: string;
  ids: string[];          // every row folded in, so a tap marks them all read
  item: any;              // newest row — supplies title, body, type, timestamp
  actors: NotificationActor[];
  unread: boolean;
}

/**
 * Folds notifications about the same thing into one row.
 *
 * Several people applying to the same pod produces one entry per applicant;
 * showing them as separate rows buries everything else. Grouping on
 * (type, related_id) collapses them and lets the row carry both faces.
 *
 * Rows without a related_id are never grouped — they have no shared subject,
 * so merging them would fold together unrelated events.
 */
function groupNotifications(rows: any[]): NotificationGroup[] {
  const groups: NotificationGroup[] = [];
  const byKey = new Map<string, NotificationGroup>();

  for (const row of rows) {
    const key = row.related_id ? `${row.type}:${row.related_id}` : `solo:${row.id}`;
    const actor: NotificationActor | null = row.actor?.id ? row.actor : null;

    const existing = byKey.get(key);
    if (!existing) {
      const group: NotificationGroup = {
        key,
        ids: [row.id],
        item: row,              // rows arrive newest-first, so the first wins
        actors: actor ? [actor] : [],
        unread: !row.read,
      };
      byKey.set(key, group);
      groups.push(group);
      continue;
    }

    existing.ids.push(row.id);
    // Unread if ANY folded row is unread — otherwise a group could look read
    // while still holding something you haven't seen.
    existing.unread = existing.unread || !row.read;
    if (actor && !existing.actors.some(a => a.id === actor.id)) {
      existing.actors.push(actor);
    }
  }

  return groups;
}
// Each notification card takes up 1/7 of available space (below header + filter)
const CARD_HEIGHT = Math.floor((SCREEN_H - 180) / 7);

export default function NotificationsScreen({ navigation }: any) {
  const { user } = useAuth();
  const { theme, isNewTheme } = useTheme();
  const colors = theme.colors;
  const themedStyles = getThemedStyles(colors, isNewTheme);
  const styles = React.useMemo(() => makeStyles(colors, isNewTheme), [colors, isNewTheme]);
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

  // Group after filtering, so a pod filter can't split a group in half.
  const groupedNotifications = useMemo(
    () => groupNotifications(filteredNotifications),
    [filteredNotifications]
  );

  const handleNotificationPress = async (notification: any, groupIds?: string[]) => {
    // A grouped row stands for several notifications, so opening it has to
    // clear all of them — otherwise the badge keeps counting rows the user can
    // no longer see separately.
    const ids = groupIds?.length ? groupIds : [notification.id];
    await Promise.all(ids.map(id => notificationService.markAsRead(id)));
    setNotifications(prev =>
      prev.map(n => ids.includes(n.id) ? { ...n, read: true } : n)
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
      case 'role_edit_requested':
      case 'role_edit_approved':
        // Both route to the Team Board → Roles tab for the relevant pod
        if (notification.data?.pursuitId) {
          navigation?.navigate?.('TeamBoard', {
            pursuitId: notification.data.pursuitId,
            subTab: 'roles',
          });
        } else {
          navigation?.navigate?.('Pods');
        }
        break;
      case 'edit_access_request':
        // Legacy stub for guide/rules/roles — route to the requested page
        if (notification.data?.pursuitId) {
          navigation?.navigate?.('TeamBoard', {
            pursuitId: notification.data.pursuitId,
            subTab: notification.data?.page || 'roles',
          });
        } else {
          navigation?.navigate?.('Pods');
        }
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
      case 'interview_scheduling_requested': case 'interview_times_submitted': case 'interview_scheduled': return 'videocam';
      default: return 'notifications';
    }
  };

  // A small, expressive emoji per notification type — adds a little life
  // alongside the category icon without overwhelming the row.
  const getNotificationEmoji = (type: string) => {
    switch (type) {
      case 'message': case 'new_message': case 'pod_chat': case 'pod_chat_message': return '💬';
      case 'connection_request': case 'connection_accepted': return '🤝';
      case 'application_received': return '📨';
      case 'application_accepted': return '🎉';
      case 'application_rejected': return '🙏';
      case 'min_team_size_reached': return '🐳';
      case 'team_board_update': return '📋';
      case 'kickoff_activated': case 'time_proposal': case 'all_proposals_submitted': return '⏰';
      case 'kickoff_scheduled': case 'kickoff_scheduled_creator': case 'kickoff_scheduled_team': return '🚀';
      case 'meeting': case 'new_meeting': case 'meeting_invitation': return '📅';
      case 'interview_scheduling_requested': case 'interview_times_submitted': case 'interview_scheduled': return '🎤';
      case 'member_removed': case 'member_left': return '👋';
      case 'role_edit_requested': case 'role_edit_approved': return '✏️';
      default: return '🔔';
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

  /** One actor's picture, or their initial when they have no photo. */
  const renderAvatar = (actor: NotificationActor, style: any, fontSize: number) =>
    actor.profile_picture ? (
      <Image key={actor.id} source={{ uri: actor.profile_picture }} style={style} />
    ) : (
      <View key={actor.id} style={[style, styles.avatarFallback]}>
        <Text style={[styles.avatarInitial, { fontSize }]}>
          {(actor.name || '?').charAt(0).toUpperCase()}
        </Text>
      </View>
    );

  /**
   * Leading visual for a row: the actor's face when we know who acted, two
   * overlapping faces when several people did the same thing, and the original
   * typed icon when there's no actor at all — which covers system-triggered
   * events and every notification created before migration 082.
   */
  const renderLeading = (group: NotificationGroup, isUnread: boolean) => {
    const { actors, item } = group;

    if (actors.length === 0) {
      return (
        <View style={[styles.iconCircle, isUnread && styles.iconCircleUnread]}>
          <Ionicons
            name={getNotificationIcon(item.type) as any}
            size={20}
            color={isUnread ? colors.accentGreen : (isNewTheme ? 'rgba(200, 255, 107, 0.55)' : colors.textTertiary)}
          />
        </View>
      );
    }

    if (actors.length === 1) {
      return <View style={styles.avatarWrap}>{renderAvatar(actors[0], styles.avatarSingle, 18)}</View>;
    }

    // Two smaller bubbles, the second tucked under the first.
    return (
      <View style={styles.avatarWrap}>
        {renderAvatar(actors[1], [styles.avatarSmall, styles.avatarBack], 13)}
        {renderAvatar(actors[0], [styles.avatarSmall, styles.avatarFront], 13)}
      </View>
    );
  };

  const renderNotification = ({ item: group }: { item: NotificationGroup }) => {
    const item = group.item;
    const isUnread = group.unread;
    const extra = group.actors.length - 2;

    return (
      <TouchableOpacity
        style={[styles.card, isUnread && styles.cardUnread]}
        onPress={() => handleNotificationPress(item, group.ids)}
        activeOpacity={0.6}
      >
        {/* Left accent bar for unread */}
        {isUnread && <View style={styles.cardAccentBar} pointerEvents="none" />}

        {renderLeading(group, isUnread)}

        {/* Content */}
        <View style={styles.content}>
          <Text style={[styles.title, isUnread && styles.titleUnread]} numberOfLines={1}>
            {item.title} {getNotificationEmoji(item.type)}
          </Text>
          <Text style={styles.body} numberOfLines={2}>
            {item.body}
            {/* The stored title names one person; this is what signals the rest,
                rather than rewriting copy the server wrote. */}
            {group.ids.length > 1 ? `  ·  and ${group.ids.length - 1} more` : ''}
            {extra > 0 ? ` (+${extra})` : ''}
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

  const unreadCount = filteredNotifications.filter((n: any) => !n.read).length;

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isNewTheme ? 'light-content' : 'dark-content'} />
      {isNewTheme && <GrainTexture opacity={0.06} />}

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notifications</Text>
        {unreadCount > 0 && (
          <View style={styles.unreadPill}>
            <Text style={styles.unreadPillText}>{unreadCount} new ✨</Text>
          </View>
        )}
      </View>

      {/* Pod filter dropdown */}
      {availablePods.length > 0 && (
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.filterButton, podFilter && styles.filterButtonActive]}
            onPress={() => setShowFilterDropdown(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="filter-outline" size={16} color={podFilter ? (isNewTheme ? '#000' : '#FFFFFF') : colors.textSecondary} />
            <Text style={[styles.filterButtonText, podFilter && styles.filterButtonTextActive]} numberOfLines={1}>
              {podFilter ? podNames[podFilter] || 'Pod' : 'filter by pod'}
            </Text>
            <Ionicons name="chevron-down" size={14} color={podFilter ? (isNewTheme ? '#000' : '#FFFFFF') : colors.textTertiary} />
          </TouchableOpacity>
          {podFilter && (
            <TouchableOpacity style={styles.clearFilter} onPress={() => setPodFilter(null)} activeOpacity={0.6} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
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
                    activeOpacity={0.6}
                  >
                    <Text style={[styles.dropdownItemText, !podFilter && styles.dropdownItemTextActive]}>All Notifications</Text>
                    {!podFilter && <Ionicons name="checkmark" size={18} color={colors.accentGreen} />}
                  </TouchableOpacity>
                  {availablePods.map(pod => {
                    const active = podFilter === pod.id;
                    return (
                      <TouchableOpacity
                        key={pod.id}
                        style={[styles.dropdownItem, active && styles.dropdownItemActive]}
                        onPress={() => { setPodFilter(pod.id); setShowFilterDropdown(false); }}
                        activeOpacity={0.6}
                      >
                        <Text style={[styles.dropdownItemText, active && styles.dropdownItemTextActive]} numberOfLines={1}>{pod.title}</Text>
                        {active && <Ionicons name="checkmark" size={18} color={colors.accentGreen} />}
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
          <Ionicons name="notifications-outline" size={48} color={colors.accentGreen} />
          <Text style={[styles.body, { marginTop: 12 }]}>You're all caught up 🌱</Text>
        </View>
      ) : (
        <FlatList
          data={groupedNotifications}
          renderItem={renderNotification}
          keyExtractor={item => item.key}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={isNewTheme ? colors.accentGreen : editorial.carolina} />
          }
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
}

function makeStyles(colors: any, isNewTheme: boolean) {
  const cardUnreadBg = isNewTheme ? 'rgba(200, 255, 107, 0.06)' : editorial.carolinaTint;
  const dropdownItemActiveBg = isNewTheme ? 'rgba(200, 255, 107, 0.10)' : editorial.carolinaTint;
  const subtleBg = isNewTheme ? 'rgba(255,255,255,0.06)' : '#F2F0EB';

  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingTop: 60,
    paddingBottom: 12,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
    fontFamily: isNewTheme ? 'Sora_700Bold' : 'PlayfairDisplay_700Bold',
  },
  unreadPill: {
    backgroundColor: colors.accentGreen,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
  },
  unreadPillText: {
    color: isNewTheme ? '#000000' : '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    fontFamily: isNewTheme ? 'Sora_700Bold' : 'InterTight_600SemiBold',
  },

  // Filter
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: 8,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: subtleBg,
  },
  filterButtonActive: {
    backgroundColor: colors.accentGreen,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
    fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold',
    maxWidth: 180,
  },
  filterButtonTextActive: {
    color: isNewTheme ? '#000000' : '#FFFFFF',
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
    backgroundColor: colors.surface,
    borderRadius: 14,
    maxHeight: 360,
    borderWidth: isNewTheme ? StyleSheet.hairlineWidth : 0,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
  dropdownTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    fontFamily: isNewTheme ? 'Sora_700Bold' : 'InterTight_600SemiBold',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 10,
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
    borderBottomColor: colors.border,
  },
  dropdownItemActive: {
    backgroundColor: dropdownItemActiveBg,
  },
  dropdownItemText: {
    fontSize: 15,
    color: colors.textPrimary,
    fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold',
    flex: 1,
    marginRight: 8,
  },
  dropdownItemTextActive: {
    color: colors.accentGreen,
    fontWeight: '600',
    fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold',
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
    paddingLeft: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    position: 'relative',
  },
  cardUnread: {
    backgroundColor: cardUnreadBg,
  },
  cardAccentBar: {
    position: 'absolute',
    left: 0,
    top: 8,
    bottom: 8,
    width: 3,
    borderRadius: 2,
    backgroundColor: colors.accentGreen,
  },

  // Icon
  // Same 40x40 footprint as iconCircle so rows don't shift depending on
  // whether a notification has a known actor.
  avatarWrap: {
    width: 40,
    height: 40,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarSingle: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarSmall: {
    width: 27,
    height: 27,
    borderRadius: 14,
    position: 'absolute',
    // Ring in the card colour so the overlap reads as depth rather than a smudge.
    borderWidth: 2,
    borderColor: isNewTheme ? colors.surface : editorial.surface,
  },
  avatarBack: { top: 0, right: 0 },
  avatarFront: { bottom: 0, left: 0 },
  avatarFallback: {
    backgroundColor: isNewTheme ? colors.accentGreen : editorial.carolina,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    color: isNewTheme ? colors.background : '#FFFFFF',
    fontFamily: isNewTheme ? 'Sora_700Bold' : 'InterTight_600SemiBold',
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: isNewTheme ? subtleBg : 'transparent',
    borderWidth: isNewTheme ? 0 : StyleSheet.hairlineWidth,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  iconCircleUnread: {
    backgroundColor: isNewTheme ? 'rgba(200, 255, 107, 0.18)' : editorial.carolinaTint,
    borderColor: isNewTheme ? 'transparent' : editorial.carolinaTint,
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
    color: colors.textPrimary,
    fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'PlayfairDisplay_700Bold',
    marginBottom: 2,
  },
  titleUnread: {
    fontWeight: '700',
  },
  body: {
    fontSize: 14,
    color: colors.textSecondary,
    fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold',
    lineHeight: 18,
  },

  // Meta
  meta: {
    alignItems: 'flex-end',
    gap: 6,
  },
  time: {
    fontSize: 12,
    color: colors.textTertiary,
    fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accentGreen,
  },

  // Empty
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  });
}
