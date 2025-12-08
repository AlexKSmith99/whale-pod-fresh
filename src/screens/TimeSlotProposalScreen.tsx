import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuth } from '../contexts/AuthContext';
import { meetingService } from '../services/meetingService';
import { colors, typography, spacing, borderRadius, shadows } from '../theme/designSystem';

interface Props {
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

export default function TimeSlotProposalScreen({ pursuitId, pursuitTitle, onClose, onSubmitted }: Props) {
  const { user } = useAuth();
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([
    { date: new Date(), startTime: new Date(), endTime: new Date() }
  ]);
  const [loading, setLoading] = useState(false);

  // For native DateTimePicker
  const [showDatePicker, setShowDatePicker] = useState<number | null>(null);
  const [showStartTimePicker, setShowStartTimePicker] = useState<number | null>(null);
  const [showEndTimePicker, setShowEndTimePicker] = useState<number | null>(null);

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
      updateTimeSlot(index, 'endTime', selectedTime);
    }
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

    setLoading(true);
    try {
      // Convert time slots to the format expected by the database
      const proposedTimes = validSlots.map(slot => {
        // Format date as YYYY-MM-DD
        const dateStr = slot.date!.toISOString().split('T')[0];

        // Format times as HH:MM
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

      await meetingService.submitKickoffProposal(
        pursuitId,
        user!.id,
        proposedTimes,
        timezone
      );

      Alert.alert('Success!', 'Your time proposals have been submitted', [
        { text: 'OK', onPress: () => {
          onSubmitted();
          onClose();
        }}
      ]);
    } catch (error: any) {
      console.error('Error submitting proposals:', error);
      Alert.alert('Error', error.message || 'Failed to submit time proposals');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={28} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Propose Meeting Times</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          <View style={styles.introSection}>
            <Text style={styles.pursuitTitle}>{pursuitTitle}</Text>
            <Text style={styles.introText}>
              The kickoff meeting has been activated! Please propose your available time slots below.
              Your team creator will review all proposals and select the final meeting time.
            </Text>
          </View>

          {/* Time Slots */}
          <Text style={styles.sectionTitle}>Your Available Times</Text>
          {timeSlots.map((slot, index) => (
            <View key={index} style={styles.timeSlotCard}>
              <View style={styles.timeSlotHeader}>
                <Text style={styles.timeSlotLabel}>Time Slot {index + 1}</Text>
                {timeSlots.length > 1 && (
                  <TouchableOpacity onPress={() => removeTimeSlot(index)}>
                    <Ionicons name="trash-outline" size={20} color={colors.error} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Date Picker */}
              <Text style={styles.inputLabel}>Date</Text>
              <TouchableOpacity
                style={styles.pickerButton}
                onPress={() => setShowDatePicker(showDatePicker === index ? null : index)}
              >
                <Ionicons name="calendar-outline" size={20} color={colors.primary} />
                <Text style={[styles.pickerButtonText, styles.pickerButtonTextSelected]}>
                  {formatDate(slot.date)}
                </Text>
                <Ionicons name={showDatePicker === index ? "chevron-up" : "chevron-down"} size={20} color={colors.textSecondary} />
              </TouchableOpacity>
              {showDatePicker === index && (
                <View style={styles.dateTimePickerContainer}>
                  <DateTimePicker
                    value={slot.date || new Date()}
                    mode="date"
                    display="spinner"
                    onChange={(event, date) => handleDateChange(event, date, index)}
                    minimumDate={new Date()}
                    style={styles.datePicker}
                  />
                </View>
              )}

              {/* Time Pickers Row */}
              <View style={styles.timeRow}>
                <View style={styles.timeInput}>
                  <Text style={styles.inputLabel}>Start Time</Text>
                  <TouchableOpacity
                    style={styles.pickerButton}
                    onPress={() => setShowStartTimePicker(showStartTimePicker === index ? null : index)}
                  >
                    <Ionicons name="time-outline" size={20} color={colors.primary} />
                    <Text style={[styles.pickerButtonText, styles.pickerButtonTextSelected]}>
                      {formatTime(slot.startTime)}
                    </Text>
                    <Ionicons name={showStartTimePicker === index ? "chevron-up" : "chevron-down"} size={16} color={colors.textSecondary} />
                  </TouchableOpacity>
                  {showStartTimePicker === index && (
                    <View style={styles.dateTimePickerContainer}>
                      <DateTimePicker
                        value={slot.startTime || new Date()}
                        mode="time"
                        display="spinner"
                        onChange={(event, time) => handleStartTimeChange(event, time, index)}
                        minuteInterval={15}
                        style={styles.timePicker}
                      />
                    </View>
                  )}
                </View>
                <View style={styles.timeInput}>
                  <Text style={styles.inputLabel}>End Time</Text>
                  <TouchableOpacity
                    style={styles.pickerButton}
                    onPress={() => setShowEndTimePicker(showEndTimePicker === index ? null : index)}
                  >
                    <Ionicons name="time-outline" size={20} color={colors.primary} />
                    <Text style={[styles.pickerButtonText, styles.pickerButtonTextSelected]}>
                      {formatTime(slot.endTime)}
                    </Text>
                    <Ionicons name={showEndTimePicker === index ? "chevron-up" : "chevron-down"} size={16} color={colors.textSecondary} />
                  </TouchableOpacity>
                  {showEndTimePicker === index && (
                    <View style={styles.dateTimePickerContainer}>
                      <DateTimePicker
                        value={slot.endTime || new Date()}
                        mode="time"
                        display="spinner"
                        onChange={(event, time) => handleEndTimeChange(event, time, index)}
                        minuteInterval={15}
                        style={styles.timePicker}
                      />
                    </View>
                  )}
                </View>
              </View>
            </View>
          ))}

          <TouchableOpacity style={styles.addSlotButton} onPress={addTimeSlot}>
            <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
            <Text style={styles.addSlotText}>Add Another Time Slot</Text>
          </TouchableOpacity>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            <Text style={styles.submitButtonText}>
              {loading ? 'Submitting...' : 'Submit Time Proposals'}
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
    backgroundColor: colors.primaryLight,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.xl,
  },
  pursuitTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
    marginBottom: spacing.sm,
  },
  introText: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.base,
    marginTop: spacing.lg,
  },
  timeSlotCard: {
    backgroundColor: colors.white,
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
    color: colors.textPrimary,
  },
  inputLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: borderRadius.base,
    padding: spacing.base,
    minHeight: 48,
  },
  pickerButtonText: {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
    flex: 1,
  },
  pickerButtonTextSelected: {
    color: colors.textPrimary,
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
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.base,
    borderWidth: 1,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    marginTop: spacing.base,
  },
  addSlotText: {
    fontSize: typography.fontSize.base,
    color: colors.primary,
    fontWeight: typography.fontWeight.semibold,
  },
  submitButton: {
    backgroundColor: colors.primary,
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
    color: colors.white,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
  },
  dateTimePickerContainer: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.base,
    marginTop: spacing.xs,
    overflow: 'hidden',
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
