import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
    { date: null, startTime: null, endTime: null }
  ]);
  const [loading, setLoading] = useState(false);
  const [showPicker, setShowPicker] = useState<{ index: number; type: 'date' | 'startTime' | 'endTime' } | null>(null);

  const addTimeSlot = () => {
    setTimeSlots([...timeSlots, { date: null, startTime: null, endTime: null }]);
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

  // Generate next 7 days
  const getAvailableDates = () => {
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      dates.push(date);
    }
    return dates;
  };

  // Generate time slots (6 AM to 11 PM in 15-minute intervals)
  const getAvailableTimes = () => {
    const times = [];
    for (let hour = 6; hour < 23; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
        const time = new Date();
        time.setHours(hour, minute, 0, 0);
        times.push(time);
      }
    }
    return times;
  };

  const handleDateSelect = (date: Date) => {
    if (showPicker) {
      const selectedDate = new Date(date);
      updateTimeSlot(showPicker.index, 'date', selectedDate);
      setShowPicker(null);
    }
  };

  const handleTimeSelect = (time: Date) => {
    if (showPicker) {
      const selectedTime = new Date(time);
      updateTimeSlot(showPicker.index, showPicker.type as 'startTime' | 'endTime', selectedTime);
      setShowPicker(null);
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

              <Text style={styles.inputLabel}>Date</Text>
              <TouchableOpacity
                style={styles.pickerButton}
                onPress={() => setShowPicker({ index, type: 'date' })}
              >
                <Ionicons name="calendar-outline" size={20} color={slot.date ? colors.primary : colors.textSecondary} />
                <Text style={[styles.pickerButtonText, slot.date && styles.pickerButtonTextSelected]}>
                  {formatDate(slot.date)}
                </Text>
              </TouchableOpacity>

              <View style={styles.timeRow}>
                <View style={styles.timeInput}>
                  <Text style={styles.inputLabel}>Start Time</Text>
                  <TouchableOpacity
                    style={styles.pickerButton}
                    onPress={() => setShowPicker({ index, type: 'startTime' })}
                  >
                    <Ionicons name="time-outline" size={20} color={slot.startTime ? colors.primary : colors.textSecondary} />
                    <Text style={[styles.pickerButtonText, slot.startTime && styles.pickerButtonTextSelected]}>
                      {formatTime(slot.startTime)}
                    </Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.timeInput}>
                  <Text style={styles.inputLabel}>End Time</Text>
                  <TouchableOpacity
                    style={styles.pickerButton}
                    onPress={() => setShowPicker({ index, type: 'endTime' })}
                  >
                    <Ionicons name="time-outline" size={20} color={slot.endTime ? colors.primary : colors.textSecondary} />
                    <Text style={[styles.pickerButtonText, slot.endTime && styles.pickerButtonTextSelected]}>
                      {formatTime(slot.endTime)}
                    </Text>
                  </TouchableOpacity>
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

      {/* Custom Date Picker Modal */}
      {showPicker && showPicker.type === 'date' && (
        <Modal
          transparent
          animationType="slide"
          visible={true}
          onRequestClose={() => setShowPicker(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.pickerModal}>
              <View style={styles.pickerHeader}>
                <TouchableOpacity onPress={() => setShowPicker(null)}>
                  <Text style={styles.pickerCancelButton}>Cancel</Text>
                </TouchableOpacity>
                <Text style={styles.pickerTitle}>Select Date</Text>
                <View style={{ width: 60 }} />
              </View>
              <ScrollView style={styles.datePickerContainer}>
                {getAvailableDates().map((date, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.dateOption}
                    onPress={() => handleDateSelect(date)}
                  >
                    <View style={styles.dateOptionContent}>
                      <Text style={styles.dateOptionDay}>
                        {date.toLocaleDateString('en-US', { weekday: 'long' })}
                      </Text>
                      <Text style={styles.dateOptionDate}>
                        {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

      {/* Custom Time Picker Modal */}
      {showPicker && (showPicker.type === 'startTime' || showPicker.type === 'endTime') && (
        <Modal
          transparent
          animationType="slide"
          visible={true}
          onRequestClose={() => setShowPicker(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.pickerModal}>
              <View style={styles.pickerHeader}>
                <TouchableOpacity onPress={() => setShowPicker(null)}>
                  <Text style={styles.pickerCancelButton}>Cancel</Text>
                </TouchableOpacity>
                <Text style={styles.pickerTitle}>
                  {showPicker.type === 'startTime' ? 'Select Start Time' : 'Select End Time'}
                </Text>
                <View style={{ width: 60 }} />
              </View>
              <ScrollView style={styles.timePickerContainer}>
                {getAvailableTimes().map((time, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.timeOption}
                    onPress={() => handleTimeSelect(time)}
                  >
                    <Text style={styles.timeOptionText}>
                      {time.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                    </Text>
                    <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  pickerModal: {
    backgroundColor: colors.white,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '70%',
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  pickerTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
  },
  pickerCancelButton: {
    fontSize: typography.fontSize.base,
    color: colors.error,
    fontWeight: typography.fontWeight.medium,
  },
  datePickerContainer: {
    maxHeight: 400,
  },
  dateOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  dateOptionContent: {
    flex: 1,
  },
  dateOptionDay: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
  },
  dateOptionDate: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  timePickerContainer: {
    maxHeight: 400,
  },
  timeOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  timeOptionText: {
    fontSize: typography.fontSize.base,
    color: colors.textPrimary,
  },
});
