import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { kickoffService } from '../services/kickoffService';
import { notificationService } from '../services/notificationService';
import { colors, typography, spacing, borderRadius, shadows } from '../theme/designSystem';
import Button from '../components/Button';

interface Props {
  pursuit: any;
  onBack: () => void;
  onSubmitted: () => void;
}

interface TimeSlot {
  id: string;
  datetime: Date | null;
  location_types: ('video' | 'in_person')[]; // Can select both
  showPicker: boolean;
}

export default function TimeSlotProposalScreen({ pursuit, onBack, onSubmitted }: Props) {
  const { user } = useAuth();
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([
    { id: '1', datetime: null, location_types: ['video'], showPicker: false },
    { id: '2', datetime: null, location_types: ['video'], showPicker: false },
    { id: '3', datetime: null, location_types: ['video'], showPicker: false },
    { id: '4', datetime: null, location_types: ['video'], showPicker: false },
    { id: '5', datetime: null, location_types: ['video'], showPicker: false },
  ]);
  const [loading, setLoading] = useState(false);

  const minimumDate = new Date();
  minimumDate.setDate(minimumDate.getDate() + 1); // Tomorrow
  const maximumDate = new Date();
  maximumDate.setDate(maximumDate.getDate() + 7); // 7 days from now

  const handleDateChange = (slotId: string, event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setTimeSlots((prev) =>
        prev.map((slot) =>
          slot.id === slotId ? { ...slot, showPicker: false } : slot
        )
      );
    }

    if (selectedDate) {
      setTimeSlots((prev) =>
        prev.map((slot) =>
          slot.id === slotId ? { ...slot, datetime: selectedDate } : slot
        )
      );
    }
  };

  const togglePicker = (slotId: string) => {
    setTimeSlots((prev) =>
      prev.map((slot) =>
        slot.id === slotId ? { ...slot, showPicker: !slot.showPicker } : slot
      )
    );
  };

  const toggleLocationType = (slotId: string, type: 'video' | 'in_person') => {
    setTimeSlots((prev) =>
      prev.map((slot) => {
        if (slot.id === slotId) {
          const isSelected = slot.location_types.includes(type);
          if (isSelected) {
            // Remove if already selected (but keep at least one)
            const newTypes = slot.location_types.filter(t => t !== type);
            return {
              ...slot,
              location_types: newTypes.length > 0 ? newTypes : [type], // Keep at least one
            };
          } else {
            // Add if not selected
            return {
              ...slot,
              location_types: [...slot.location_types, type],
            };
          }
        }
        return slot;
      })
    );
  };

  const removeSlot = (slotId: string) => {
    setTimeSlots((prev) =>
      prev.map((slot) =>
        slot.id === slotId ? { ...slot, datetime: null } : slot
      )
    );
  };

  const handleSubmit = async () => {
    // Get filled slots
    const filledSlots = timeSlots.filter((slot) => slot.datetime !== null);

    if (filledSlots.length === 0) {
      Alert.alert('No Time Slots', 'Please select at least one time slot before submitting.');
      return;
    }

    // Prepare proposals - if both location types selected, create separate proposals for each
    const proposals = filledSlots.flatMap((slot) =>
      slot.location_types.map((locationType) => ({
        datetime: slot.datetime!.toISOString(),
        location_type: locationType,
      }))
    );

    setLoading(true);
    try {
      await kickoffService.submitTimeSlotProposals(pursuit.id, user!.id, proposals);

      // Mark notification as read
      await notificationService.markAllAsReadByType(user!.id, ['time_slot_request']);

      Alert.alert(
        '✅ Time Slots Submitted!',
        `You've proposed ${filledSlots.length} time slot${filledSlots.length > 1 ? 's' : ''}. The pursuit creator will select the best time and notify everyone.`,
        [{ text: 'OK', onPress: onSubmitted }]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const filledSlotsCount = timeSlots.filter((slot) => slot.datetime !== null).length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Propose Time Slots</Text>
          <Text style={styles.headerSubtitle}>{pursuit.title}</Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={24} color={colors.primary} />
          <Text style={styles.infoText}>
            Select up to 5 time slots when you're available for the kickoff meeting in the next 7
            days. You can choose both Video and In-Person for any slot if you're flexible. The creator will choose the best time that works for everyone.
          </Text>
        </View>

        <View style={styles.progressBar}>
          <Text style={styles.progressText}>
            {filledSlotsCount}/5 time slots selected
          </Text>
          <View style={styles.progressBarContainer}>
            <View style={[styles.progressBarFill, { width: `${(filledSlotsCount / 5) * 100}%` }]} />
          </View>
        </View>

        {timeSlots.map((slot, index) => (
          <View key={slot.id} style={styles.slotCard}>
            <View style={styles.slotHeader}>
              <Text style={styles.slotTitle}>Time Slot {index + 1}</Text>
              {slot.datetime && (
                <TouchableOpacity onPress={() => removeSlot(slot.id)}>
                  <Ionicons name="close-circle" size={24} color={colors.error} />
                </TouchableOpacity>
              )}
            </View>

            {slot.datetime ? (
              <View style={styles.selectedSlot}>
                <View style={styles.dateTimeDisplay}>
                  <Ionicons name="calendar" size={20} color={colors.primary} />
                  <Text style={styles.dateTimeText}>
                    {slot.datetime.toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </Text>
                </View>
                <View style={styles.dateTimeDisplay}>
                  <Ionicons name="time" size={20} color={colors.primary} />
                  <Text style={styles.dateTimeText}>
                    {slot.datetime.toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
                <View style={styles.locationTypeContainer}>
                  <TouchableOpacity
                    style={[
                      styles.locationTypeButton,
                      slot.location_types.includes('video') && styles.locationTypeButtonActive,
                    ]}
                    onPress={() => toggleLocationType(slot.id, 'video')}
                  >
                    <Ionicons
                      name="videocam"
                      size={18}
                      color={slot.location_types.includes('video') ? colors.white : colors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.locationTypeText,
                        slot.location_types.includes('video') && styles.locationTypeTextActive,
                      ]}
                    >
                      Video
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.locationTypeButton,
                      slot.location_types.includes('in_person') && styles.locationTypeButtonActive,
                    ]}
                    onPress={() => toggleLocationType(slot.id, 'in_person')}
                  >
                    <Ionicons
                      name="people"
                      size={18}
                      color={slot.location_types.includes('in_person') ? colors.white : colors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.locationTypeText,
                        slot.location_types.includes('in_person') && styles.locationTypeTextActive,
                      ]}
                    >
                      In-Person
                    </Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  style={styles.changeTimeButton}
                  onPress={() => togglePicker(slot.id)}
                >
                  <Text style={styles.changeTimeText}>
                    {slot.showPicker ? 'Select Time' : 'Change Time'}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.selectTimeButton}
                onPress={() => togglePicker(slot.id)}
              >
                <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
                <Text style={styles.selectTimeText}>Select Time</Text>
              </TouchableOpacity>
            )}

            {slot.showPicker && (
              <DateTimePicker
                value={slot.datetime || minimumDate}
                mode="datetime"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(event, date) => handleDateChange(slot.id, event, date)}
                minimumDate={minimumDate}
                maximumDate={maximumDate}
                minuteInterval={15}
              />
            )}
          </View>
        ))}

        <View style={styles.buttonContainer}>
          <Button
            variant="primary"
            title={loading ? 'Submitting...' : 'Ready to Send?'}
            onPress={handleSubmit}
            disabled={filledSlotsCount === 0 || loading}
            loading={loading}
            fullWidth
          />
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
  infoCard: {
    flexDirection: 'row',
    backgroundColor: colors.primaryLight,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  infoText: {
    flex: 1,
    ...typography.body,
    color: colors.primary,
    lineHeight: 20,
  },
  progressBar: {
    marginBottom: spacing.xl,
  },
  progressText: {
    ...typography.label,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: colors.border,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
  },
  slotCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  slotHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  slotTitle: {
    ...typography.h4,
    color: colors.textPrimary,
  },
  selectedSlot: {
    gap: spacing.sm,
  },
  dateTimeDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  dateTimeText: {
    ...typography.body,
    color: colors.textPrimary,
  },
  locationTypeContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  locationTypeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  locationTypeButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  locationTypeText: {
    ...typography.label,
    color: colors.textSecondary,
  },
  locationTypeTextActive: {
    color: colors.white,
    fontWeight: '600',
  },
  changeTimeButton: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
  },
  changeTimeText: {
    ...typography.label,
    color: colors.primary,
    fontWeight: '600',
  },
  selectTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: borderRadius.lg,
  },
  selectTimeText: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '600',
  },
  buttonContainer: {
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  },
});
