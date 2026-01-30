import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform, Modal, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../config/supabase';
import { notificationService } from '../services/notificationService';
import { colors as legacyColors, typography, spacing, borderRadius, shadows } from '../theme/designSystem';
import { useTheme } from '../theme/ThemeContext';
import { getThemedStyles } from '../theme/themedStyles';
import GrainTexture from '../components/ui/GrainTexture';

interface Props {
  applicationId: string;
  pursuitId: string;
  pursuitTitle: string;
  onClose: () => void;
  onSubmitted: () => void;
}

interface TimeSlot {
  date: Date | null;
  startTime: Date | null;
  endTime: Date | null;
}

export default function InterviewTimeSlotProposalScreen({ applicationId, pursuitId, pursuitTitle, onClose, onSubmitted }: Props) {
  const { user } = useAuth();
  const { theme, isNewTheme } = useTheme();
  const colors = theme.colors;
  const themedStyles = getThemedStyles(colors, isNewTheme);
  // Interview uses purple accent color (#8b5cf6)
  const interviewAccent = '#8b5cf6';
  const accentColor = isNewTheme ? colors.accentGreen : interviewAccent;
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([
    { date: new Date(), startTime: new Date(), endTime: new Date() }
  ]);
  const [loading, setLoading] = useState(false);
  const [creatorId, setCreatorId] = useState<string | null>(null);

  // For native DateTimePicker
  const [showDatePicker, setShowDatePicker] = useState<number | null>(null);
  const [showStartTimePicker, setShowStartTimePicker] = useState<number | null>(null);
  const [showEndTimePicker, setShowEndTimePicker] = useState<number | null>(null);

  useEffect(() => {
    loadCreatorId();
  }, []);

  const loadCreatorId = async () => {
    try {
      const { data, error } = await supabase
        .from('pursuits')
        .select('creator_id')
        .eq('id', pursuitId)
        .single();

      if (error) throw error;
      setCreatorId(data.creator_id);
    } catch (error) {
      console.error('Error loading creator:', error);
    }
  };

  const addTimeSlot = () => {
    setTimeSlots([...timeSlots, { date: new Date(), startTime: new Date(), endTime: new Date() }]);
  };

  const removeTimeSlot = (index: number) => {
    if (timeSlots.length > 1) {
      setTimeSlots(timeSlots.filter((_, i) => i !== index));
    }
  };

  const updateTimeSlot = (index: number, field: keyof TimeSlot, value: Date) => {
    const updated = [...timeSlots];
    updated[index][field] = value;
    setTimeSlots(updated);
  };

  const formatDate = (date: Date | null) => {
    if (!date) return 'Select date';
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTime = (time: Date | null) => {
    if (!time) return 'Select time';
    return time.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const handleDateChange = (event: any, selectedDate: Date | undefined, index: number) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(null);
    }
    if (selectedDate) {
      updateTimeSlot(index, 'date', selectedDate);
    }
  };

  const handleStartTimeChange = (event: any, selectedTime: Date | undefined, index: number) => {
    if (Platform.OS === 'android') {
      setShowStartTimePicker(null);
    }
    if (selectedTime) {
      updateTimeSlot(index, 'startTime', selectedTime);
    }
  };

  const handleEndTimeChange = (event: any, selectedTime: Date | undefined, index: number) => {
    if (Platform.OS === 'android') {
      setShowEndTimePicker(null);
    }
    if (selectedTime) {
      const slot = timeSlots[index];
      if (slot.startTime) {
        // Check if end time is at least 15 minutes after start time
        const startMinutes = slot.startTime.getHours() * 60 + slot.startTime.getMinutes();
        const endMinutes = selectedTime.getHours() * 60 + selectedTime.getMinutes();

        if (endMinutes < startMinutes + 15) {
          Alert.alert('Invalid Time', 'End time must be at least 15 minutes after start time');
          return;
        }
      }
      updateTimeSlot(index, 'endTime', selectedTime);
    }
  };

  // Helper to check if a time slot is in the past
  const isTimeSlotInPast = (slot: TimeSlot): boolean => {
    if (!slot.date || !slot.startTime) return false;

    const now = new Date();
    const slotDateTime = new Date(slot.date);
    slotDateTime.setHours(slot.startTime.getHours(), slot.startTime.getMinutes(), 0, 0);

    return slotDateTime < now;
  };

  // Helper to check if end time is valid (at least 15 min after start)
  const isEndTimeValid = (slot: TimeSlot): boolean => {
    if (!slot.startTime || !slot.endTime) return false;

    const startMinutes = slot.startTime.getHours() * 60 + slot.startTime.getMinutes();
    const endMinutes = slot.endTime.getHours() * 60 + slot.endTime.getMinutes();

    return endMinutes >= startMinutes + 15;
  };

  const handleSubmit = async () => {
    // Validate
    const validSlots = timeSlots.filter(slot =>
      slot.date && slot.startTime && slot.endTime
    );

    if (validSlots.length === 0) {
      Alert.alert('Missing Information', 'Please add at least one time slot with date and time');
      return;
    }

    // Check for past time slots
    const pastSlots = validSlots.filter(isTimeSlotInPast);
    if (pastSlots.length > 0) {
      Alert.alert('Invalid Time', 'You cannot propose time slots in the past. Please select a future date and time.');
      return;
    }

    // Check for minimum 15 minute duration
    const invalidDurationSlots = validSlots.filter(slot => !isEndTimeValid(slot));
    if (invalidDurationSlots.length > 0) {
      Alert.alert('Invalid Duration', 'Each time slot must be at least 15 minutes long.');
      return;
    }

    setLoading(true);
    try {
      // Convert time slots to the format for storage
      const proposedTimes = validSlots.map(slot => {
        const dateStr = slot.date!.toISOString().split('T')[0];
        const startStr = slot.startTime!.toTimeString().split(' ')[0].substring(0, 5);
        const endStr = slot.endTime!.toTimeString().split(' ')[0].substring(0, 5);

        return {
          date: dateStr,
          start_time: startStr,
          end_time: endStr,
        };
      });

      // Get timezone from device
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      console.log('🎤 Saving interview times for applicationId:', applicationId);
      console.log('🎤 Proposed times to save:', JSON.stringify(proposedTimes, null, 2));
      console.log('🎤 Timezone:', timezone);

      // Save interview time proposals to pursuit_applications table
      const { data: updateData, error: updateError } = await supabase
        .from('pursuit_applications')
        .update({
          status: 'interview_times_submitted',
          interview_proposed_times: proposedTimes,
          interview_timezone: timezone,
        })
        .eq('id', applicationId)
        .select();

      console.log('🎤 Update result:', { updateData, updateError });

      if (updateError) throw updateError;

      // Notify creator that applicant submitted interview times
      if (creatorId) {
        const applicantName = user?.name || user?.email?.split('@')[0] || 'The applicant';
        await notificationService.notifyInterviewTimesSubmitted(
          creatorId,
          applicationId,
          pursuitId,
          pursuitTitle,
          applicantName
        );
      }

      Alert.alert('Success!', 'Your interview time proposals have been submitted', [
        { text: 'OK', onPress: () => {
          onSubmitted();
          onClose();
        }}
      ]);
    } catch (error: any) {
      console.error('Error submitting interview proposals:', error);
      Alert.alert('Error', error.message || 'Failed to submit interview time proposals');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isNewTheme ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      {isNewTheme && <GrainTexture opacity={0.06} />}
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={28} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary, fontFamily: isNewTheme ? 'NothingYouCouldDo_400Regular' : undefined }]}>Propose Interview Times</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          <View style={[styles.introSection, { backgroundColor: isNewTheme ? colors.primaryLight : '#f3e8ff' }]}>
            <Text style={[styles.pursuitTitle, { color: accentColor, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>{pursuitTitle}</Text>
            <Text style={[styles.introText, { color: colors.textSecondary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>
              The creator wants to schedule an interview with you! Please propose your available time slots for the next week below.
              They will review your times and select the final interview time.
            </Text>
          </View>

          {/* Time Slots */}
          <Text style={[styles.sectionTitle, { color: colors.textPrimary, fontFamily: isNewTheme ? 'NothingYouCouldDo_400Regular' : undefined }]}>Your Available Times</Text>
          {timeSlots.map((slot, index) => (
            <View key={index} style={[styles.timeSlotCard, { backgroundColor: colors.surface }]}>
              <View style={styles.timeSlotHeader}>
                <Text style={[styles.timeSlotLabel, { color: colors.textPrimary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>Time Slot {index + 1}</Text>
                {timeSlots.length > 1 && (
                  <TouchableOpacity onPress={() => removeTimeSlot(index)}>
                    <Ionicons name="trash-outline" size={20} color={colors.error} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Date Picker */}
              <Text style={[styles.inputLabel, { color: colors.textSecondary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>Date</Text>
              <TouchableOpacity
                style={[styles.pickerButton, { backgroundColor: colors.backgroundSecondary, borderColor: colors.borderLight }]}
                onPress={() => setShowDatePicker(showDatePicker === index ? null : index)}
              >
                <Ionicons name="calendar-outline" size={20} color={accentColor} />
                <Text style={[styles.pickerButtonText, styles.pickerButtonTextSelected, { color: colors.textPrimary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>
                  {formatDate(slot.date)}
                </Text>
                <Ionicons name={showDatePicker === index ? "chevron-up" : "chevron-down"} size={20} color={colors.textSecondary} />
              </TouchableOpacity>
              {showDatePicker === index && Platform.OS === 'ios' && (
                <Modal transparent animationType="fade" visible={showDatePicker === index}>
                  <TouchableOpacity
                    style={[styles.pickerOverlay, { backgroundColor: isNewTheme ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.5)' }]}
                    activeOpacity={1}
                    onPress={() => setShowDatePicker(null)}
                  >
                    <View style={[styles.pickerModalContent, { backgroundColor: colors.surface }]}>
                      <DateTimePicker
                        value={slot.date || new Date()}
                        mode="date"
                        display="spinner"
                        onChange={(event, date) => {
                          if (date) {
                            const newSlots = [...timeSlots];
                            newSlots[index].date = date;
                            setTimeSlots(newSlots);
                          }
                        }}
                        minimumDate={new Date()}
                        style={styles.datePicker}
                      />
                      <TouchableOpacity
                        style={[styles.doneButton, { backgroundColor: accentColor }]}
                        onPress={() => setShowDatePicker(null)}
                      >
                        <Text style={[styles.doneButtonText, { color: isNewTheme ? colors.background : legacyColors.white, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>Done</Text>
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                </Modal>
              )}
              {showDatePicker === index && Platform.OS === 'android' && (
                <DateTimePicker
                  value={slot.date || new Date()}
                  mode="date"
                  display="default"
                  onChange={(event, date) => handleDateChange(event, date, index)}
                  minimumDate={new Date()}
                />
              )}

              {/* Time Pickers Row */}
              <View style={styles.timeRow}>
                <View style={styles.timeInput}>
                  <Text style={[styles.inputLabel, { color: colors.textSecondary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>Start Time</Text>
                  <TouchableOpacity
                    style={[styles.pickerButton, { backgroundColor: colors.backgroundSecondary, borderColor: colors.borderLight }]}
                    onPress={() => setShowStartTimePicker(showStartTimePicker === index ? null : index)}
                  >
                    <Ionicons name="time-outline" size={20} color={accentColor} />
                    <Text style={[styles.pickerButtonText, styles.pickerButtonTextSelected, { color: colors.textPrimary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]} numberOfLines={1} adjustsFontSizeToFit>
                      {formatTime(slot.startTime)}
                    </Text>
                    <Ionicons name={showStartTimePicker === index ? "chevron-up" : "chevron-down"} size={16} color={colors.textSecondary} />
                  </TouchableOpacity>
                  {showStartTimePicker === index && Platform.OS === 'ios' && (
                    <Modal transparent animationType="fade" visible={showStartTimePicker === index}>
                      <TouchableOpacity
                        style={[styles.pickerOverlay, { backgroundColor: isNewTheme ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.5)' }]}
                        activeOpacity={1}
                        onPress={() => setShowStartTimePicker(null)}
                      >
                        <View style={[styles.pickerModalContent, { backgroundColor: colors.surface }]}>
                          <DateTimePicker
                            value={slot.startTime || new Date()}
                            mode="time"
                            display="spinner"
                            onChange={(event, time) => {
                              if (time) {
                                const newSlots = [...timeSlots];
                                newSlots[index].startTime = time;
                                setTimeSlots(newSlots);
                              }
                            }}
                            minuteInterval={15}
                            style={styles.timePicker}
                          />
                          <TouchableOpacity
                            style={[styles.doneButton, { backgroundColor: accentColor }]}
                            onPress={() => setShowStartTimePicker(null)}
                          >
                            <Text style={[styles.doneButtonText, { color: isNewTheme ? colors.background : legacyColors.white, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>Done</Text>
                          </TouchableOpacity>
                        </View>
                      </TouchableOpacity>
                    </Modal>
                  )}
                  {showStartTimePicker === index && Platform.OS === 'android' && (
                    <DateTimePicker
                      value={slot.startTime || new Date()}
                      mode="time"
                      display="default"
                      onChange={(event, time) => handleStartTimeChange(event, time, index)}
                      minuteInterval={15}
                    />
                  )}
                </View>
                <View style={styles.timeInput}>
                  <Text style={[styles.inputLabel, { color: colors.textSecondary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>End Time</Text>
                  <TouchableOpacity
                    style={[styles.pickerButton, { backgroundColor: colors.backgroundSecondary, borderColor: colors.borderLight }]}
                    onPress={() => setShowEndTimePicker(showEndTimePicker === index ? null : index)}
                  >
                    <Ionicons name="time-outline" size={20} color={accentColor} />
                    <Text style={[styles.pickerButtonText, styles.pickerButtonTextSelected, { color: colors.textPrimary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]} numberOfLines={1} adjustsFontSizeToFit>
                      {formatTime(slot.endTime)}
                    </Text>
                    <Ionicons name={showEndTimePicker === index ? "chevron-up" : "chevron-down"} size={16} color={colors.textSecondary} />
                  </TouchableOpacity>
                  {showEndTimePicker === index && Platform.OS === 'ios' && (
                    <Modal transparent animationType="fade" visible={showEndTimePicker === index}>
                      <TouchableOpacity
                        style={[styles.pickerOverlay, { backgroundColor: isNewTheme ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.5)' }]}
                        activeOpacity={1}
                        onPress={() => setShowEndTimePicker(null)}
                      >
                        <View style={[styles.pickerModalContent, { backgroundColor: colors.surface }]}>
                          <DateTimePicker
                            value={slot.endTime || new Date()}
                            mode="time"
                            display="spinner"
                            onChange={(event, time) => {
                              if (time) {
                                const newSlots = [...timeSlots];
                                newSlots[index].endTime = time;
                                setTimeSlots(newSlots);
                              }
                            }}
                            minuteInterval={15}
                            style={styles.timePicker}
                          />
                          <TouchableOpacity
                            style={[styles.doneButton, { backgroundColor: accentColor }]}
                            onPress={() => setShowEndTimePicker(null)}
                          >
                            <Text style={[styles.doneButtonText, { color: isNewTheme ? colors.background : legacyColors.white, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>Done</Text>
                          </TouchableOpacity>
                        </View>
                      </TouchableOpacity>
                    </Modal>
                  )}
                  {showEndTimePicker === index && Platform.OS === 'android' && (
                    <DateTimePicker
                      value={slot.endTime || new Date()}
                      mode="time"
                      display="default"
                      onChange={(event, time) => handleEndTimeChange(event, time, index)}
                      minuteInterval={15}
                    />
                  )}
                </View>
              </View>
            </View>
          ))}

          <TouchableOpacity style={[styles.addSlotButton, { backgroundColor: colors.backgroundSecondary, borderColor: accentColor }]} onPress={addTimeSlot}>
            <Ionicons name="add-circle-outline" size={24} color={accentColor} />
            <Text style={[styles.addSlotText, { color: accentColor, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>Add Another Time Slot</Text>
          </TouchableOpacity>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, { backgroundColor: accentColor }, loading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            <Text style={[styles.submitButtonText, { color: isNewTheme ? colors.background : legacyColors.white, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>
              {loading ? 'Submitting...' : 'Submit Interview Times'}
            </Text>
          </TouchableOpacity>
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
  introText: {
    fontSize: typography.fontSize.sm,
    color: legacyColors.textSecondary,
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: legacyColors.textPrimary,
    marginBottom: spacing.base,
    marginTop: spacing.lg,
  },
  timeSlotCard: {
    backgroundColor: legacyColors.white,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.base,
    ...shadows.base,
  },
  timeSlotHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.base,
  },
  timeSlotLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: legacyColors.textPrimary,
  },
  inputLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: legacyColors.textSecondary,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: legacyColors.backgroundSecondary,
    borderWidth: 1,
    borderColor: legacyColors.borderLight,
    borderRadius: borderRadius.base,
    padding: spacing.base,
    minHeight: 48,
  },
  pickerButtonText: {
    fontSize: typography.fontSize.base,
    color: legacyColors.textSecondary,
    flex: 1,
  },
  pickerButtonTextSelected: {
    color: legacyColors.textPrimary,
    fontWeight: typography.fontWeight.medium,
  },
  timeRow: {
    flexDirection: 'row',
    gap: spacing.base,
  },
  timeInput: {
    flex: 1,
  },
  addSlotButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.base,
    backgroundColor: legacyColors.backgroundSecondary,
    borderRadius: borderRadius.base,
    borderWidth: 1,
    borderColor: '#8b5cf6',
    borderStyle: 'dashed',
    marginTop: spacing.base,
  },
  addSlotText: {
    fontSize: typography.fontSize.base,
    color: '#8b5cf6',
    fontWeight: typography.fontWeight.semibold,
  },
  submitButton: {
    backgroundColor: '#8b5cf6',
    borderRadius: borderRadius.base,
    padding: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.xl,
    ...shadows.base,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: legacyColors.white,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
  },
  dateTimePickerContainer: {
    backgroundColor: legacyColors.backgroundSecondary,
    borderRadius: borderRadius.base,
    marginTop: spacing.xs,
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
    backgroundColor: legacyColors.primary,
    padding: spacing.sm,
    alignItems: 'center',
  },
  doneButtonText: {
    color: legacyColors.white,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold as any,
  },
  datePicker: {
    height: 150,
  },
  timePicker: {
    height: 100,
    width: 120,
    alignSelf: 'center',
    transform: [{ scale: 0.85 }],
  },
});
