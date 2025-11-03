import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../config/supabase';
import { colors, typography, spacing, borderRadius, shadows } from '../theme/designSystem';
import PursuitDetailScreen from './PursuitDetailScreen';

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
  onOpenTeamBoard: (pursuitId: string) => void;
  onOpenTimeSlotProposal?: (pursuit: any) => void;
  onOpenCreatorTimeSelection?: (pursuit: any) => void;
}

export default function PodsScreen({ onOpenTeamBoard, onOpenTimeSlotProposal, onOpenCreatorTimeSelection }: PodsScreenProps) {
  const { user } = useAuth();
  const [pods, setPods] = useState<Pod[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPod, setSelectedPod] = useState<any>(null);

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
        .select('id, title, description, current_members_count, team_size_max, status, meeting_cadence')
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
          .select('id, title, description, current_members_count, team_size_max, status, meeting_cadence')
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

  // Show PursuitDetailScreen when a pod is selected
  if (selectedPod) {
    return (
      <PursuitDetailScreen
        pursuit={selectedPod}
        onBack={() => {
          setSelectedPod(null);
          loadData(); // Refresh the list
        }}
        isOwner={selectedPod.creator_id === user?.id}
        onOpenTeamBoard={(pursuitId) => {
          setSelectedPod(null);
          onOpenTeamBoard(pursuitId);
        }}
        onOpenCreatorTimeSelection={(pursuit) => {
          setSelectedPod(null);
          if (onOpenCreatorTimeSelection) {
            onOpenCreatorTimeSelection(pursuit);
          }
        }}
      />
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />

      {/* Modern Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerGreeting}>Your</Text>
            <Text style={styles.headerTitle}>Pods</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={loadData}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
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
            <View style={styles.emptyIconContainer}>
              <Ionicons name="fish-outline" size={48} color={colors.textTertiary} />
            </View>
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
                    onPress={async () => {
                      // Fetch full pursuit details
                      const { data, error } = await supabase
                        .from('pursuits')
                        .select('*')
                        .eq('id', pod.id)
                        .single();

                      if (!error && data) {
                        setSelectedPod(data);
                      }
                    }}
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
                        <View style={styles.iconContainer}>
                          <Ionicons name="people" size={14} color={colors.textSecondary} />
                        </View>
                        <Text style={styles.infoText}>
                          {pod.current_members_count}/{pod.team_size_max}
                        </Text>
                      </View>
                      <View style={styles.infoItem}>
                        <View style={styles.iconContainer}>
                          <Ionicons name="calendar" size={14} color={colors.textSecondary} />
                        </View>
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
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Header Styles
  header: {
    backgroundColor: colors.white,
    paddingTop: 50,
    paddingBottom: spacing.base,
    ...shadows.sm,
  },

  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },

  headerGreeting: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs,
  },

  headerTitle: {
    fontSize: typography.fontSize['3xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
  },

  scrollView: {
    flex: 1,
  },

  // Applications Section
  applicationsSection: {
    backgroundColor: colors.warningLight,
    padding: spacing.lg,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.warning,
  },

  applicationsTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },

  applicationCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.base,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.warning,
  },

  applicationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },

  applicationTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    flex: 1,
    marginRight: spacing.sm,
  },

  applicationDescription: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    lineHeight: typography.fontSize.sm * typography.lineHeight.normal,
  },

  pendingBadge: {
    backgroundColor: colors.warning,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },

  pendingText: {
    color: colors.white,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },

  // Content
  content: {
    padding: spacing.lg,
    paddingBottom: spacing['5xl'],
  },

  podsTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing['5xl'],
    paddingHorizontal: spacing.lg,
  },

  emptyIconContainer: {
    width: 96,
    height: 96,
    borderRadius: borderRadius.full,
    backgroundColor: colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },

  emptyText: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },

  emptyHint: {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
    textAlign: 'center',
  },

  // Pod Card
  podCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.base,
    ...shadows.base,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },

  podHeader: {
    marginBottom: spacing.md,
  },

  podTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },

  podTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    flex: 1,
    marginRight: spacing.sm,
  },

  creatorBadge: {
    backgroundColor: colors.success,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },

  creatorBadgeText: {
    color: colors.white,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },

  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    gap: 4,
  },

  statusPending: {
    backgroundColor: colors.warningLight,
  },

  statusActive: {
    backgroundColor: colors.successLight,
  },

  statusText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
  },

  podDescription: {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    lineHeight: typography.fontSize.base * typography.lineHeight.normal,
  },

  podInfo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.base,
    marginBottom: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },

  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },

  iconContainer: {
    width: 20,
    height: 20,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },

  infoText: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    fontWeight: typography.fontWeight.medium,
  },

  podFooter: {
    alignItems: 'flex-end',
  },

  tapHint: {
    fontSize: typography.fontSize.sm,
    color: colors.primary,
    fontWeight: typography.fontWeight.semibold,
  },
});
