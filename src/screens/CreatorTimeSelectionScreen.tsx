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
import { googleCalendarService } from '../services/googleCalendarService';
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
  members?: { name: string; color: string }[];
}

interface ProposalWithUser extends any {
  user_name: string;
  user_color: string;
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
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [userColors, setUserColors] = useState<Map<string, string>>(new Map());

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

      // Fetch user profiles for all proposals
      const userIds = [...new Set(proposalData.map((p: any) => p.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', userIds);

      // Assign colors to users
      const colors = [
        '#ef4444', '#f59e0b', '#10b981', '#3b82f6',
        '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'
      ];
      const colorMap = new Map<string, string>();
      const profileMap = new Map(profiles?.map(p => [p.id, p.name]) || []);

      userIds.forEach((userId, index) => {
        colorMap.set(userId, colors[index % colors.length]);
      });
      setUserColors(colorMap);

      // Enhance proposals with user info
      const enhancedProposals = proposalData.map((p: any) => ({
        ...p,
        user_name: profileMap.get(p.user_id) || 'Unknown',
        user_color: colorMap.get(p.user_id) || '#6b7280'
      }));

      setProposals(enhancedProposals);
      setProposalCount(count);
      const teamMembersOnly = acceptedCount; // Don't include creator
      setTotalMembers(teamMembersOnly);

      // Analyze time slots with member information
      const analyzed = kickoffService.analyzeBestTimeSlots(enhancedProposals);
      const formatted = analyzed.map((slot) => {
        const date = new Date(slot.datetime);

        // Find all members who proposed this time slot
        const members = enhancedProposals
          .filter((p: any) => p.proposed_slots.some((s: any) => s.datetime === slot.datetime))
          .map((p: any) => ({
            name: p.user_name,
            color: p.user_color
          }));

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
          members
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

  // Helper to group slots by date for calendar view
  const getCalendarData = () => {
    const grouped = new Map<string, AnalyzedSlot[]>();

    analyzedSlots.forEach(slot => {
      const date = new Date(slot.datetime).toDateString();
      if (!grouped.has(date)) {
        grouped.set(date, []);
      }
      grouped.get(date)!.push(slot);
    });

    // Sort by date
    const sorted = Array.from(grouped.entries()).sort((a, b) =>
      new Date(a[0]).getTime() - new Date(b[0]).getTime()
    );

    return sorted;
  };

  const createGoogleCalendarEvent = async (slot: AnalyzedSlot, memberIds: string[]) => {
    try {
      // Check if user is authenticated with Google
      const isAuthenticated = await googleCalendarService.isAuthenticated();

      if (!isAuthenticated) {
        // Ask user if they want to connect Google Calendar
        Alert.alert(
          'Connect Google Calendar?',
          'Would you like to add this event to Google Calendar? This will help you and your team members keep track of the meeting.',
          [
            { text: 'Skip', style: 'cancel' },
            {
              text: 'Connect',
              onPress: async () => {
                const success = await googleCalendarService.authenticate();
                if (success) {
                  // Retry creating the event after authentication
                  await createCalendarEventWithAuth(slot, memberIds);
                }
              },
            },
          ]
        );
        return;
      }

      await createCalendarEventWithAuth(slot, memberIds);
    } catch (error) {
      console.error('Error with Google Calendar:', error);
      // Don't block the main flow if calendar fails
    }
  };

  const createCalendarEventWithAuth = async (slot: AnalyzedSlot, memberIds: string[]) => {
    try {
      // Get team member emails
      const { data: profiles } = await supabase
        .from('profiles')
        .select('email')
        .in('id', memberIds);

      const attendeeEmails = profiles?.map((p) => p.email).filter(Boolean) || [];

      // Calculate end time (1 hour meeting by default)
      const startTime = new Date(slot.datetime);
      const endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // +1 hour

      const result = await googleCalendarService.createCalendarEvent({
        summary: `${pursuit.title} - Kick-Off Meeting`,
        description: `Kick-off meeting for the ${pursuit.title} pursuit.\n\n${pursuit.description}`,
        location: slot.location_type === 'video' ? 'Video Call' : 'In-Person',
        start: startTime.toISOString(),
        end: endTime.toISOString(),
        attendees: attendeeEmails,
      });

      if (result.success) {
        console.log('✅ Google Calendar event created:', result.eventId);
      } else {
        console.error('❌ Failed to create calendar event:', result.error);
      }
    } catch (error) {
      console.error('Error creating calendar event:', error);
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

              // Create Google Calendar event
              await createGoogleCalendarEvent(selectedSlot, memberIds);

              Alert.alert(
                '✅ Kickoff Scheduled!',
                `The kickoff meeting has been scheduled for ${selectedSlot.formattedDate} at ${selectedSlot.formattedTime}. All team members have been notified.\n\nYour pursuit is now Active!`,
                [
                  {
                    text: 'OK',
                    onPress: () => {
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
              Only {proposalCount} out of {totalMembers} team members have submitted their time
              preferences. You can wait for more responses or proceed with the current proposals.
            </Text>
          </View>
        )}

        {/* Team Member Legend */}
        {proposals.length > 0 && (
          <View style={styles.legendCard}>
            <Text style={styles.legendTitle}>Team Members</Text>
            <View style={styles.legendItems}>
              {Array.from(userColors.entries()).map(([userId, color]) => {
                const proposal = proposals.find((p: any) => p.user_id === userId);
                return (
                  <View key={userId} style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: color }]} />
                    <Text style={styles.legendText}>{proposal?.user_name}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* View Toggle */}
        <View style={styles.viewToggle}>
          <TouchableOpacity
            style={[styles.toggleButton, viewMode === 'calendar' && styles.toggleButtonActive]}
            onPress={() => setViewMode('calendar')}
          >
            <Ionicons
              name="calendar"
              size={20}
              color={viewMode === 'calendar' ? colors.white : colors.textSecondary}
            />
            <Text style={[styles.toggleText, viewMode === 'calendar' && styles.toggleTextActive]}>
              Calendar
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, viewMode === 'list' && styles.toggleButtonActive]}
            onPress={() => setViewMode('list')}
          >
            <Ionicons
              name="list"
              size={20}
              color={viewMode === 'list' ? colors.white : colors.textSecondary}
            />
            <Text style={[styles.toggleText, viewMode === 'list' && styles.toggleTextActive]}>
              List
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>
          Select the Best Time
        </Text>
        <Text style={styles.sectionSubtitle}>
          {viewMode === 'calendar'
            ? 'Colored blocks show each member\'s availability. Darker colors indicate more overlaps.'
            : 'Time slots are ranked by popularity (how many members chose each time)'}
        </Text>

        {analyzedSlots.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={64} color={colors.textTertiary} />
            <Text style={styles.emptyStateText}>No time slots proposed yet</Text>
            <Text style={styles.emptyStateSubtext}>
              Waiting for team members to submit their availability...
            </Text>
          </View>
        ) : viewMode === 'calendar' ? (
          // Calendar View
          getCalendarData().map(([date, slots]) => (
            <View key={date} style={styles.calendarDay}>
              <Text style={styles.calendarDate}>
                {new Date(date).toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric'
                })}
              </Text>
              <View style={styles.calendarSlots}>
                {slots
                  .sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime())
                  .map((slot) => (
                    <TouchableOpacity
                      key={slot.datetime}
                      style={[
                        styles.calendarSlotCard,
                        selectedSlot?.datetime === slot.datetime && styles.calendarSlotCardSelected,
                      ]}
                      onPress={() => setSelectedSlot(slot)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.calendarSlotTime}>{slot.formattedTime}</Text>
                      <View style={styles.calendarSlotMembers}>
                        {slot.members?.map((member, idx) => (
                          <View
                            key={idx}
                            style={[
                              styles.memberDot,
                              { backgroundColor: member.color }
                            ]}
                          />
                        ))}
                      </View>
                      <View style={styles.calendarSlotLocation}>
                        <Ionicons
                          name={slot.location_type === 'video' ? 'videocam' : 'people'}
                          size={14}
                          color={colors.textSecondary}
                        />
                      </View>
                      {selectedSlot?.datetime === slot.datetime && (
                        <View style={styles.calendarSlotCheck}>
                          <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                        </View>
                      )}
                    </TouchableOpacity>
                  ))}
              </View>
            </View>
          ))
        ) : (
          // List View
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
                {/* Member indicators */}
                {slot.members && slot.members.length > 0 && (
                  <View style={styles.membersRow}>
                    <Ionicons name="people" size={16} color={colors.textSecondary} />
                    <View style={styles.memberBadges}>
                      {slot.members.map((member, idx) => (
                        <View key={idx} style={styles.memberBadge}>
                          <View style={[styles.memberBadgeDot, { backgroundColor: member.color }]} />
                          <Text style={styles.memberBadgeName}>{member.name}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
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
              title={submitting ? 'Scheduling...' : 'Send Kick-Off Invites'}
              onPress={handleSelectTime}
              disabled={submitting}
              loading={submitting}
              fullWidth
            />
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

  // Legend
  legendCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  legendTitle: {
    ...typography.label,
    color: colors.textPrimary,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  legendItems: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.base,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    ...typography.caption,
    color: colors.textPrimary,
  },

  // View Toggle
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.xs / 2,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  toggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.base,
  },
  toggleButtonActive: {
    backgroundColor: colors.primary,
  },
  toggleText: {
    ...typography.body,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  toggleTextActive: {
    color: colors.white,
    fontWeight: '600',
  },

  // Calendar View
  calendarDay: {
    marginBottom: spacing.lg,
  },
  calendarDate: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  calendarSlots: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  calendarSlotCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.base,
    padding: spacing.sm,
    minWidth: 100,
    borderWidth: 2,
    borderColor: colors.border,
    ...shadows.sm,
  },
  calendarSlotCardSelected: {
    borderColor: colors.success,
    ...shadows.md,
  },
  calendarSlotTime: {
    ...typography.label,
    color: colors.textPrimary,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  calendarSlotMembers: {
    flexDirection: 'row',
    gap: 4,
    marginVertical: spacing.xs,
    flexWrap: 'wrap',
  },
  memberDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.white,
  },
  calendarSlotLocation: {
    marginTop: spacing.xs / 2,
  },
  calendarSlotCheck: {
    position: 'absolute',
    top: 4,
    right: 4,
  },

  // Member Badges (for list view)
  membersRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  memberBadges: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  memberBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs / 2,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs / 2,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.base,
  },
  memberBadgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  memberBadgeName: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 11,
  },
});
