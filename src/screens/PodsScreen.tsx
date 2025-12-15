import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../config/supabase';
import { notificationService } from '../services/notificationService';

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
}

interface Application {
  id: string;
  pursuit_id: string;
  status: string;
  pursuits: {
    title: string;
    description: string;
  };
}

type FilterType = 'active' | 'past' | 'pending';

interface PodsScreenProps {
  onOpenPodDetails: (pod: Pod) => void;
  onOpenTeamBoard: (pursuitId: string) => void;
}

export default function PodsScreen({ onOpenPodDetails, onOpenTeamBoard }: PodsScreenProps) {
  const { user } = useAuth();
  const [pods, setPods] = useState<Pod[]>([]);
  const [pastPods, setPastPods] = useState<Pod[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
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
        .select('id, title, description, current_members_count, team_size_max, status, meeting_cadence, creator_id, location, decision_system, pursuit_types')
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
          .select('id, title, description, current_members_count, team_size_max, status, meeting_cadence, creator_id, location, decision_system, pursuit_types')
          .in('id', activeMemberPursuitIds);

        if (error) throw error;
        memberPursuits = data || [];
      }

      // Combine active pods and mark which are created by user
      const allActivePods: Pod[] = [
        ...(createdPursuits || []).map(p => ({ ...p, is_creator: true, membership_status: 'active' })),
        ...memberPursuits.map(p => ({ ...p, is_creator: false, membership_status: 'active' }))
      ];

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
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#8b5cf6" />
      </View>
    );
  }

  const renderFilterTabs = () => (
    <View style={styles.filterTabs}>
      <TouchableOpacity
        style={[styles.filterTab, activeFilter === 'active' && styles.filterTabActive]}
        onPress={() => setActiveFilter('active')}
      >
        <Text style={[styles.filterTabText, activeFilter === 'active' && styles.filterTabTextActive]}>
          Active ({pods.length})
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.filterTab, activeFilter === 'past' && styles.filterTabActive]}
        onPress={() => setActiveFilter('past')}
      >
        <Text style={[styles.filterTabText, activeFilter === 'past' && styles.filterTabTextActive]}>
          Past ({pastPods.length})
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.filterTab, activeFilter === 'pending' && styles.filterTabActive]}
        onPress={() => setActiveFilter('pending')}
      >
        <Text style={[styles.filterTabText, activeFilter === 'pending' && styles.filterTabTextActive]}>
          Pending ({applications.length})
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderPodCard = (pod: Pod, isPast: boolean = false) => {
    const hasNotifications = !isPast && notificationCounts.get(pod.id) && notificationCounts.get(pod.id)! > 0;

    return (
    <TouchableOpacity
      key={pod.id}
      style={[styles.podCard, isPast && styles.podCardPast]}
      onPress={() => !isPast && onOpenPodDetails(pod)}
      activeOpacity={isPast ? 1 : 0.7}
      disabled={isPast}
    >
      <View style={styles.podHeader}>
        <View style={styles.podTitleRow}>
          <View style={styles.titleWithDot}>
            {hasNotifications && <View style={styles.notificationDot} />}
            <Text style={[styles.podTitle, isPast && styles.podTitlePast]} numberOfLines={1}>{pod.title}</Text>
          </View>
          {pod.is_creator && !isPast && (
            <View style={styles.creatorBadge}>
              <Text style={styles.creatorBadgeText}>CREATOR</Text>
            </View>
          )}
          {isPast && (
            <View style={styles.removedBadge}>
              <Text style={styles.removedBadgeText}>REMOVED</Text>
            </View>
          )}
        </View>
        {!isPast && (
          <View style={[
            styles.statusBadge,
            pod.status === 'active' ? styles.statusActive : styles.statusPending
          ]}>
            <Text style={styles.statusText}>
              {pod.status === 'awaiting_kickoff' ? 'Awaiting Kickoff' : 'Active'}
            </Text>
          </View>
        )}
      </View>

      <Text style={[styles.podDescription, isPast && styles.podDescriptionPast]} numberOfLines={2}>
        {pod.description}
      </Text>

      {!isPast ? (
        <>
          <View style={styles.podInfo}>
            <View style={styles.infoItem}>
              <Text style={styles.infoIcon}>👥</Text>
              <Text style={styles.infoText}>
                {pod.current_members_count}/{pod.team_size_max} members
              </Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoIcon}>📅</Text>
              <Text style={styles.infoText} numberOfLines={1}>
                {pod.meeting_cadence}
              </Text>
            </View>
          </View>
          <View style={styles.podFooter}>
            <Text style={styles.tapHint}>Tap to view details →</Text>
          </View>
        </>
      ) : (
        <View style={styles.pastPodInfo}>
          <Text style={styles.pastPodDate}>
            No longer a member
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
  };

  const renderActiveContent = () => (
    <View style={styles.content}>
      {pods.length > 0 ? (
        pods.map((pod) => renderPodCard(pod))
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>🌊</Text>
          <Text style={styles.emptyText}>No active pods</Text>
          <Text style={styles.emptyHint}>Create a pursuit or apply to join a team</Text>
        </View>
      )}
    </View>
  );

  const renderPastContent = () => (
    <View style={styles.content}>
      {pastPods.length > 0 ? (
        pastPods.map((pod) => renderPodCard(pod, true))
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>📭</Text>
          <Text style={styles.emptyText}>No past pods</Text>
          <Text style={styles.emptyHint}>Pods you've been removed from will appear here</Text>
        </View>
      )}
    </View>
  );

  const renderPendingContent = () => (
    <View style={styles.content}>
      {applications.length > 0 ? (
        applications.map((app) => (
          <View key={app.id} style={styles.applicationCard}>
            <View style={styles.applicationHeader}>
              <Text style={styles.applicationTitle}>{app.pursuits?.title}</Text>
              <View style={styles.pendingBadge}>
                <Text style={styles.pendingText}>PENDING</Text>
              </View>
            </View>
            <Text style={styles.applicationDescription} numberOfLines={2}>
              {app.pursuits?.description}
            </Text>
          </View>
        ))
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>📝</Text>
          <Text style={styles.emptyText}>No pending applications</Text>
          <Text style={styles.emptyHint}>Apply to pursuits and track your applications here</Text>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🐋 My Pods</Text>
        <Text style={styles.subtitle}>Your teams & applications</Text>
      </View>

      {renderFilterTabs()}

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadData} />}
      >
        {activeFilter === 'active' && renderActiveContent()}
        {activeFilter === 'past' && renderPastContent()}
        {activeFilter === 'pending' && renderPendingContent()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { backgroundColor: '#fff', padding: 20, paddingTop: 60, borderBottomWidth: 0 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#8b5cf6' },
  subtitle: { fontSize: 16, color: '#666', marginTop: 5 },
  filterTabs: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 15,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
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
  statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  statusPending: { backgroundColor: '#fef3c7' },
  statusActive: { backgroundColor: '#d1fae5' },
  statusText: { fontSize: 11, fontWeight: '600', color: '#333' },
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
