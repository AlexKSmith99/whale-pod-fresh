import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { kickoffService } from '../services/kickoffService';
import { notificationService } from '../services/notificationService';
import { pursuitService } from '../services/pursuitService';
import { supabase } from '../config/supabase';
import { colors, typography, spacing, borderRadius, shadows } from '../theme/designSystem';
import Button from '../components/Button';

interface Props {
  pursuit: any;
  onBack: () => void;
  onScheduled: () => void;
}

interface AnalyzedSlot {
  datetime: string;
  count: number;
  location_type: 'video' | 'in_person';
  formattedDate: string;
  formattedTime: string;
}

export default function CreatorTimeSelectionScreen({ pursuit, onBack, onScheduled }: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [proposals, setProposals] = useState<any[]>([]);
  const [analyzedSlots, setAnalyzedSlots] = useState<AnalyzedSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<AnalyzedSlot | null>(null);
  const [proposalCount, setProposalCount] = useState(0);
  const [totalMembers, setTotalMembers] = useState(0);

  useEffect(() => {
    loadProposals();
  }, []);

  const loadProposals = async () => {
    try {
      const [proposalData, count, acceptedCount] = await Promise.all([
        kickoffService.getTimeSlotProposals(pursuit.id),
        kickoffService.getProposalCount(pursuit.id),
        pursuitService.getAcceptedMembersCount(pursuit.id),
      ]);

      setProposals(proposalData);
      setProposalCount(count);
      setTotalMembers(acceptedCount + 1); // +1 for creator

      // Analyze time slots
      const analyzed = kickoffService.analyzeBestTimeSlots(proposalData);
      const formatted = analyzed.map((slot) => {
        const date = new Date(slot.datetime);
        return {
          ...slot,
          formattedDate: date.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          }),
          formattedTime: date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
          }),
        };
      });

      setAnalyzedSlots(formatted);
    } catch (error) {
      console.error('Error loading proposals:', error);
      Alert.alert('Error', 'Failed to load time slot proposals');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTime = async () => {
    if (!selectedSlot) {
      Alert.alert('No Time Selected', 'Please select a time slot first.');
      return;
    }

    Alert.alert(
      'Confirm Kickoff Time',
      `Are you sure you want to schedule the kickoff for:\n\n${selectedSlot.formattedDate}\n${selectedSlot.formattedTime}\n\nLocation: ${selectedSlot.location_type === 'video' ? 'Video Call' : 'In-Person'}\n\nAll team members will be notified and calendar invites will be sent.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm & Schedule',
          onPress: async () => {
            setSubmitting(true);
            try {
              // Schedule the kickoff meeting
              await kickoffService.scheduleKickoffMeeting(pursuit.id, user!.id, {
                datetime: selectedSlot.datetime,
                location_type: selectedSlot.location_type,
              });

              // Get all team members
              const { data: members } = await supabase
                .from('team_members')
                .select('user_id')
                .eq('pursuit_id', pursuit.id)
                .eq('status', 'accepted');

              const memberIds = members?.map((m) => m.user_id) || [];

              // Notify all team members
              await notificationService.notifyKickoffScheduled(
                pursuit.id,
                memberIds,
                pursuit.title,
                `${selectedSlot.formattedDate} at ${selectedSlot.formattedTime}`
              );

              Alert.alert(
                '✅ Kickoff Scheduled!',
                `The kickoff meeting has been scheduled for ${selectedSlot.formattedDate} at ${selectedSlot.formattedTime}. All team members have been notified.\n\nYour pursuit is now Active!`,
                [
                  {
                    text: 'OK',
                    onPress: () => {
                      // TODO: Integrate Google Calendar here
                      onScheduled();
                    },
                  },
                ]
              );
            } catch (error: any) {
              Alert.alert('Error', error.message);
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading time slot proposals...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Select Kickoff Time</Text>
          <Text style={styles.headerSubtitle}>{pursuit.title}</Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.statsCard}>
          <View style={styles.statItem}>
            <Ionicons name="people" size={24} color={colors.primary} />
            <Text style={styles.statValue}>{proposalCount}</Text>
            <Text style={styles.statLabel}>
              Proposals Submitted
            </Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Ionicons name="calendar" size={24} color={colors.success} />
            <Text style={styles.statValue}>{analyzedSlots.length}</Text>
            <Text style={styles.statLabel}>
              Unique Time Slots
            </Text>
          </View>
        </View>

        {proposalCount < totalMembers && (
          <View style={styles.warningCard}>
            <Ionicons name="warning" size={24} color={colors.warning} />
            <Text style={styles.warningText}>
              Only {proposalCount} out of {totalMembers} members have submitted their time
              preferences. You can wait for more responses or proceed with the current proposals.
            </Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>
          Select the Best Time
        </Text>
        <Text style={styles.sectionSubtitle}>
          Time slots are ranked by popularity (how many members chose each time)
        </Text>

        {analyzedSlots.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={64} color={colors.textTertiary} />
            <Text style={styles.emptyStateText}>No time slots proposed yet</Text>
            <Text style={styles.emptyStateSubtext}>
              Waiting for team members to submit their availability...
            </Text>
          </View>
        ) : (
          analyzedSlots.map((slot, index) => (
            <TouchableOpacity
              key={slot.datetime}
              style={[
                styles.timeSlotCard,
                selectedSlot?.datetime === slot.datetime && styles.timeSlotCardSelected,
              ]}
              onPress={() => setSelectedSlot(slot)}
              activeOpacity={0.7}
            >
              <View style={styles.timeSlotHeader}>
                <View style={styles.rankBadge}>
                  <Text style={styles.rankText}>#{index + 1}</Text>
                </View>
                <View style={styles.popularityBadge}>
                  <Ionicons name="people" size={16} color={colors.white} />
                  <Text style={styles.popularityText}>
                    {slot.count} member{slot.count !== 1 ? 's' : ''}
                  </Text>
                </View>
              </View>

              <View style={styles.timeSlotContent}>
                <View style={styles.dateTimeRow}>
                  <Ionicons name="calendar" size={20} color={colors.primary} />
                  <Text style={styles.dateText}>{slot.formattedDate}</Text>
                </View>
                <View style={styles.dateTimeRow}>
                  <Ionicons name="time" size={20} color={colors.primary} />
                  <Text style={styles.timeText}>{slot.formattedTime}</Text>
                </View>
                <View style={styles.dateTimeRow}>
                  <Ionicons
                    name={slot.location_type === 'video' ? 'videocam' : 'people'}
                    size={20}
                    color={colors.primary}
                  />
                  <Text style={styles.locationText}>
                    {slot.location_type === 'video' ? 'Video Call' : 'In-Person Meeting'}
                  </Text>
                </View>
              </View>

              {selectedSlot?.datetime === slot.datetime && (
                <View style={styles.selectedIndicator}>
                  <Ionicons name="checkmark-circle" size={24} color={colors.success} />
                  <Text style={styles.selectedText}>Selected</Text>
                </View>
              )}
            </TouchableOpacity>
          ))
        )}

        {selectedSlot && (
          <View style={styles.buttonContainer}>
            <Button
              variant="primary"
              onPress={handleSelectTime}
              disabled={submitting}
            >
              {submitting ? 'Scheduling...' : 'Confirm & Schedule Kickoff'}
            </Button>
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
    backgroundColor: colors.background,
  },
  loadingText: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl + 20,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    ...shadows.sm,
  },
  backButton: {
    marginRight: spacing.md,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  headerSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
  },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.md,
  },
  statValue: {
    ...typography.h1,
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
  statLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  warningCard: {
    flexDirection: 'row',
    backgroundColor: colors.warningLight,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  warningText: {
    flex: 1,
    ...typography.body,
    color: colors.warning,
    lineHeight: 20,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  sectionSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl * 2,
  },
  emptyStateText: {
    ...typography.h3,
    color: colors.textSecondary,
    marginTop: spacing.lg,
  },
  emptyStateSubtext: {
    ...typography.body,
    color: colors.textTertiary,
    marginTop: spacing.xs,
  },
  timeSlotCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 2,
    borderColor: colors.border,
    ...shadows.sm,
  },
  timeSlotCardSelected: {
    borderColor: colors.success,
    ...shadows.md,
  },
  timeSlotHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  rankBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: borderRadius.full,
  },
  rankText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
  },
  popularityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: borderRadius.full,
  },
  popularityText: {
    ...typography.caption,
    color: colors.white,
    fontWeight: '600',
  },
  timeSlotContent: {
    gap: spacing.xs,
  },
  dateTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs / 2,
  },
  dateText: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  timeText: {
    ...typography.body,
    color: colors.textPrimary,
  },
  locationText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  selectedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  selectedText: {
    ...typography.label,
    color: colors.success,
    fontWeight: '600',
  },
  buttonContainer: {
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  },
});
