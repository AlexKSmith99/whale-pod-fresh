import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, TextInput, Platform, Modal, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuth } from '../contexts/AuthContext';
import { meetingService } from '../services/meetingService';
import { agoraService } from '../services/agoraService';
import { notificationService } from '../services/notificationService';
import { supabase } from '../config/supabase';
import { podChatService } from '../services/podChatService';
import { colors as legacyColors, typography, spacing, borderRadius, shadows } from '../theme/designSystem';
import { useTheme } from '../theme/ThemeContext';
import { getThemedStyles } from '../theme/themedStyles';
import GrainTexture from '../components/ui/GrainTexture';

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
  const { theme, isNewTheme } = useTheme();
  const colors = theme.colors;
  const themedStyles = getThemedStyles(colors, isNewTheme);
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
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [scheduledDateTimeText, setScheduledDateTimeText] = useState('');

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

              // Store the scheduled date/time for the message
              const scheduledText = `${displayDateTime!.date} at ${displayDateTime!.time}`;
              setScheduledDateTimeText(scheduledText);

              // Show success modal with option to send pod chat message
              setShowSuccessModal(true);
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

  const handleSendPodChatMessage = async () => {
    try {
      const message = `Hey guys I scheduled our kick-off meeting for ${scheduledDateTimeText}`;
      await podChatService.sendMessage(pursuitId, user!.id, message);
      setShowSuccessModal(false);
      onScheduled();
      onClose();
    } catch (error) {
      console.error('Error sending pod chat message:', error);
      // Still close and proceed even if message fails
      setShowSuccessModal(false);
      onScheduled();
      onClose();
    }
  };

  const handleCloseSuccessModal = () => {
    setShowSuccessModal(false);
    onScheduled();
    onClose();
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

  // Dynamic accent color for primary
  const accentColor = isNewTheme ? colors.accentGreen : legacyColors.primary;

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
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isNewTheme ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      {isNewTheme && <GrainTexture opacity={0.06} />}
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={28} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary, fontFamily: isNewTheme ? 'NothingYouCouldDo_400Regular' : undefined }]}>Schedule Kickoff</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          <View style={[styles.introSection, { backgroundColor: isNewTheme ? colors.warningLight : legacyColors.warningLight }]}>
            <Text style={[styles.pursuitTitle, { color: colors.warning, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>{pursuitTitle}</Text>
            <Text style={[styles.introText, { color: colors.textSecondary, fontFamily: isNewTheme ? 'KleeOne_400Regular' : undefined }]}>
              Review all time proposals from your team members and select the final meeting time.
            </Text>
            <Text style={[styles.statsText, { color: colors.warning, fontFamily: isNewTheme ? 'KleeOne_400Regular' : undefined }]}>
              {proposals.length}/{teamMembersCount} team member{teamMembersCount !== 1 ? 's' : ''} submitted proposals
            </Text>
            {proposals.length < teamMembersCount && (
              <Text style={[styles.warningText, { color: colors.error, fontFamily: isNewTheme ? 'KleeOne_400Regular' : undefined }]}>
                Waiting for {teamMembersCount - proposals.length} more team member{teamMembersCount - proposals.length !== 1 ? 's' : ''} to submit
              </Text>
            )}
          </View>

          {/* Proposed Times Calendar */}
          <Text style={[styles.sectionTitle, { color: colors.textPrimary, fontFamily: isNewTheme ? 'NothingYouCouldDo_400Regular' : undefined }]}>Proposed Meeting Times</Text>

          {/* Legend */}
          {Object.keys(groupedTimeSlots).length > 0 && (
            <View style={[styles.legend, { backgroundColor: colors.backgroundSecondary }]}>
              <Text style={[styles.legendTitle, { color: colors.textPrimary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>Team Members:</Text>
              <View style={styles.legendItems}>
                {proposals.map((proposal) => (
                  <View key={proposal.user_id} style={styles.legendItem}>
                    <View style={[styles.legendColor, { backgroundColor: teamMemberColors[proposal.user_id] }]} />
                    <Text style={[styles.legendText, { color: colors.textSecondary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>{proposal.user?.name || 'Team member'}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {Object.keys(groupedTimeSlots).length === 0 ? (
            <View style={[styles.emptyState, { backgroundColor: colors.surface }]}>
              <Ionicons name="time-outline" size={48} color={colors.textTertiary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary, fontFamily: isNewTheme ? 'KleeOne_400Regular' : undefined }]}>No proposals yet</Text>
              <Text style={[styles.emptySubtext, { color: colors.textTertiary, fontFamily: isNewTheme ? 'KleeOne_400Regular' : undefined }]}>Waiting for team members to submit their availability</Text>
            </View>
          ) : (
            Object.keys(groupedTimeSlots).sort().map((date) => (
              <View key={date} style={styles.dateGroup}>
                <Text style={[styles.dateHeader, { color: colors.textPrimary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>
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
                        { backgroundColor: colors.surface, borderColor: isSelected ? accentColor : 'transparent' },
                        isSelected && { backgroundColor: isNewTheme ? colors.primaryLight : legacyColors.primaryLight }
                      ]}
                      onPress={() => {
                        setSelectedTime(firstSlot);
                        setUseCustomTime(false);
                      }}
                    >
                      <View style={styles.timeSlotInfo}>
                        <Text style={[styles.timeSlotTime, { color: colors.textPrimary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>
                          {formatTime12Hour(firstSlot.start_time)} - {formatTime12Hour(firstSlot.end_time)}
                        </Text>
                        <View style={styles.teamMembersRow}>
                          {slots.map((slot, idx) => (
                            <View key={idx} style={[styles.memberBadge, { backgroundColor: colors.backgroundSecondary }]}>
                              <View style={[styles.memberColorDot, { backgroundColor: slot.color }]} />
                              <Text style={[styles.memberName, { color: colors.textSecondary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>{slot.proposer?.name || 'Team member'}</Text>
                            </View>
                          ))}
                        </View>
                        {slots.length > 1 && (
                          <Text style={[styles.overlapText, { color: colors.success, fontFamily: isNewTheme ? 'KleeOne_400Regular' : undefined }]}>
                            {slots.length} members available
                          </Text>
                        )}
                      </View>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={24} color={accentColor} />
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
              { backgroundColor: colors.surface, borderColor: useCustomTime ? accentColor : colors.borderLight },
              useCustomTime && { backgroundColor: isNewTheme ? colors.primaryLight : legacyColors.primaryLight, borderStyle: 'solid' as const }
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
                color={useCustomTime ? accentColor : colors.textSecondary}
              />
              <View style={styles.customTimeTextContainer}>
                <Text style={[
                  styles.customTimeButtonText,
                  { color: useCustomTime ? accentColor : colors.textSecondary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }
                ]}>
                  Schedule for a different time
                </Text>
                <Text style={[styles.customTimeSubtext, { color: colors.textTertiary, fontFamily: isNewTheme ? 'KleeOne_400Regular' : undefined }]}>
                  Choose your own date and time
                </Text>
              </View>
            </View>
            {useCustomTime && (
              <Ionicons name="checkmark-circle" size={24} color={accentColor} />
            )}
          </TouchableOpacity>

          {/* Custom Date/Time Picker */}
          {useCustomTime && (
            <View style={[styles.customTimePickerSection, { backgroundColor: colors.surface }]}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>Select Date</Text>
              <TouchableOpacity
                style={[styles.dateTimeButton, { backgroundColor: colors.backgroundSecondary }]}
                onPress={() => setShowDatePicker(true)}
              >
                <Ionicons name="calendar" size={20} color={accentColor} />
                <Text style={[styles.dateTimeButtonText, { color: colors.textPrimary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>
                  {customDate.toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </Text>
              </TouchableOpacity>

              <Text style={[styles.inputLabel, { color: colors.textSecondary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>Select Time</Text>
              <TouchableOpacity
                style={[styles.dateTimeButton, { backgroundColor: colors.backgroundSecondary }]}
                onPress={() => setShowTimePicker(true)}
              >
                <Ionicons name="time" size={20} color={accentColor} />
                <Text style={[styles.dateTimeButtonText, { color: colors.textPrimary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>
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
                    style={[styles.pickerOverlay, { backgroundColor: isNewTheme ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.5)' }]}
                    activeOpacity={1}
                    onPress={() => setShowDatePicker(false)}
                  >
                    <View style={[styles.pickerModalContent, { backgroundColor: colors.surface }]}>
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
                        style={[styles.doneButton, { backgroundColor: accentColor }]}
                        onPress={() => setShowDatePicker(false)}
                      >
                        <Text style={[styles.doneButtonText, { color: isNewTheme ? colors.background : legacyColors.white, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>Done</Text>
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
                    style={[styles.pickerOverlay, { backgroundColor: isNewTheme ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.5)' }]}
                    activeOpacity={1}
                    onPress={() => setShowTimePicker(false)}
                  >
                    <View style={[styles.pickerModalContent, { backgroundColor: colors.surface }]}>
                      <DateTimePicker
                        value={customTime}
                        mode="time"
                        display="spinner"
                        onChange={(event, time) => {
                          if (time) setCustomTime(time);
                        }}
                      />
                      <TouchableOpacity
                        style={[styles.doneButton, { backgroundColor: accentColor }]}
                        onPress={() => setShowTimePicker(false)}
                      >
                        <Text style={[styles.doneButtonText, { color: isNewTheme ? colors.background : legacyColors.white, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>Done</Text>
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
              <Text style={[styles.sectionTitle, { color: colors.textPrimary, fontFamily: isNewTheme ? 'NothingYouCouldDo_400Regular' : undefined }]}>Meeting Type</Text>
              <View style={styles.chipContainer}>
                {(['in_person', 'video', 'hybrid'] as const).map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.chip,
                      { backgroundColor: colors.backgroundSecondary, borderColor: colors.borderLight },
                      meetingType === type && { backgroundColor: accentColor, borderColor: accentColor }
                    ]}
                    onPress={() => setMeetingType(type)}
                  >
                    <Text style={[
                      styles.chipText,
                      { color: colors.textSecondary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined },
                      meetingType === type && { color: isNewTheme ? colors.background : legacyColors.white }
                    ]}>
                      {type === 'in_person' ? 'In Person' : type === 'video' ? 'Video' : 'Hybrid'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Location (if needed) */}
              {(meetingType === 'in_person' || meetingType === 'hybrid') && (
                <>
                  <Text style={[styles.inputLabel, { color: colors.textSecondary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>Location</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.borderLight, color: colors.textPrimary }]}
                    placeholder="e.g., Conference Room A"
                    placeholderTextColor={colors.textTertiary}
                    value={location}
                    onChangeText={setLocation}
                  />
                </>
              )}

              {/* Duration */}
              <Text style={[styles.inputLabel, { color: colors.textSecondary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>Duration (minutes)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.borderLight, color: colors.textPrimary }]}
                placeholder="60"
                placeholderTextColor={colors.textTertiary}
                value={duration}
                onChangeText={setDuration}
                keyboardType="numeric"
              />

              {/* Schedule Button */}
              <TouchableOpacity
                style={[styles.scheduleButton, { backgroundColor: colors.warning }, loading && styles.scheduleButtonDisabled]}
                onPress={handleScheduleKickoff}
                disabled={loading}
              >
                <Text style={[styles.scheduleButtonText, { color: isNewTheme ? colors.background : legacyColors.white, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>
                  {loading ? 'Sending Invites...' : 'Send Kick-Off Invites'}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>

      {/* Success Modal with Pod Chat Message Option */}
      <Modal
        visible={showSuccessModal}
        transparent
        animationType="fade"
        onRequestClose={handleCloseSuccessModal}
      >
        <View style={styles.successModalOverlay}>
          <View style={[styles.successModalContent, { backgroundColor: colors.surface }]}>
            {/* Close button */}
            <TouchableOpacity
              style={styles.successModalClose}
              onPress={handleCloseSuccessModal}
            >
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>

            {/* Success icon and message */}
            <View style={styles.successIconContainer}>
              <Ionicons name="checkmark-circle" size={60} color={colors.success} />
            </View>
            <Text style={[styles.successModalTitle, { color: colors.textPrimary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>
              Kick-Off Scheduled!
            </Text>
            <Text style={[styles.successModalSubtitle, { color: colors.textSecondary, fontFamily: isNewTheme ? 'KleeOne_400Regular' : undefined }]}>
              Let your team members know in the Pod Chat
            </Text>

            {/* Pre-curated message preview */}
            <View style={[styles.messagePreview, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
              <Text style={[styles.messagePreviewText, { color: colors.textPrimary, fontFamily: isNewTheme ? 'KleeOne_400Regular' : undefined }]}>
                "Hey guys I scheduled our kick-off meeting for {scheduledDateTimeText}"
              </Text>
            </View>

            {/* Send button */}
            <TouchableOpacity
              style={[styles.sendMessageButton, { backgroundColor: accentColor }]}
              onPress={handleSendPodChatMessage}
            >
              <Ionicons name="send" size={20} color={isNewTheme ? colors.background : '#fff'} />
              <Text style={[styles.sendMessageButtonText, { color: isNewTheme ? colors.background : '#fff', fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>
                Send Message
              </Text>
            </TouchableOpacity>

            {/* Skip option */}
            <TouchableOpacity
              style={styles.skipButton}
              onPress={handleCloseSuccessModal}
            >
              <Text style={[styles.skipButtonText, { color: colors.textTertiary, fontFamily: isNewTheme ? 'KleeOne_400Regular' : undefined }]}>
                Skip for now
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: legacyColors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 50,
    paddingBottom: spacing.base,
    paddingHorizontal: spacing.lg,
    backgroundColor: legacyColors.white,
    borderBottomWidth: 1,
    borderBottomColor: legacyColors.borderLight,
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
    color: legacyColors.textPrimary,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing['4xl'],
  },
  introSection: {
    backgroundColor: legacyColors.warningLight,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.xl,
  },
  pursuitTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: legacyColors.warning,
    marginBottom: spacing.sm,
  },
  introText: {
    fontSize: typography.fontSize.sm,
    color: legacyColors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  statsText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: legacyColors.warning,
  },
  warningText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: legacyColors.error,
    marginTop: spacing.sm,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: legacyColors.textPrimary,
    marginBottom: spacing.base,
    marginTop: spacing.lg,
  },
  emptyState: {
    alignItems: 'center',
    padding: spacing['3xl'],
    backgroundColor: legacyColors.white,
    borderRadius: borderRadius.lg,
  },
  emptyText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: legacyColors.textSecondary,
    marginTop: spacing.base,
  },
  emptySubtext: {
    fontSize: typography.fontSize.sm,
    color: legacyColors.textTertiary,
    marginTop: spacing.xs,
  },
  dateGroup: {
    marginBottom: spacing.lg,
  },
  dateHeader: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: legacyColors.textPrimary,
    marginBottom: spacing.sm,
    paddingLeft: spacing.sm,
  },
  timeSlotOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: legacyColors.white,
    padding: spacing.lg,
    borderRadius: borderRadius.base,
    marginBottom: spacing.sm,
    ...shadows.sm,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  timeSlotSelected: {
    borderColor: legacyColors.primary,
    backgroundColor: legacyColors.primaryLight,
  },
  timeSlotInfo: {
    flex: 1,
  },
  timeSlotTime: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: legacyColors.textPrimary,
    marginBottom: spacing.xs,
  },
  timeSlotProposer: {
    fontSize: typography.fontSize.sm,
    color: legacyColors.textSecondary,
  },
  legend: {
    backgroundColor: legacyColors.backgroundSecondary,
    padding: spacing.base,
    borderRadius: borderRadius.base,
    marginBottom: spacing.base,
  },
  legendTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: legacyColors.textPrimary,
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
    color: legacyColors.textSecondary,
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
    backgroundColor: legacyColors.backgroundSecondary,
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
    color: legacyColors.textSecondary,
  },
  overlapText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: legacyColors.success,
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
    backgroundColor: legacyColors.backgroundSecondary,
    borderWidth: 1,
    borderColor: legacyColors.borderLight,
  },
  chipSelected: {
    backgroundColor: legacyColors.primary,
    borderColor: legacyColors.primary,
  },
  chipText: {
    fontSize: typography.fontSize.sm,
    color: legacyColors.textSecondary,
    fontWeight: typography.fontWeight.medium,
  },
  chipTextSelected: {
    color: legacyColors.white,
    fontWeight: typography.fontWeight.bold,
  },
  inputLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: legacyColors.textSecondary,
    marginBottom: spacing.xs,
    marginTop: spacing.base,
  },
  input: {
    backgroundColor: legacyColors.white,
    borderWidth: 1,
    borderColor: legacyColors.borderLight,
    borderRadius: borderRadius.base,
    padding: spacing.base,
    fontSize: typography.fontSize.base,
    color: legacyColors.textPrimary,
  },
  scheduleButton: {
    backgroundColor: legacyColors.warning,
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
    color: legacyColors.white,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
  },
  customTimeButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: legacyColors.white,
    padding: spacing.lg,
    borderRadius: borderRadius.base,
    marginTop: spacing.lg,
    ...shadows.sm,
    borderWidth: 2,
    borderColor: legacyColors.borderLight,
    borderStyle: 'dashed',
  },
  customTimeButtonSelected: {
    borderColor: legacyColors.primary,
    borderStyle: 'solid',
    backgroundColor: legacyColors.primaryLight,
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
    color: legacyColors.textSecondary,
  },
  customTimeButtonTextSelected: {
    color: legacyColors.primary,
  },
  customTimeSubtext: {
    fontSize: typography.fontSize.sm,
    color: legacyColors.textTertiary,
    marginTop: 2,
  },
  customTimePickerSection: {
    backgroundColor: legacyColors.white,
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
    backgroundColor: legacyColors.white,
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
    paddingBottom: spacing.xl,
  },
  doneButton: {
    backgroundColor: legacyColors.primary,
    padding: spacing.sm,
    alignItems: 'center',
  },
  doneButtonText: {
    color: legacyColors.white,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold as any,
  },
  dateTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: legacyColors.backgroundSecondary,
    padding: spacing.base,
    borderRadius: borderRadius.base,
    marginBottom: spacing.base,
    gap: spacing.sm,
  },
  dateTimeButtonText: {
    fontSize: typography.fontSize.base,
    color: legacyColors.textPrimary,
    fontWeight: typography.fontWeight.medium,
  },
  successModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  successModalContent: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: legacyColors.white,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    ...shadows.lg,
  },
  successModalClose: {
    position: 'absolute',
    top: spacing.base,
    right: spacing.base,
    padding: spacing.xs,
  },
  successIconContainer: {
    marginBottom: spacing.base,
  },
  successModalTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: legacyColors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  successModalSubtitle: {
    fontSize: typography.fontSize.sm,
    color: legacyColors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  messagePreview: {
    width: '100%',
    backgroundColor: legacyColors.backgroundSecondary,
    borderRadius: borderRadius.base,
    padding: spacing.base,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: legacyColors.borderLight,
  },
  messagePreviewText: {
    fontSize: typography.fontSize.sm,
    color: legacyColors.textPrimary,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  sendMessageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: legacyColors.primary,
    paddingVertical: spacing.base,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.base,
    width: '100%',
    gap: spacing.sm,
    marginBottom: spacing.base,
  },
  sendMessageButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: legacyColors.white,
  },
  skipButton: {
    padding: spacing.sm,
  },
  skipButtonText: {
    fontSize: typography.fontSize.sm,
    color: legacyColors.textTertiary,
  },
});
