import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, TextInput, Platform, Modal, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuth } from '../contexts/AuthContext';
import { meetingService } from '../services/meetingService';
import { agoraService } from '../services/agoraService';
import { notificationService } from '../services/notificationService';
import { supabase } from '../config/supabase';
import { colors as legacyColors, typography, spacing, borderRadius, shadows, editorial } from '../theme/designSystem';
import { useTheme } from '../theme/ThemeContext';
import { getThemedStyles } from '../theme/themedStyles';
import GrainTexture from '../components/ui/GrainTexture';

interface Props {
  applicationId: string;
  pursuitId: string;
  pursuitTitle: string;
  applicantId: string;
  applicantName: string;
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

export default function InterviewSchedulingScreen({
  applicationId,
  pursuitId,
  pursuitTitle,
  applicantId,
  applicantName,
  onClose,
  onScheduled
}: Props) {
  const { user } = useAuth();
  const { theme, isNewTheme } = useTheme();
  const colors = theme.colors;
  const themedStyles = getThemedStyles(colors, isNewTheme);
  const light = !isNewTheme;
  // Light mode uses Carolina blue as the discreet primary accent.
  const interviewAccent = editorial.carolina;
  const accentColor = isNewTheme ? colors.accentGreen : interviewAccent;
  const [proposedTimes, setProposedTimes] = useState<any[]>([]);
  const [timezone, setTimezone] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [applicationStatus, setApplicationStatus] = useState<string>('');
  const [scheduledTime, setScheduledTime] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<any>(null);
  const [meetingType, setMeetingType] = useState<'in_person' | 'video' | 'hybrid'>('video');
  const [location, setLocation] = useState('');
  const [duration, setDuration] = useState('30');
  const [useCustomTime, setUseCustomTime] = useState(false);
  const [customDate, setCustomDate] = useState(new Date());
  const [customTime, setCustomTime] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  useEffect(() => {
    loadProposedTimes();
  }, []);

  const loadProposedTimes = async () => {
    try {
      setLoading(true);
      console.log('🎤 Loading proposed times for applicationId:', applicationId);

      const { data, error } = await supabase
        .from('pursuit_applications')
        .select('id, status, interview_proposed_times, interview_timezone, interview_scheduled_time')
        .eq('id', applicationId)
        .single();

      console.log('🎤 Query result:', { data, error });

      if (error) throw error;

      console.log('🎤 Proposed times from DB:', data.interview_proposed_times);
      console.log('🎤 Application status:', data.status);

      setProposedTimes(data.interview_proposed_times || []);
      setTimezone(data.interview_timezone || 'America/New_York');
      setApplicationStatus(data.status || '');
      setScheduledTime(data.interview_scheduled_time || null);
    } catch (error) {
      console.error('Error loading proposed times:', error);
      Alert.alert('Error', 'Failed to load proposed interview times');
    } finally {
      setLoading(false);
    }
  };

  const getScheduledDateTime = () => {
    if (useCustomTime) {
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

  const handleScheduleInterview = async () => {
    if (!useCustomTime && !selectedTime) {
      Alert.alert('Missing Selection', 'Please select an interview time or choose a custom time');
      return;
    }

    if ((meetingType === 'in_person' || meetingType === 'hybrid') && !location.trim()) {
      Alert.alert('Missing Location', 'Please enter a location for the interview');
      return;
    }

    // Validate that the selected time is not in the past
    const scheduledDateTimeObj = getScheduledDateTime();
    if (scheduledDateTimeObj && scheduledDateTimeObj < new Date()) {
      Alert.alert('Invalid Time', 'You cannot schedule an interview in the past. Please select a future date and time.');
      return;
    }

    // Validate minimum duration (15 minutes)
    const durationNum = parseInt(duration) || 30;
    if (durationNum < 15) {
      Alert.alert('Invalid Duration', 'Interview duration must be at least 15 minutes.');
      return;
    }

    const displayDateTime = getDisplayDateTime();
    if (!displayDateTime) return;

    Alert.alert(
      'Schedule Interview',
      `This will schedule the interview with ${applicantName} for ${displayDateTime.date} at ${displayDateTime.time}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Schedule',
          onPress: async () => {
            setLoading(true);
            try {
              // Get scheduled time
              const scheduledDateTimeObj = getScheduledDateTime();
              if (!scheduledDateTimeObj) throw new Error('No scheduled time selected');
              const scheduledDateTime = scheduledDateTimeObj.toISOString();

              // Create the interview meeting with both creator and applicant
              const participantIds = [user!.id, applicantId];

              const meeting = await meetingService.createMeeting({
                pursuit_id: pursuitId,
                creator_id: user!.id,
                title: `Interview - ${pursuitTitle}`,
                description: `Interview for ${applicantName}'s application to ${pursuitTitle}`,
                meeting_type: meetingType,
                location: meetingType !== 'video' ? location : undefined,
                scheduled_time: scheduledDateTime,
                duration_minutes: parseInt(duration) || 30,
                timezone: useCustomTime ? Intl.DateTimeFormat().resolvedOptions().timeZone : timezone,
                is_kickoff: false,
                recording_enabled: meetingType === 'video',
                participant_ids: participantIds,
              });

              // If video meeting, generate Agora channel
              if (meetingType === 'video' || meetingType === 'hybrid') {
                const channelName = agoraService.generateChannelName(meeting.id);
                await agoraService.updateMeetingAgoraInfo(meeting.id, channelName);
              }

              // Atomically claim the application: only update if no interview is already scheduled.
              // Two reviewers racing both create a meeting; only one wins this UPDATE. The loser
              // deletes its orphan meeting and surfaces a conflict.
              const { data: claimed, error: appError } = await supabase
                .from('pursuit_applications')
                .update({
                  status: 'interview_scheduled',
                  interview_meeting_id: meeting.id,
                  interview_scheduled_time: scheduledDateTime,
                })
                .eq('id', applicationId)
                .is('interview_meeting_id', null)
                .select('id');

              if (appError) throw appError;

              if (!claimed || claimed.length === 0) {
                await meetingService.deleteMeeting(meeting.id).catch(() => {});
                throw new Error('Another reviewer just scheduled this interview. Please refresh.');
              }

              // Notify applicant about the scheduled interview
              const creatorName = user?.name || user?.email?.split('@')[0] || 'The creator';
              await notificationService.notifyInterviewScheduled(
                applicantId,
                applicationId,
                pursuitId,
                pursuitTitle,
                creatorName,
                displayDateTime.date,
                displayDateTime.time
              );

              Alert.alert('Success!', 'Interview scheduled successfully!', [
                {
                  text: 'OK',
                  onPress: () => {
                    onScheduled();
                    onClose();
                  }
                }
              ]);
            } catch (error: any) {
              console.error('Error scheduling interview:', error);
              Alert.alert('Error', error.message || 'Failed to schedule interview');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  // If the interview is already scheduled, show a summary with a link to the Calendar
  if (!loading && applicationStatus === 'interview_scheduled' && scheduledTime) {
    const scheduled = new Date(scheduledTime);
    const dateStr = scheduled.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    const timeStr = scheduled.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar barStyle={isNewTheme ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
        {isNewTheme && <GrainTexture opacity={0.06} />}
        <View style={[
          styles.header,
          { backgroundColor: colors.surface, borderBottomColor: colors.border },
          light && { backgroundColor: editorial.bg, borderBottomWidth: 0, shadowOpacity: 0, elevation: 0 },
        ]}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton} activeOpacity={0.6}>
            <Ionicons name="close" size={28} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.textPrimary, fontFamily: isNewTheme ? 'Sora_700Bold' : 'PlayfairDisplay_700Bold' }, light && { letterSpacing: -0.5 }]}>Interview Scheduled</Text>
          <View style={{ width: 28 }} />
        </View>

        <ScrollView style={styles.scrollView}>
          <View style={styles.content}>
            <View style={[
              styles.introSection,
              { backgroundColor: isNewTheme ? colors.primaryLight : '#f3e8ff', alignItems: 'center' },
              light && { backgroundColor: editorial.surface, borderWidth: 1, borderColor: editorial.hairline, borderRadius: 14, ...shadows.none },
            ]}>
              <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: light ? editorial.carolinaTint : 'rgba(134, 239, 172, 0.25)', justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}>
                <Ionicons name="checkmark-circle" size={36} color={colors.success} />
              </View>
              <Text style={[styles.pursuitTitle, { color: accentColor, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'PlayfairDisplay_700Bold', textAlign: 'center' }, light && { color: editorial.ink, fontSize: 24, letterSpacing: -0.3 }]}>{pursuitTitle}</Text>
              <Text style={[styles.applicantLabel, { color: colors.textSecondary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold', textAlign: 'center' }, light && { color: editorial.muted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6 }]}>Interview with:</Text>
              <Text style={[styles.applicantName, { color: colors.textPrimary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'PlayfairDisplay_700Bold', textAlign: 'center' }, light && { fontSize: 20, letterSpacing: -0.3 }]}>{applicantName}</Text>
              <Text style={[styles.introText, { color: colors.textPrimary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold', textAlign: 'center', marginTop: 12, fontSize: 16, fontWeight: '600' }, light && { color: editorial.ink }]}>
                Scheduled for {timeStr}
              </Text>
              <Text style={[styles.introText, { color: colors.textSecondary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold', textAlign: 'center', marginTop: 4 }, light && { color: editorial.muted }]}>
                {dateStr}
              </Text>
            </View>

            <TouchableOpacity
              style={[
                styles.scheduleButton,
                { backgroundColor: accentColor, marginTop: 12 },
                light && { backgroundColor: editorial.ink, borderRadius: 999, ...shadows.none },
              ]}
              onPress={onScheduled}
              activeOpacity={0.85}
            >
              <Ionicons name="calendar" size={18} color={isNewTheme ? colors.background : '#fff'} style={{ marginRight: 8 }} />
              <Text style={[styles.scheduleButtonText, { color: isNewTheme ? colors.background : '#fff', fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }, light && { letterSpacing: 0.2 }]}>
                View Meeting Details on Calendar
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isNewTheme ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      {isNewTheme && <GrainTexture opacity={0.06} />}
      {/* Header */}
      <View style={[
        styles.header,
        { backgroundColor: colors.surface, borderBottomColor: colors.border },
        light && { backgroundColor: editorial.bg, borderBottomWidth: 0, shadowOpacity: 0, elevation: 0 },
      ]}>
        <TouchableOpacity onPress={onClose} style={styles.closeButton} activeOpacity={0.6}>
          <Ionicons name="close" size={28} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary, fontFamily: isNewTheme ? 'Sora_700Bold' : 'PlayfairDisplay_700Bold' }, light && { letterSpacing: -0.5 }]}>Schedule Interview</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          <View style={[
            styles.introSection,
            { backgroundColor: isNewTheme ? colors.primaryLight : '#f3e8ff' },
            light && { backgroundColor: editorial.surface, borderWidth: 1, borderColor: editorial.hairline, borderRadius: 14, paddingLeft: 22, overflow: 'hidden', ...shadows.none },
          ]}>
            {light && <View style={styles.cardAccentLine} pointerEvents="none" />}
            <Text style={[styles.pursuitTitle, { color: accentColor, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'PlayfairDisplay_700Bold' }, light && { color: editorial.ink, fontSize: 24, letterSpacing: -0.3 }]}>{pursuitTitle}</Text>
            <Text style={[styles.applicantLabel, { color: colors.textSecondary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }, light && { color: editorial.muted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6 }]}>Interview with:</Text>
            <Text style={[styles.applicantName, { color: colors.textPrimary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'PlayfairDisplay_700Bold' }, light && { fontSize: 20, letterSpacing: -0.3 }]}>{applicantName}</Text>
            <Text style={[styles.introText, { color: colors.textSecondary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }, light && { color: editorial.muted, lineHeight: 20 }]}>
              Review the proposed times below and select when to schedule the interview.
            </Text>
          </View>

          {/* Proposed Times */}
          <Text style={[styles.sectionTitle, { color: colors.textPrimary, fontFamily: isNewTheme ? 'Sora_700Bold' : 'InterTight_600SemiBold' }, light && styles.sectionTitleLight]}>Proposed Interview Times</Text>

          {proposedTimes.length === 0 ? (
            <View style={[
              styles.emptyState,
              { backgroundColor: colors.surface },
              light && { borderWidth: 1, borderColor: editorial.hairline, borderRadius: 14 },
            ]}>
              <Ionicons name="time-outline" size={48} color={colors.textTertiary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }, light && { color: editorial.ink, fontFamily: 'PlayfairDisplay_700Bold' }]}>No times proposed yet</Text>
              <Text style={[styles.emptySubtext, { color: colors.textTertiary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }, light && { color: editorial.muted }]}>The applicant hasn't submitted their availability</Text>
            </View>
          ) : (
            proposedTimes.map((slot, index) => {
              const isSelected = !useCustomTime &&
                selectedTime &&
                selectedTime.date === slot.date &&
                selectedTime.start_time === slot.start_time;

              return (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.timeSlotOption,
                    { backgroundColor: colors.surface, borderColor: isSelected ? accentColor : 'transparent' },
                    isSelected && { backgroundColor: isNewTheme ? colors.primaryLight : '#f3e8ff' },
                    light && { borderWidth: 1, borderColor: editorial.hairline, borderRadius: 14, ...shadows.none },
                    light && isSelected && { backgroundColor: editorial.carolina, borderColor: editorial.carolina },
                  ]}
                  onPress={() => {
                    setSelectedTime(slot);
                    setUseCustomTime(false);
                  }}
                  activeOpacity={light ? 0.85 : 0.7}
                >
                  <View style={styles.timeSlotInfo}>
                    <Text style={[styles.timeSlotDate, { color: colors.textPrimary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }, light && { color: isSelected ? '#FFFFFF' : editorial.ink }]}>
                      {new Date(slot.date).toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </Text>
                    <Text style={[styles.timeSlotTime, { color: accentColor, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }, light && { color: isSelected ? '#FFFFFF' : editorial.muted }]}>
                      {formatTime12Hour(slot.start_time)} - {formatTime12Hour(slot.end_time)}
                    </Text>
                  </View>
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={24} color={light ? '#FFFFFF' : accentColor} />
                  )}
                </TouchableOpacity>
              );
            })
          )}

          {/* Custom Time Option */}
          <TouchableOpacity
            style={[
              styles.customTimeButton,
              { backgroundColor: colors.surface, borderColor: useCustomTime ? accentColor : colors.borderLight },
              useCustomTime && { backgroundColor: isNewTheme ? colors.primaryLight : '#f3e8ff', borderStyle: 'solid' as const },
              light && { borderWidth: 1, borderStyle: 'solid' as const, borderColor: useCustomTime ? editorial.carolina : editorial.hairline, borderRadius: 14, ...shadows.none },
              light && useCustomTime && { backgroundColor: editorial.carolinaTint },
            ]}
            onPress={() => {
              setUseCustomTime(true);
              setSelectedTime(null);
            }}
            activeOpacity={light ? 0.85 : 0.7}
          >
            <View style={styles.customTimeButtonContent}>
              <Ionicons
                name="calendar-outline"
                size={24}
                color={useCustomTime ? (light ? editorial.carolinaDeep : accentColor) : (light ? editorial.muted : colors.textSecondary)}
              />
              <View style={styles.customTimeTextContainer}>
                <Text style={[
                  styles.customTimeButtonText,
                  { color: useCustomTime ? accentColor : colors.textSecondary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' },
                  light && { color: useCustomTime ? editorial.carolinaDeep : editorial.ink },
                ]}>
                  Schedule for a different time
                </Text>
                <Text style={[styles.customTimeSubtext, { color: colors.textTertiary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }, light && { color: editorial.muted }]}>
                  Choose your own date and time
                </Text>
              </View>
            </View>
            {useCustomTime && (
              <Ionicons name="checkmark-circle" size={24} color={light ? editorial.carolinaDeep : accentColor} />
            )}
          </TouchableOpacity>

          {/* Custom Date/Time Picker */}
          {useCustomTime && (
            <View style={[
              styles.customTimePickerSection,
              { backgroundColor: colors.surface },
              light && { borderWidth: 1, borderColor: editorial.hairline, borderRadius: 14, ...shadows.none },
            ]}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }, light && styles.inputLabelLight]}>Select Date</Text>
              <TouchableOpacity
                style={[styles.dateTimeButton, { backgroundColor: colors.backgroundSecondary }, light && styles.dateTimeButtonLight]}
                onPress={() => setShowDatePicker(!showDatePicker)}
                activeOpacity={light ? 0.7 : 0.2}
              >
                <Ionicons name="calendar" size={20} color={accentColor} />
                <Text style={[styles.dateTimeButtonText, { color: colors.textPrimary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }, light && { color: editorial.ink }]}>
                  {customDate.toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </Text>
                <Ionicons name={showDatePicker ? "chevron-up" : "chevron-down"} size={16} color={accentColor} />
              </TouchableOpacity>

              {showDatePicker && Platform.OS === 'ios' && (
                <Modal transparent animationType="fade" visible={showDatePicker}>
                  <View
                    style={[styles.pickerOverlay, { backgroundColor: isNewTheme ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.5)' }]}
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
                        <Text style={[styles.doneButtonText, { color: isNewTheme ? colors.background : legacyColors.white, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>Done</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
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

              <Text style={[styles.inputLabel, { color: colors.textSecondary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }, light && styles.inputLabelLight]}>Select Time</Text>
              <TouchableOpacity
                style={[styles.dateTimeButton, { backgroundColor: colors.backgroundSecondary }, light && styles.dateTimeButtonLight]}
                onPress={() => setShowTimePicker(!showTimePicker)}
                activeOpacity={light ? 0.7 : 0.2}
              >
                <Ionicons name="time" size={20} color={accentColor} />
                <Text style={[styles.dateTimeButtonText, { color: colors.textPrimary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }, light && { color: editorial.ink }]}>
                  {customTime.toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                  })}
                </Text>
                <Ionicons name={showTimePicker ? "chevron-up" : "chevron-down"} size={16} color={accentColor} />
              </TouchableOpacity>

              {showTimePicker && Platform.OS === 'ios' && (
                <Modal transparent animationType="fade" visible={showTimePicker}>
                  <View
                    style={[styles.pickerOverlay, { backgroundColor: isNewTheme ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.5)' }]}
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
                        <Text style={[styles.doneButtonText, { color: isNewTheme ? colors.background : legacyColors.white, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>Done</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
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
              <Text style={[styles.sectionTitle, { color: colors.textPrimary, fontFamily: isNewTheme ? 'Sora_700Bold' : 'InterTight_600SemiBold' }, light && styles.sectionTitleLight]}>Meeting Type</Text>
              <View style={styles.chipContainer}>
                {(['in_person', 'video', 'hybrid'] as const).map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.chip,
                      { backgroundColor: colors.backgroundSecondary, borderColor: colors.borderLight },
                      meetingType === type && { backgroundColor: accentColor, borderColor: accentColor },
                      light && { backgroundColor: 'transparent', borderColor: editorial.hairline },
                      light && meetingType === type && { backgroundColor: editorial.carolina, borderColor: editorial.carolina },
                    ]}
                    onPress={() => setMeetingType(type)}
                    activeOpacity={light ? 0.85 : 0.7}
                  >
                    <Text style={[
                      styles.chipText,
                      { color: colors.textSecondary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' },
                      meetingType === type && { color: isNewTheme ? colors.background : legacyColors.white },
                      light && { color: meetingType === type ? '#FFFFFF' : editorial.ink },
                    ]}>
                      {type === 'in_person' ? 'In Person' : type === 'video' ? 'Video' : 'Hybrid'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Location (if needed) */}
              {(meetingType === 'in_person' || meetingType === 'hybrid') && (
                <>
                  <Text style={[styles.inputLabel, { color: colors.textSecondary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }, light && styles.inputLabelLight]}>Location</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.borderLight, color: colors.textPrimary }, light && styles.inputLight]}
                    placeholder="e.g., Coffee Shop, Office"
                    placeholderTextColor={colors.textTertiary}
                    value={location}
                    onChangeText={setLocation}
                  />
                </>
              )}

              {/* Duration */}
              <Text style={[styles.inputLabel, { color: colors.textSecondary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }, light && styles.inputLabelLight]}>Duration (minutes)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.borderLight, color: colors.textPrimary }, light && styles.inputLight]}
                placeholder="30"
                placeholderTextColor={colors.textTertiary}
                value={duration}
                onChangeText={setDuration}
                keyboardType="numeric"
              />

              {/* Schedule Button */}
              <TouchableOpacity
                style={[
                  styles.scheduleButton,
                  { backgroundColor: accentColor },
                  light && { backgroundColor: editorial.ink, borderRadius: 999, ...shadows.none },
                  loading && styles.scheduleButtonDisabled,
                ]}
                onPress={handleScheduleInterview}
                disabled={loading}
                activeOpacity={light ? 0.85 : 0.7}
              >
                <Text style={[styles.scheduleButtonText, { color: isNewTheme ? colors.background : legacyColors.white, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }, light && { letterSpacing: 0.2 }]}>
                  {loading ? 'Scheduling...' : 'Schedule Interview'}
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
    backgroundColor: '#f3e8ff',
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.xl,
  },
  pursuitTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: '#8b5cf6',
    marginBottom: spacing.sm,
  },
  applicantLabel: {
    fontSize: typography.fontSize.sm,
    color: legacyColors.textSecondary,
    marginTop: spacing.sm,
  },
  applicantName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: legacyColors.textPrimary,
    marginBottom: spacing.sm,
  },
  introText: {
    fontSize: typography.fontSize.sm,
    color: legacyColors.textSecondary,
    lineHeight: 20,
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
  cardAccentLine: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: editorial.carolina,
  },
  inputLabelLight: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: editorial.muted,
  },
  sectionTitleLight: {
    color: editorial.muted,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  dateTimeButtonLight: {
    backgroundColor: editorial.surface,
    borderWidth: 1,
    borderColor: editorial.hairline,
    borderRadius: 14,
  },
  inputLight: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderBottomWidth: 1,
    borderBottomColor: editorial.hairline,
    borderRadius: 0,
    paddingHorizontal: 0,
  },
  timeSlotSelected: {
    borderColor: '#8b5cf6',
    backgroundColor: '#f3e8ff',
  },
  timeSlotInfo: {
    flex: 1,
  },
  timeSlotDate: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: legacyColors.textPrimary,
    marginBottom: 4,
  },
  timeSlotTime: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: '#8b5cf6',
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
    backgroundColor: '#8b5cf6',
    borderColor: '#8b5cf6',
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
    backgroundColor: '#8b5cf6',
    borderRadius: borderRadius.base,
    padding: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'center',
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
    borderColor: '#8b5cf6',
    borderStyle: 'solid',
    backgroundColor: '#f3e8ff',
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
    color: '#8b5cf6',
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
    flex: 1,
  },
  pickerContainer: {
    backgroundColor: legacyColors.backgroundSecondary,
    borderRadius: borderRadius.base,
    marginBottom: spacing.base,
    overflow: 'hidden',
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
    backgroundColor: '#8b5cf6',
    padding: spacing.sm,
    alignItems: 'center',
  },
  doneButtonText: {
    color: legacyColors.white,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
});
