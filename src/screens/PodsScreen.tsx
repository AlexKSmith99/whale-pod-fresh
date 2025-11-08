import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../config/supabase';

interface Pod {
  id: string;
  title: string;
  description: string;
  current_members_count: number;
  team_size_max: number;
  status: string;
  meeting_cadence: string;
  is_creator: boolean;
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

interface PodsScreenProps {
  onOpenPodDetails: (pod: Pod) => void;
  onOpenTeamBoard: (pursuitId: string) => void;
}

export default function PodsScreen({ onOpenPodDetails, onOpenTeamBoard }: PodsScreenProps) {
  const { user } = useAuth();
  const [pods, setPods] = useState<Pod[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);

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

      // Get pursuits where user is a team member
      const { data: memberships, error: memberError } = await supabase
        .from('team_members')
        .select('pursuit_id')
        .eq('user_id', user.id);

      if (memberError) throw memberError;

      const memberPursuitIds = memberships?.map(m => m.pursuit_id) || [];

      let memberPursuits = [];
      if (memberPursuitIds.length > 0) {
        const { data, error } = await supabase
          .from('pursuits')
          .select('id, title, description, current_members_count, team_size_max, status, meeting_cadence, creator_id, location, decision_system, pursuit_types')
          .in('id', memberPursuitIds);

        if (error) throw error;
        memberPursuits = data || [];
      }

      // Combine and mark which are created by user
      const allPods: Pod[] = [
        ...(createdPursuits || []).map(p => ({ ...p, is_creator: true })),
        ...memberPursuits.map(p => ({ ...p, is_creator: false }))
      ];

      setPods(allPods);

      // Get pending applications
      const { data: apps, error: appsError } = await supabase
        .from('pursuit_applications')
        .select('id, pursuit_id, status, pursuits(title, description)')
        .eq('applicant_id', user.id)
        .eq('status', 'pending');

      if (appsError) throw appsError;
      setApplications(apps || []);

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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🐋 My Pods</Text>
        <Text style={styles.subtitle}>Your teams & applications</Text>
      </View>

      <ScrollView 
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadData} />}
      >
        {applications.length > 0 && (
          <View style={styles.applicationsSection}>
            <Text style={styles.applicationsTitle}>Pending Applications ({applications.length})</Text>
            {applications.map((app) => (
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
            ))}
          </View>
        )}

        {pods.length === 0 && applications.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🌊</Text>
            <Text style={styles.emptyText}>No pods or applications yet!</Text>
            <Text style={styles.emptyHint}>Create a pursuit or apply to join a team</Text>
          </View>
        ) : (
          <View style={styles.content}>
            {pods.length > 0 && (
              <>
                <Text style={styles.podsTitle}>Active Pods ({pods.length})</Text>
                {pods.map((pod) => (
                  <TouchableOpacity
                    key={pod.id}
                    style={styles.podCard}
                    onPress={() => onOpenPodDetails(pod)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.podHeader}>
                      <View style={styles.podTitleRow}>
                        <Text style={styles.podTitle} numberOfLines={1}>{pod.title}</Text>
                        {pod.is_creator && (
                          <View style={styles.creatorBadge}>
                            <Text style={styles.creatorBadgeText}>CREATOR</Text>
                          </View>
                        )}
                      </View>
                      <View style={[
                        styles.statusBadge,
                        pod.status === 'active' ? styles.statusActive : styles.statusPending
                      ]}>
                        <Text style={styles.statusText}>
                          {pod.status === 'awaiting_kickoff' ? 'Awaiting Kickoff' : 'Active'}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.podDescription} numberOfLines={2}>
                      {pod.description}
                    </Text>

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
                  </TouchableOpacity>
                ))}
              </>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { backgroundColor: '#fff', padding: 20, paddingTop: 60, borderBottomWidth: 1, borderBottomColor: '#eee', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#8b5cf6' },
  subtitle: { fontSize: 16, color: '#666', marginTop: 5 },
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
  podHeader: { marginBottom: 12 },
  podTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  podTitle: { fontSize: 19, fontWeight: 'bold', color: '#1a1a1a', flex: 1, marginRight: 8 },
  creatorBadge: { backgroundColor: '#8b5cf6', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  creatorBadgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  statusPending: { backgroundColor: '#fef3c7' },
  statusActive: { backgroundColor: '#d1fae5' },
  statusText: { fontSize: 11, fontWeight: '600', color: '#333' },
  podDescription: { fontSize: 14, color: '#666', marginBottom: 14, lineHeight: 20 },
  podInfo: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f5f5f5' },
  infoItem: { flexDirection: 'row', alignItems: 'center', marginRight: 12 },
  infoIcon: { fontSize: 14, marginRight: 6 },
  infoText: { fontSize: 13, color: '#666', maxWidth: 150 },
  podFooter: { alignItems: 'flex-end' },
  tapHint: { fontSize: 12, color: '#8b5cf6', fontWeight: '600' },
});
