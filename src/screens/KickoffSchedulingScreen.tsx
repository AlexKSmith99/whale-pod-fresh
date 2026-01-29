import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, TextInput, Platform, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuth } from '../contexts/AuthContext';
import { meetingService } from '../services/meetingService';
import { agoraService } from '../services/agoraService';
import { notificationService } from '../services/notificationService';
import { supabase } from '../config/supabase';
import { colors, typography, spacing, borderRadius, shadows } from '../theme/designSystem';

interface Props {
  pursuitId: string;
  pursuitTitle: string;
  onClose: () => void;
  onScheduled: () => void;
}

// Convert 24-hour time (HH:MM) to 12-hour AM/PM format
const formatTime12Hour = (time24: string): string => {
  if (!time24) return '';
  const [hours, minutes] = time24.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours % 12 || 12;
  return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
};

export default function KickoffSchedulingScreen({ pursuitId, pursuitTitle, onClose, onScheduled }: Props) {
  const { user } = useAuth();
  const [proposals, setProposals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTime, setSelectedTime] = useState<any>(null);
  const [meetingType, setMeetingType] = useState<'in_person' | 'video' | 'hybrid'>('video');
  const [location, setLocation] = useState('');
  const [duration, setDuration] = useState('60');
  const [teamMembersCount, setTeamMembersCount] = useState(0);
  const [useCustomTime, setUseCustomTime] = useState(false);
  const [customDate, setCustomDate] = useState(new Date());
  const [customTime, setCustomTime] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  useEffect(() => {
    loadProposals();
    loadTeamMembersCount();
  }, []);

  const loadProposals = async () => {
    try {
      setLoading(true);
      const data = await meetingService.getKickoffProposals(pursuitId);
      setProposals(data || []);
    } catch (error) {
      console.error('Error loading proposals:', error);
      Alert.alert('Error', 'Failed to load time proposals');
    } finally {
      setLoading(false);
    }
  };

  const loadTeamMembersCount = async () => {
    try {
      // Get all active/accepted team members excluding the creator
      const { data, error } = await supabase
        .from('team_members')
        .select('user_id')
        .eq('pursuit_id', pursuitId)
        .in('status', ['active', 'accepted'])
        .neq('user_id', user!.id); // Exclude creator

      if (error) throw error;
      setTeamMembersCount(data?.length || 0);
    } catch (error) {
      console.error('Error loading team members count:', error);
    }
  };

  const getScheduledDateTime = () => {
    if (useCustomTime) {
      // Combine custom date and time
      const combined = new Date(customDate);
      combined.setHours(customTime.getHours(), customTime.getMinutes(), 0, 0);
      return combined;
    } else if (selectedTime) {
      return new Date(`${selectedTime.date}T${selectedTime.start_time}`);
    }
    return null;
  };

  const getDisplayDateTime = () => {
    if (useCustomTime) {
      const dateStr = customDate.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      });
      const timeStr = customTime.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
      return { date: dateStr, time: timeStr };
    } else if (selectedTime) {
      const dateStr = new Date(selectedTime.date).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      });
      return { date: dateStr, time: formatTime12Hour(selectedTime.start_time) };
    }
    return null;
  };

  const handleScheduleKickoff = async () => {
    if (!useCustomTime && !selectedTime) {
      Alert.alert('Missing Selection', 'Please select a meeting time or choose a custom time');
      return;
    }

    if ((meetingType === 'in_person' || meetingType === 'hybrid') && !location.trim()) {
      Alert.alert('Missing Location', 'Please enter a location for the meeting');
      return;
    }

    const displayDateTime = getDisplayDateTime();
    if (!displayDateTime) return;

    Alert.alert(
      'Schedule Kickoff',
      `This will schedule the kickoff meeting for ${displayDateTime.date} at ${displayDateTime.time}. All team members will be notified.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Schedule',
          onPress: async () => {
            setLoading(true);
            try {
              // Get team members (both active and accepted)
              const { data: teamMembers, error: teamError } = await supabase
                .from('team_members')
                .select('user_id')
                .eq('pursuit_id', pursuitId)
                .in('status', ['active', 'accepted']);

              if (teamError) throw teamError;

              const participantIds = teamMembers?.map((tm: any) => tm.user_id) || [];

              // Add creator to participants if not already included
              if (!participantIds.includes(user!.id)) {
                participantIds.push(user!.id);
              }

              console.log(`📅 Creating kickoff meeting with ${participantIds.length} participants:`, participantIds);

              // Create scheduled time from selected proposal or custom time
              const scheduledDateTimeObj = getScheduledDateTime();
              if (!scheduledDateTimeObj) throw new Error('No scheduled time selected');
              const scheduledDateTime = scheduledDateTimeObj.toISOString();

              // Create the kickoff meeting
              const meeting = await meetingService.createMeeting({
                pursuit_id: pursuitId,
                creator_id: user!.id,
                title: `${pursuitTitle} - Kickoff Meeting`,
                description: 'Team kickoff meeting to get started on this pursuit',
                meeting_type: meetingType,
                location: meetingType !== 'video' ? location : undefined,
                scheduled_time: scheduledDateTime,
                duration_minutes: parseInt(duration) || 60,
                timezone: useCustomTime ? Intl.DateTimeFormat().resolvedOptions().timeZone : (selectedTime?.timezone || 'America/New_York'),
                is_kickoff: true,
                recording_enabled: meetingType === 'video',
                participant_ids: participantIds,
              });

              // If video meeting, generate Agora channel
              if (meetingType === 'video' || meetingType === 'hybrid') {
                const channelName = agoraService.generateChannelName(meeting.id);
                await agoraService.updateMeetingAgoraInfo(meeting.id, channelName);
              }

              // Update pursuit status to active
              const { error: statusError } = await supabase
                .from('pursuits')
                .update({ status: 'active' })
                .eq('id', pursuitId);

              if (statusError) throw statusError;

              // Send notifications to team members and creator
              try {
                // Format the date and time for notification
                const meetingDate = new Date(scheduledDateTime).toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric'
                });
                const meetingTime = displayDateTime!.time;

                // Notify team members (excluding creator)
                if (participantIds.length > 0) {
                  const teamMemberIds = participantIds.filter(id => id !== user!.id);
                  if (teamMemberIds.length > 0) {
                    // Get creator name for notification
                    const creatorName = user?.name || user?.email?.split('@')[0] || 'The creator';
                    await notificationService.notifyKickoffScheduledToTeam(
                      teamMemberIds,
                      pursuitId,
                      pursuitTitle,
                      creatorName,
                      meetingDate,
                      meetingTime
                    );
                  }
                }

                // Notify creator with different message about agenda
                await notificationService.notifyKickoffScheduledToCreator(
                  user!.id,
                  pursuitId,
                  pursuitTitle,
                  meetingDate,
                  meetingTime
                );
              } catch (notifError) {
                console.error('Error sending kickoff scheduled notification:', notifError);
                // Don't throw - notification failure shouldn't block scheduling
              }

              Alert.alert('Success!', 'Kickoff meeting scheduled successfully!', [
                {
                  text: 'OK',
                  onPress: () => {
                    onScheduled();
                    onClose();
                  }
                }
              ]);
            } catch (error: any) {
              console.error('Error scheduling kickoff:', error);
              Alert.alert('Error', error.message || 'Failed to schedule kickoff');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  // Group time slots by date and time for calendar view
  const groupedTimeSlots: { [key: string]: { [key: string]: any[] } } = {};
  const teamMemberColors: { [key: string]: string } = {};
  const colorPalette = [
    colors.primary,
    '#10b981', // green
    '#f59e0b', // amber
    '#8b5cf6', // purple
    '#ec4899', // pink
    '#06b6d4', // cyan
  ];

  // Assign colors to team members
  let colorIndex = 0;
  proposals.forEach((proposal) => {
    if (!teamMemberColors[proposal.user_id]) {
      teamMemberColors[proposal.user_id] = colorPalette[colorIndex % colorPalette.length];
      colorIndex++;
    }

    proposal.proposed_times.forEach((time: any) => {
      const timeKey = `${time.start_time}-${time.end_time}`;

      if (!groupedTimeSlots[time.date]) {
        groupedTimeSlots[time.date] = {};
      }
      if (!groupedTimeSlots[time.date][timeKey]) {
        groupedTimeSlots[time.date][timeKey] = [];
      }

      groupedTimeSlots[time.date][timeKey].push({
        ...time,
        user_id: proposal.user_id,
        proposer: proposal.user,
        timezone: proposal.timezone,
        color: teamMemberColors[proposal.user_id],
      });
    });
  });

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={28} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Schedule Kickoff</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          <View style={styles.introSection}>
            <Text style={styles.pursuitTitle}>{pursuitTitle}</Text>
            <Text style={styles.introText}>
              Review all time proposals from your team members and select the final meeting time.
            </Text>
            <Text style={styles.statsText}>
              {proposals.length}/{teamMembersCount} team member{teamMembersCount !== 1 ? 's' : ''} submitted proposals
            </Text>
            {proposals.length < teamMembersCount && (
              <Text style={styles.warningText}>
                ⚠️ Waiting for {teamMembersCount - proposals.length} more team member{teamMembersCount - proposals.length !== 1 ? 's' : ''} to submit
              </Text>
            )}
          </View>

          {/* Proposed Times Calendar */}
          <Text style={styles.sectionTitle}>Proposed Meeting Times</Text>

          {/* Legend */}
          {Object.keys(groupedTimeSlots).length > 0 && (
            <View style={styles.legend}>
              <Text style={styles.legendTitle}>Team Members:</Text>
              <View style={styles.legendItems}>
                {proposals.map((proposal) => (
                  <View key={proposal.user_id} style={styles.legendItem}>
                    <View style={[styles.legendColor, { backgroundColor: teamMemberColors[proposal.user_id] }]} />
                    <Text style={styles.legendText}>{proposal.user?.name || 'Team member'}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {Object.keys(groupedTimeSlots).length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="time-outline" size={48} color={colors.textTertiary} />
              <Text style={styles.emptyText}>No proposals yet</Text>
              <Text style={styles.emptySubtext}>Waiting for team members to submit their availability</Text>
            </View>
          ) : (
            Object.keys(groupedTimeSlots).sort().map((date) => (
              <View key={date} style={styles.dateGroup}>
                <Text style={styles.dateHeader}>
                  {new Date(date).toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </Text>

                {Object.keys(groupedTimeSlots[date]).sort().map((timeKey) => {
                  const slots = groupedTimeSlots[date][timeKey];
                  const firstSlot = slots[0];
                  const isSelected = !useCustomTime &&
                                    selectedTime &&
                                    selectedTime.date === date &&
                                    selectedTime.start_time === firstSlot.start_time &&
                                    selectedTime.end_time === firstSlot.end_time;

                  return (
                    <TouchableOpacity
                      key={`${date}-${timeKey}`}
                      style={[
                        styles.timeSlotOption,
                        isSelected && styles.timeSlotSelected
                      ]}
                      onPress={() => {
                        setSelectedTime(firstSlot);
                        setUseCustomTime(false);
                      }}
                    >
                      <View style={styles.timeSlotInfo}>
                        <Text style={styles.timeSlotTime}>
                          {formatTime12Hour(firstSlot.start_time)} - {formatTime12Hour(firstSlot.end_time)}
                        </Text>
                        <View style={styles.teamMembersRow}>
                          {slots.map((slot, idx) => (
                            <View key={idx} style={styles.memberBadge}>
                              <View style={[styles.memberColorDot, { backgroundColor: slot.color }]} />
                              <Text style={styles.memberName}>{slot.proposer?.name || 'Team member'}</Text>
                            </View>
                          ))}
                        </View>
                        {slots.length > 1 && (
                          <Text style={styles.overlapText}>
                            ✨ {slots.length} members available
                          </Text>
                        )}
                      </View>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))
          )}

          {/* Custom Time Option */}
          <TouchableOpacity
            style={[
              styles.customTimeButton,
              useCustomTime && styles.customTimeButtonSelected
            ]}
            onPress={() => {
              setUseCustomTime(true);
              setSelectedTime(null);
            }}
          >
            <View style={styles.customTimeButtonContent}>
              <Ionicons
                name="calendar-outline"
                size={24}
                color={useCustomTime ? colors.primary : colors.textSecondary}
              />
              <View style={styles.customTimeTextContainer}>
                <Text style={[
                  styles.customTimeButtonText,
                  useCustomTime && styles.customTimeButtonTextSelected
                ]}>
                  Schedule for a different time
                </Text>
                <Text style={styles.customTimeSubtext}>
                  Choose your own date and time
                </Text>
              </View>
            </View>
            {useCustomTime && (
              <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
            )}
          </TouchableOpacity>

          {/* Custom Date/Time Picker */}
          {useCustomTime && (
            <View style={styles.customTimePickerSection}>
              <Text style={styles.inputLabel}>Select Date</Text>
              <TouchableOpacity
                style={styles.dateTimeButton}
                onPress={() => setShowDatePicker(true)}
              >
                <Ionicons name="calendar" size={20} color={colors.primary} />
                <Text style={styles.dateTimeButtonText}>
                  {customDate.toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </Text>
              </TouchableOpacity>

              <Text style={styles.inputLabel}>Select Time</Text>
              <TouchableOpacity
                style={styles.dateTimeButton}
                onPress={() => setShowTimePicker(true)}
              >
                <Ionicons name="time" size={20} color={colors.primary} />
                <Text style={styles.dateTimeButtonText}>
                  {customTime.toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                  })}
                </Text>
              </TouchableOpacity>

              {showDatePicker && Platform.OS === 'ios' && (
                <Modal transparent animationType="fade" visible={showDatePicker}>
                  <TouchableOpacity 
                    style={styles.pickerOverlay} 
                    activeOpacity={1} 
                    onPress={() => setShowDatePicker(false)}
                  >
                    <View style={styles.pickerModalContent}>
                      <DateTimePicker
                        value={customDate}
                        mode="date"
                        display="spinner"
                        minimumDate={new Date()}
                        onChange={(event, date) => {
                          if (date) setCustomDate(date);
                        }}
                      />
                      <TouchableOpacity
                        style={styles.doneButton}
                        onPress={() => setShowDatePicker(false)}
                      >
                        <Text style={styles.doneButtonText}>Done</Text>
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                </Modal>
              )}
              {showDatePicker && Platform.OS === 'android' && (
                <DateTimePicker
                  value={customDate}
                  mode="date"
                  display="default"
                  minimumDate={new Date()}
                  onChange={(event, date) => {
                    setShowDatePicker(false);
                    if (date) setCustomDate(date);
                  }}
                />
              )}

              {showTimePicker && Platform.OS === 'ios' && (
                <Modal transparent animationType="fade" visible={showTimePicker}>
                  <TouchableOpacity 
                    style={styles.pickerOverlay} 
                    activeOpacity={1} 
                    onPress={() => setShowTimePicker(false)}
                  >
                    <View style={styles.pickerModalContent}>
                      <DateTimePicker
                        value={customTime}
                        mode="time"
                        display="spinner"
                        onChange={(event, time) => {
                          if (time) setCustomTime(time);
                        }}
                      />
                      <TouchableOpacity
                        style={styles.doneButton}
                        onPress={() => setShowTimePicker(false)}
                      >
                        <Text style={styles.doneButtonText}>Done</Text>
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                </Modal>
              )}
              {showTimePicker && Platform.OS === 'android' && (
                <DateTimePicker
                  value={customTime}
                  mode="time"
                  display="default"
                  onChange={(event, time) => {
                    setShowTimePicker(false);
                    if (time) setCustomTime(time);
                  }}
                />
              )}
            </View>
          )}

          {/* Meeting Type Selection */}
          {(selectedTime || useCustomTime) && (
            <>
              <Text style={styles.sectionTitle}>Meeting Type</Text>
              <View style={styles.chipContainer}>
                {(['in_person', 'video', 'hybrid'] as const).map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[styles.chip, meetingType === type && styles.chipSelected]}
                    onPress={() => setMeetingType(type)}
                  >
                    <Text style={[styles.chipText, meetingType === type && styles.chipTextSelected]}>
                      {type === 'in_person' ? 'In Person' : type === 'video' ? 'Video' : 'Hybrid'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Location (if needed) */}
              {(meetingType === 'in_person' || meetingType === 'hybrid') && (
                <>
                  <Text style={styles.inputLabel}>Location</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g., Conference Room A"
                    value={location}
                    onChangeText={setLocation}
                  />
                </>
              )}

              {/* Duration */}
              <Text style={styles.inputLabel}>Duration (minutes)</Text>
              <TextInput
                style={styles.input}
                placeholder="60"
                value={duration}
                onChangeText={setDuration}
                keyboardType="numeric"
              />

              {/* Schedule Button */}
              <TouchableOpacity
                style={[styles.scheduleButton, loading && styles.scheduleButtonDisabled]}
                onPress={handleScheduleKickoff}
                disabled={loading}
              >
                <Text style={styles.scheduleButtonText}>
                  {loading ? 'Sending Invites...' : 'Send Kick-Off Invites'}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 50,
    paddingBottom: spacing.base,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing['4xl'],
  },
  introSection: {
    backgroundColor: colors.warningLight,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.xl,
  },
  pursuitTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.warning,
    marginBottom: spacing.sm,
  },
  introText: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  statsText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.warning,
  },
  warningText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.error,
    marginTop: spacing.sm,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.base,
    marginTop: spacing.lg,
  },
  emptyState: {
    alignItems: 'center',
    padding: spacing['3xl'],
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
  },
  emptyText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textSecondary,
    marginTop: spacing.base,
  },
  emptySubtext: {
    fontSize: typography.fontSize.sm,
    color: colors.textTertiary,
    marginTop: spacing.xs,
  },
  dateGroup: {
    marginBottom: spacing.lg,
  },
  dateHeader: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    paddingLeft: spacing.sm,
  },
  timeSlotOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.white,
    padding: spacing.lg,
    borderRadius: borderRadius.base,
    marginBottom: spacing.sm,
    ...shadows.sm,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  timeSlotSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  timeSlotInfo: {
    flex: 1,
  },
  timeSlotTime: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  timeSlotProposer: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  legend: {
    backgroundColor: colors.backgroundSecondary,
    padding: spacing.base,
    borderRadius: borderRadius.base,
    marginBottom: spacing.base,
  },
  legendTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
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
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
  },
  teamMembersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  memberBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.backgroundSecondary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.base,
  },
  memberColorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  memberName: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
  },
  overlapText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.success,
    marginTop: spacing.xs,
  },
  chipContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
    marginBottom: spacing.base,
  },
  chip: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    fontWeight: typography.fontWeight.medium,
  },
  chipTextSelected: {
    color: colors.white,
    fontWeight: typography.fontWeight.bold,
  },
  inputLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    marginTop: spacing.base,
  },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: borderRadius.base,
    padding: spacing.base,
    fontSize: typography.fontSize.base,
    color: colors.textPrimary,
  },
  scheduleButton: {
    backgroundColor: colors.warning,
    borderRadius: borderRadius.base,
    padding: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.xl,
    ...shadows.base,
  },
  scheduleButtonDisabled: {
    opacity: 0.6,
  },
  scheduleButtonText: {
    color: colors.white,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
  },
  customTimeButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.white,
    padding: spacing.lg,
    borderRadius: borderRadius.base,
    marginTop: spacing.lg,
    ...shadows.sm,
    borderWidth: 2,
    borderColor: colors.borderLight,
    borderStyle: 'dashed',
  },
  customTimeButtonSelected: {
    borderColor: colors.primary,
    borderStyle: 'solid',
    backgroundColor: colors.primaryLight,
  },
  customTimeButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.base,
  },
  customTimeTextContainer: {
    flex: 1,
  },
  customTimeButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textSecondary,
  },
  customTimeButtonTextSelected: {
    color: colors.primary,
  },
  customTimeSubtext: {
    fontSize: typography.fontSize.sm,
    color: colors.textTertiary,
    marginTop: 2,
  },
  customTimePickerSection: {
    backgroundColor: colors.white,
    padding: spacing.lg,
    borderRadius: borderRadius.base,
    marginTop: spacing.base,
    ...shadows.sm,
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  pickerModalContent: {
    backgroundColor: colors.white,
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
    paddingBottom: spacing.xl,
  },
  doneButton: {
    backgroundColor: colors.primary,
    padding: spacing.sm,
    alignItems: 'center',
  },
  doneButtonText: {
    color: colors.white,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold as any,
  },
  dateTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundSecondary,
    padding: spacing.base,
    borderRadius: borderRadius.base,
    marginBottom: spacing.base,
    gap: spacing.sm,
  },
  dateTimeButtonText: {
    fontSize: typography.fontSize.base,
    color: colors.textPrimary,
    fontWeight: typography.fontWeight.medium,
  },
});
