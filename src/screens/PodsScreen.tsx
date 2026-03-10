import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator, StatusBar } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../config/supabase';
import { notificationService } from '../services/notificationService';
import { colors as legacyColors } from '../theme/designSystem';
import { useTheme } from '../theme/ThemeContext';
import { getThemedStyles } from '../theme/themedStyles';
import GrainTexture from '../components/ui/GrainTexture';
import GradientBackground from '../components/ui/GradientBackground';

interface Pod {
  id: string;
  title: string;
  description: string;
  current_members_count: number;
  team_size_max: number;
  status: string;
  meeting_cadence: string;
  is_creator: boolean;
  membership_status?: string;
  removed_at?: string;
  next_meeting_date?: string | null;
  kickoff_date?: string | null;
}

interface Application {
  id: string;
  pursuit_id: string;
  status: string;
  pursuits: any;
}

type FilterType = 'active' | 'past' | 'pending';

interface PodsScreenProps {
  onOpenPodDetails: (pod: Pod) => void;
  onOpenTeamBoard: (pursuitId: string) => void;
  onOpenInterviewProposal?: (applicationId: string, pursuitId: string, pursuitTitle: string) => void;
}

export default function PodsScreen({ onOpenPodDetails, onOpenTeamBoard, onOpenInterviewProposal }: PodsScreenProps) {
  const { user } = useAuth();
  const { theme, isNewTheme } = useTheme();
  const colors = theme.colors;
  const themedStyles = getThemedStyles(colors, isNewTheme);
  const [pods, setPods] = useState<Pod[]>([]);
  const [pastPods, setPastPods] = useState<Pod[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [interviewPendingApps, setInterviewPendingApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterType>('active');
  const [notificationCounts, setNotificationCounts] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Get pursuits where user is the creator
      const { data: createdPursuits, error: createdError } = await supabase
        .from('pursuits')
        .select('id, title, description, current_members_count, team_size_max, status, meeting_cadence, creator_id, location, decision_system, pursuit_types, kickoff_date')
        .eq('creator_id', user.id);

      if (createdError) throw createdError;

      // Get active memberships (not removed)
      const { data: activeMemberships, error: activeMemberError } = await supabase
        .from('team_members')
        .select('pursuit_id, status')
        .eq('user_id', user.id)
        .neq('status', 'removed');

      if (activeMemberError) throw activeMemberError;

      const activeMemberPursuitIds = activeMemberships?.map(m => m.pursuit_id) || [];

      let memberPursuits: any[] = [];
      if (activeMemberPursuitIds.length > 0) {
        const { data, error } = await supabase
          .from('pursuits')
          .select('id, title, description, current_members_count, team_size_max, status, meeting_cadence, creator_id, location, decision_system, pursuit_types, kickoff_date')
          .in('id', activeMemberPursuitIds);

        if (error) throw error;
        memberPursuits = data || [];
      }

      // Combine active pods and mark which are created by user
      const allActivePods: Pod[] = [
        ...(createdPursuits || []).map(p => ({ ...p, is_creator: true, membership_status: 'active', next_meeting_date: null })),
        ...memberPursuits.map(p => ({ ...p, is_creator: false, membership_status: 'active', next_meeting_date: null }))
      ];

      // Fetch upcoming meetings for all pods
      if (allActivePods.length > 0) {
        const podIds = allActivePods.map(p => p.id);
        const now = new Date().toISOString();

        const { data: upcomingMeetings, error: meetingsError } = await supabase
          .from('meetings')
          .select('pursuit_id, scheduled_time')
          .in('pursuit_id', podIds)
          .gte('scheduled_time', now)
          .order('scheduled_time', { ascending: true });

        if (!meetingsError && upcomingMeetings) {
          // Create a map of pursuit_id to next meeting date (first upcoming meeting)
          const nextMeetingMap = new Map<string, string>();
          upcomingMeetings.forEach(meeting => {
            if (!nextMeetingMap.has(meeting.pursuit_id)) {
              nextMeetingMap.set(meeting.pursuit_id, meeting.scheduled_time);
            }
          });

          // Update pods with next meeting dates
          allActivePods.forEach(pod => {
            pod.next_meeting_date = nextMeetingMap.get(pod.id) || null;
          });
        }
      }

      setPods(allActivePods);

      // Get past memberships (removed status)
      const { data: pastMemberships, error: pastMemberError } = await supabase
        .from('team_members')
        .select('pursuit_id, status')
        .eq('user_id', user.id)
        .eq('status', 'removed');

      if (pastMemberError) throw pastMemberError;

      const pastMemberPursuitIds = pastMemberships?.map(m => m.pursuit_id) || [];

      let pastMemberPursuits: Pod[] = [];
      if (pastMemberPursuitIds.length > 0) {
        const { data, error } = await supabase
          .from('pursuits')
          .select('id, title, description, current_members_count, team_size_max, status, meeting_cadence, creator_id, location, decision_system, pursuit_types')
          .in('id', pastMemberPursuitIds);

        if (error) throw error;

        pastMemberPursuits = (data || []).map(p => ({
          ...p,
          is_creator: false,
          membership_status: 'removed',
        }));
      }

      setPastPods(pastMemberPursuits);

      // Get pending applications
      const { data: apps, error: appsError } = await supabase
        .from('pursuit_applications')
        .select('id, pursuit_id, status, pursuits(title, description)')
        .eq('applicant_id', user.id)
        .eq('status', 'pending');

      if (appsError) throw appsError;
      setApplications(apps || []);

      // Get interview pending applications (applicant needs to propose times)
      const { data: interviewApps, error: interviewAppsError } = await supabase
        .from('pursuit_applications')
        .select('id, pursuit_id, status, pursuits(title, description)')
        .eq('applicant_id', user.id)
        .eq('status', 'interview_pending');

      if (interviewAppsError) throw interviewAppsError;
      setInterviewPendingApps(interviewApps || []);

      // Load notification counts by pursuit
      const counts = await notificationService.getUnreadCountsByPursuit(user.id);
      console.log('📍 Notification counts by pursuit:', Object.fromEntries(counts));
      console.log('📍 Active pod IDs:', allActivePods.map(p => p.id));
      setNotificationCounts(counts);

    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <GradientBackground style={styles.loadingContainer}>
        <StatusBar barStyle={isNewTheme ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
        {isNewTheme && <GrainTexture opacity={0.06} />}
        <ActivityIndicator size="large" color={themedStyles.accentIconColor} />
      </GradientBackground>
    );
  }

  const renderFilterTabs = () => (
    <View style={[styles.filterTabs, themedStyles.surface, { borderBottomColor: colors.border }]}>
      <TouchableOpacity
        style={[styles.filterTab, { backgroundColor: isNewTheme ? colors.surfaceAlt : '#f5f5f5' }, activeFilter === 'active' && { backgroundColor: themedStyles.accentIconColor }]}
        onPress={() => setActiveFilter('active')}
      >
        <Text style={[styles.filterTabText, themedStyles.bodyText, { color: colors.textSecondary }, activeFilter === 'active' && styles.filterTabTextActive]}>
          Active ({pods.length})
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.filterTab, { backgroundColor: isNewTheme ? colors.surfaceAlt : '#f5f5f5' }, activeFilter === 'past' && { backgroundColor: themedStyles.accentIconColor }]}
        onPress={() => setActiveFilter('past')}
      >
        <Text style={[styles.filterTabText, themedStyles.bodyText, { color: colors.textSecondary }, activeFilter === 'past' && styles.filterTabTextActive]}>
          Past ({pastPods.length})
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.filterTab, { backgroundColor: isNewTheme ? colors.surfaceAlt : '#f5f5f5' }, activeFilter === 'pending' && { backgroundColor: themedStyles.accentIconColor }]}
        onPress={() => setActiveFilter('pending')}
      >
        <Text style={[styles.filterTabText, themedStyles.bodyText, { color: colors.textSecondary }, activeFilter === 'pending' && styles.filterTabTextActive]}>
          Pending ({applications.length + interviewPendingApps.length})
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderPodCard = (pod: Pod, isPast: boolean = false) => {
    const hasNotifications = !isPast && notificationCounts.get(pod.id) && notificationCounts.get(pod.id)! > 0;

    return (
    <TouchableOpacity
      key={pod.id}
      style={[styles.podCard, themedStyles.card, { borderWidth: isNewTheme ? 0.35 : 0.5, borderColor: isNewTheme ? colors.accentGreen : '#f0f0f0' }, isPast && [styles.podCardPast, { backgroundColor: isNewTheme ? colors.surfaceAlt : '#f9fafb' }]]}
      onPress={() => !isPast && onOpenPodDetails(pod)}
      activeOpacity={isPast ? 1 : 0.7}
      disabled={isPast}
    >
      <View style={styles.podHeader}>
        <View style={styles.podTitleRow}>
          <View style={styles.titleWithDot}>
            {hasNotifications && <View style={styles.notificationDot} />}
            <Text style={[styles.podTitle, themedStyles.cardTitle, isPast && { color: colors.textSecondary }]} numberOfLines={1}>{pod.title}</Text>
          </View>
          {pod.is_creator && !isPast && (
            <View style={[styles.creatorBadge, themedStyles.tag, { backgroundColor: themedStyles.accentIconColor }]}>
              <Text style={[styles.creatorBadgeText, themedStyles.tagText, { color: isNewTheme ? colors.background : '#fff' }]}>CREATOR</Text>
            </View>
          )}
          {isPast && (
            <View style={styles.removedBadge}>
              <Text style={[styles.removedBadgeText, themedStyles.tagText]}>REMOVED</Text>
            </View>
          )}
        </View>
        {!isPast && (
          <View style={[
            styles.statusBadge,
            { backgroundColor: pod.status === 'active'
              ? (isNewTheme ? 'rgba(134, 239, 172, 0.15)' : '#d1fae5')
              : (isNewTheme ? 'rgba(252, 211, 77, 0.15)' : '#fef3c7')
            }
          ]}>
            <View style={[
              styles.statusDot,
              { backgroundColor: pod.status === 'active' ? colors.success : colors.warning }
            ]} />
            <Text style={[
              styles.statusText,
              { color: pod.status === 'active' ? colors.success : colors.warning }
            ]}>
              {pod.status === 'awaiting_kickoff' ? 'Awaiting Kickoff' : 'Active'}
            </Text>
          </View>
        )}
      </View>

      <Text style={[styles.podDescription, themedStyles.cardDescription]} numberOfLines={2}>
        {pod.description}
      </Text>

      {!isPast ? (
        <>
          <View style={[styles.podInfo, { borderTopColor: colors.border }]}>
            <View style={styles.infoItem}>
              <Text style={styles.infoIcon}>👥</Text>
              <Text style={[styles.infoText, themedStyles.cardSmallText]}>
                {pod.current_members_count}/{pod.team_size_max} members
              </Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoIcon}>📅</Text>
              <Text style={[styles.infoText, themedStyles.cardSmallText]} numberOfLines={1}>
                {pod.meeting_cadence}
              </Text>
            </View>
          </View>
          <View style={styles.podFooter}>
            <Text style={[styles.tapHint, themedStyles.textAccent]}>Tap to view details →</Text>
          </View>
        </>
      ) : (
        <View style={[styles.pastPodInfo, { borderTopColor: colors.border }]}>
          <Text style={[styles.pastPodDate, themedStyles.cardSmallText]}>
            No longer a member
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
  };

  const renderActiveContent = () => {
    // Sort pods:
    // 1. Pods with upcoming meetings first, sorted by soonest meeting
    // 2. Pods without meetings, sorted by most recent kickoff date
    const sortedPods = [...pods].sort((a, b) => {
      const aHasMeeting = !!a.next_meeting_date;
      const bHasMeeting = !!b.next_meeting_date;

      // If both have meetings, sort by soonest meeting
      if (aHasMeeting && bHasMeeting) {
        return new Date(a.next_meeting_date!).getTime() - new Date(b.next_meeting_date!).getTime();
      }

      // Pods with meetings come first
      if (aHasMeeting && !bHasMeeting) return -1;
      if (!aHasMeeting && bHasMeeting) return 1;

      // If neither has meetings, sort by most recent kickoff date
      const aKickoff = a.kickoff_date ? new Date(a.kickoff_date).getTime() : 0;
      const bKickoff = b.kickoff_date ? new Date(b.kickoff_date).getTime() : 0;
      return bKickoff - aKickoff; // Most recent first
    });

    return (
    <View style={styles.content}>
      {sortedPods.length > 0 ? (
        sortedPods.map((pod) => renderPodCard(pod))
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>🌊</Text>
          <Text style={[styles.emptyText, themedStyles.emptyText]}>No active pods</Text>
          <Text style={[styles.emptyHint, themedStyles.emptySubtext]}>Create a pursuit or apply to join a team</Text>
        </View>
      )}
    </View>
  );
  };

  const renderPastContent = () => (
    <View style={styles.content}>
      {pastPods.length > 0 ? (
        pastPods.map((pod) => renderPodCard(pod, true))
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>📭</Text>
          <Text style={[styles.emptyText, themedStyles.emptyText]}>No past pods</Text>
          <Text style={[styles.emptyHint, themedStyles.emptySubtext]}>Pods you've been removed from will appear here</Text>
        </View>
      )}
    </View>
  );

  const renderPendingContent = () => (
    <View style={styles.content}>
      {/* Interview Requests - show first with action required */}
      {interviewPendingApps.length > 0 && (
        <>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary, fontFamily: isNewTheme ? 'Aboreto_400Regular' : undefined, textTransform: 'uppercase', letterSpacing: isNewTheme ? 1 : 0.5 }]}>Interview Requests</Text>
          {interviewPendingApps.map((app) => (
            <View key={app.id} style={[styles.applicationCard, styles.interviewCard, themedStyles.card, { borderColor: themedStyles.accentIconColor, borderWidth: isNewTheme ? 0.35 : 1 }]}>
              <View style={styles.applicationHeader}>
                <Text style={[styles.applicationTitle, themedStyles.cardTitle]}>{app.pursuits?.title}</Text>
                <View style={[styles.interviewBadge, { backgroundColor: themedStyles.accentIconColor }]}>
                  <Text style={[styles.interviewBadgeText, themedStyles.tagText, { color: isNewTheme ? colors.background : '#fff' }]}>INTERVIEW</Text>
                </View>
              </View>
              <Text style={[styles.applicationDescription, themedStyles.cardDescription]} numberOfLines={2}>
                {app.pursuits?.description}
              </Text>
              <Text style={[styles.interviewPrompt, themedStyles.textAccent]}>
                The creator wants to schedule an interview! Propose your available times.
              </Text>
              <TouchableOpacity
                style={[styles.proposeTimesButton, themedStyles.buttonPrimary]}
                onPress={() => onOpenInterviewProposal?.(app.id, app.pursuit_id, app.pursuits?.title || 'Pursuit')}
              >
                <Text style={[styles.proposeTimesButtonText, themedStyles.buttonPrimaryText]}>Propose Interview Times</Text>
              </TouchableOpacity>
            </View>
          ))}
        </>
      )}

      {/* Regular pending applications */}
      {applications.length > 0 && (
        <>
          {interviewPendingApps.length > 0 && <Text style={[styles.sectionLabel, { color: colors.textSecondary, fontFamily: isNewTheme ? 'Aboreto_400Regular' : undefined, textTransform: 'uppercase', letterSpacing: isNewTheme ? 1 : 0.5 }]}>Pending Review</Text>}
          {applications.map((app) => (
            <View key={app.id} style={[styles.applicationCard, themedStyles.card, { borderWidth: isNewTheme ? 0.35 : 0.5, borderColor: isNewTheme ? colors.accentGreen : '#f59e0b' }]}>
              <View style={styles.applicationHeader}>
                <Text style={[styles.applicationTitle, themedStyles.cardTitle]}>{app.pursuits?.title}</Text>
                <View style={[styles.pendingBadge, themedStyles.tag, { backgroundColor: colors.warning }]}>
                  <Text style={[styles.pendingText, themedStyles.tagText, { color: isNewTheme ? colors.background : '#fff' }]}>PENDING</Text>
                </View>
              </View>
              <Text style={[styles.applicationDescription, themedStyles.cardDescription]} numberOfLines={2}>
                {app.pursuits?.description}
              </Text>
            </View>
          ))}
        </>
      )}

      {applications.length === 0 && interviewPendingApps.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>📝</Text>
          <Text style={[styles.emptyText, themedStyles.emptyText]}>No pending applications</Text>
          <Text style={[styles.emptyHint, themedStyles.emptySubtext]}>Apply to pursuits and track your applications here</Text>
        </View>
      )}
    </View>
  );

  return (
    <GradientBackground style={styles.container}>
      <StatusBar barStyle={isNewTheme ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      {isNewTheme && <GrainTexture opacity={0.06} />}
      <View style={[styles.header, themedStyles.header]}>
        <Text style={[styles.title, themedStyles.headerTitle]}>My Pods</Text>
        <Text style={[styles.subtitle, themedStyles.cardDescription]}>Your teams & applications</Text>
      </View>

      {renderFilterTabs()}

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadData} tintColor={themedStyles.refreshColor} />}
      >
        {activeFilter === 'active' && renderActiveContent()}
        {activeFilter === 'past' && renderPastContent()}
        {activeFilter === 'pending' && renderPendingContent()}
      </ScrollView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { padding: 20, paddingTop: 60, borderBottomWidth: 0 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#8b5cf6' },
  subtitle: { fontSize: 16, color: '#666', marginTop: 5 },
  filterTabs: {
    flexDirection: 'row',
    paddingHorizontal: 15,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  filterTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 20,
    marginHorizontal: 4,
    backgroundColor: '#f5f5f5',
  },
  filterTabActive: {
    backgroundColor: '#8b5cf6',
  },
  filterTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  filterTabTextActive: {
    color: '#fff',
  },
  scrollView: { flex: 1 },
  applicationsSection: { backgroundColor: '#fef3c7', padding: 15, borderBottomWidth: 1, borderBottomColor: '#f59e0b' },
  applicationsTitle: { fontSize: 16, fontWeight: 'bold', color: '#92400e', marginBottom: 12 },
  applicationCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#f59e0b' },
  interviewCard: { borderColor: '#8b5cf6', borderWidth: 2, backgroundColor: '#faf5ff' },
  interviewBadge: { backgroundColor: '#8b5cf6', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  interviewBadgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  interviewPrompt: { fontSize: 13, color: '#7c3aed', marginTop: 10, marginBottom: 12, fontStyle: 'italic' },
  proposeTimesButton: { backgroundColor: '#8b5cf6', borderRadius: 8, padding: 12, alignItems: 'center' },
  proposeTimesButtonText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  sectionLabel: { fontSize: 14, fontWeight: '600', color: '#666', marginBottom: 10, marginTop: 5 },
  applicationHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  applicationTitle: { fontSize: 16, fontWeight: 'bold', color: '#1f2937', flex: 1, marginRight: 8 },
  applicationDescription: { fontSize: 13, color: '#6b7280', lineHeight: 18 },
  pendingBadge: { backgroundColor: '#fbbf24', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  pendingText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  content: { padding: 15, paddingBottom: 100 },
  podsTitle: { fontSize: 16, fontWeight: 'bold', color: '#6b7280', marginBottom: 12 },
  emptyState: { alignItems: 'center', paddingVertical: 80 },
  emptyEmoji: { fontSize: 64, marginBottom: 20 },
  emptyText: { fontSize: 20, fontWeight: 'bold', color: '#999', marginBottom: 8 },
  emptyHint: { fontSize: 14, color: '#ccc', textAlign: 'center', paddingHorizontal: 40 },
  podCard: { backgroundColor: '#fff', borderRadius: 16, padding: 18, marginBottom: 15, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.12, shadowRadius: 6, elevation: 4, borderWidth: 1, borderColor: '#f0f0f0' },
  podCardPast: { backgroundColor: '#f9fafb', opacity: 0.8, borderColor: '#e5e7eb' },
  podHeader: { marginBottom: 12 },
  podTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  titleWithDot: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  notificationDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#ef4444', marginRight: 8 },
  podTitle: { fontSize: 19, fontWeight: 'bold', color: '#1a1a1a', flex: 1, marginRight: 8 },
  podTitlePast: { color: '#6b7280' },
  creatorBadge: { backgroundColor: '#8b5cf6', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  creatorBadgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  removedBadge: { backgroundColor: '#ef4444', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  removedBadgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: { fontSize: 12, fontWeight: '600' },
  podDescription: { fontSize: 14, color: '#666', marginBottom: 14, lineHeight: 20 },
  podDescriptionPast: { color: '#9ca3af' },
  podInfo: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f5f5f5' },
  infoItem: { flexDirection: 'row', alignItems: 'center', marginRight: 12 },
  infoIcon: { fontSize: 14, marginRight: 6 },
  infoText: { fontSize: 13, color: '#666', maxWidth: 150 },
  podFooter: { alignItems: 'flex-end' },
  tapHint: { fontSize: 12, color: '#8b5cf6', fontWeight: '600' },
  pastPodInfo: { paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  pastPodDate: { fontSize: 12, color: '#9ca3af', fontStyle: 'italic' },
});
