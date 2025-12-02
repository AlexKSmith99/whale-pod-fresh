import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, Modal, FlatList, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { meetingService } from '../services/meetingService';
import { agoraService } from '../services/agoraService';
import { supabase } from '../config/supabase';
import { colors, typography, spacing, borderRadius, shadows } from '../theme/designSystem';

interface Props {
  onClose: () => void;
  onMeetingCreated?: () => void;
}

export default function CreateMeetingScreen({ onClose, onMeetingCreated }: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  // Form fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedPursuit, setSelectedPursuit] = useState<any>(null);
  const [meetingType, setMeetingType] = useState<'in_person' | 'video' | 'hybrid'>('video');
  const [location, setLocation] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [duration, setDuration] = useState('60');
  const [timezone, setTimezone] = useState('America/New_York');
  const [recordingEnabled, setRecordingEnabled] = useState(false);
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);

  // UI state
  const [userPursuits, setUserPursuits] = useState<any[]>([]);
  const [showPursuitModal, setShowPursuitModal] = useState(false);
  const [showParticipantsModal, setShowParticipantsModal] = useState(false);
  const [pursuitMembers, setPursuitMembers] = useState<any[]>([]);

  useEffect(() => {
    loadUserPursuits();
  }, []);

  useEffect(() => {
    if (selectedPursuit) {
      loadPursuitMembers();
    }
  }, [selectedPursuit]);

  const loadUserPursuits = async () => {
    if (!user) return;

    try {
      // Get pursuits where user is creator or team member
      const { data: teamMemberships, error } = await supabase
        .from('team_members')
        .select(`
          pursuit:pursuits(*)
        `)
        .eq('user_id', user.id)
        .eq('status', 'active');

      if (error) throw error;

      const pursuits = teamMemberships?.map((tm: any) => tm.pursuit).filter(Boolean) || [];
      setUserPursuits(pursuits);
    } catch (error) {
      console.error('Error loading pursuits:', error);
    }
  };

  const loadPursuitMembers = async () => {
    if (!selectedPursuit) return;

    try {
      const { data, error } = await supabase
        .from('team_members')
        .select(`
          user_id,
          user:profiles(id, name, email)
        `)
        .eq('pursuit_id', selectedPursuit.id)
        .eq('status', 'active');

      if (error) throw error;
      setPursuitMembers(data || []);

      // Auto-select all members
      const memberIds = data?.map((m: any) => m.user_id) || [];
      setSelectedParticipants(memberIds);
    } catch (error) {
      console.error('Error loading members:', error);
    }
  };

  const toggleParticipant = (userId: string) => {
    if (selectedParticipants.includes(userId)) {
      setSelectedParticipants(selectedParticipants.filter(id => id !== userId));
    } else {
      setSelectedParticipants([...selectedParticipants, userId]);
    }
  };

  const handleCreate = async () => {
    // Validation
    if (!title.trim()) {
      Alert.alert('Missing Title', 'Please enter a meeting title');
      return;
    }

    if (!selectedPursuit) {
      Alert.alert('Missing Pursuit', 'Please select a pursuit');
      return;
    }

    if (!scheduledDate || !scheduledTime) {
      Alert.alert('Missing Date/Time', 'Please select a date and time');
      return;
    }

    if (meetingType === 'in_person' && !location.trim()) {
      Alert.alert('Missing Location', 'Please enter a location for in-person meeting');
      return;
    }

    if (selectedParticipants.length === 0) {
      Alert.alert('No Participants', 'Please select at least one participant');
      return;
    }

    setLoading(true);
    try {
      // Combine date and time
      const scheduledDateTime = new Date(`${scheduledDate}T${scheduledTime}`).toISOString();

      // Create meeting
      const meeting = await meetingService.createMeeting({
        pursuit_id: selectedPursuit.id,
        creator_id: user!.id,
        title,
        description,
        meeting_type: meetingType,
        location: meetingType === 'in_person' ? location : undefined,
        scheduled_time: scheduledDateTime,
        duration_minutes: parseInt(duration) || 60,
        timezone,
        is_kickoff: false,
        recording_enabled: recordingEnabled,
        participant_ids: selectedParticipants,
      });

      // If video meeting, generate Agora channel
      if (meetingType === 'video' || meetingType === 'hybrid') {
        const channelName = agoraService.generateChannelName(meeting.id);
        await agoraService.updateMeetingAgoraInfo(meeting.id, channelName);
      }

      Alert.alert('Success!', 'Meeting created successfully', [
        { text: 'OK', onPress: () => {
          onMeetingCreated?.();
          onClose();
        }}
      ]);
    } catch (error: any) {
      console.error('Error creating meeting:', error);
      Alert.alert('Error', error.message || 'Failed to create meeting');
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
        <Text style={styles.headerTitle}>Create Meeting</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView style={styles.scrollView}>
        <View style={styles.form}>
          {/* Title */}
          <Text style={styles.label}>Meeting Title *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Weekly Standup"
            value={title}
            onChangeText={setTitle}
          />

          {/* Description */}
          <Text style={styles.label}>Description (optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Add meeting details..."
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
          />

          {/* Pursuit Selection */}
          <Text style={styles.label}>Pursuit *</Text>
          <TouchableOpacity
            style={[styles.input, styles.pickerButton]}
            onPress={() => setShowPursuitModal(true)}
          >
            <Text style={selectedPursuit ? styles.pickerTextSelected : styles.pickerText}>
              {selectedPursuit ? selectedPursuit.title : 'Select pursuit'}
            </Text>
            <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          {/* Meeting Type */}
          <Text style={styles.label}>Meeting Type *</Text>
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

          {/* Location (for in-person) */}
          {(meetingType === 'in_person' || meetingType === 'hybrid') && (
            <>
              <Text style={styles.label}>Location *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Conference Room A"
                value={location}
                onChangeText={setLocation}
              />
            </>
          )}

          {/* Date */}
          <Text style={styles.label}>Date *</Text>
          <TextInput
            style={styles.input}
            placeholder="YYYY-MM-DD (e.g., 2025-01-15)"
            value={scheduledDate}
            onChangeText={setScheduledDate}
          />

          {/* Time */}
          <Text style={styles.label}>Time *</Text>
          <TextInput
            style={styles.input}
            placeholder="HH:MM (e.g., 14:30)"
            value={scheduledTime}
            onChangeText={setScheduledTime}
          />

          {/* Duration */}
          <Text style={styles.label}>Duration (minutes)</Text>
          <TextInput
            style={styles.input}
            placeholder="60"
            value={duration}
            onChangeText={setDuration}
            keyboardType="numeric"
          />

          {/* Participants */}
          {selectedPursuit && (
            <>
              <Text style={styles.label}>Participants * ({selectedParticipants.length} selected)</Text>
              <TouchableOpacity
                style={[styles.input, styles.pickerButton]}
                onPress={() => setShowParticipantsModal(true)}
              >
                <Text style={styles.pickerTextSelected}>
                  {selectedParticipants.length} team members
                </Text>
                <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </>
          )}

          {/* Recording */}
          {(meetingType === 'video' || meetingType === 'hybrid') && (
            <View style={styles.switchRow}>
              <Text style={styles.label}>Enable Recording</Text>
              <Switch value={recordingEnabled} onValueChange={setRecordingEnabled} />
            </View>
          )}

          {/* Create Button */}
          <TouchableOpacity
            style={[styles.createButton, loading && styles.createButtonDisabled]}
            onPress={handleCreate}
            disabled={loading}
          >
            <Text style={styles.createButtonText}>
              {loading ? 'Creating...' : 'Create Meeting'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Pursuit Selection Modal */}
      <Modal
        visible={showPursuitModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPursuitModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Pursuit</Text>
              <TouchableOpacity onPress={() => setShowPursuitModal(false)}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={userPursuits}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => {
                    setSelectedPursuit(item);
                    setShowPursuitModal(false);
                  }}
                >
                  <Text style={styles.modalItemText}>{item.title}</Text>
                  {selectedPursuit?.id === item.id && (
                    <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Participants Selection Modal */}
      <Modal
        visible={showParticipantsModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowParticipantsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Participants</Text>
              <TouchableOpacity onPress={() => setShowParticipantsModal(false)}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={pursuitMembers}
              keyExtractor={(item) => item.user_id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => toggleParticipant(item.user_id)}
                >
                  <Text style={styles.modalItemText}>{item.user.name || item.user.email}</Text>
                  {selectedParticipants.includes(item.user_id) && (
                    <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
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
  form: {
    padding: spacing.lg,
    paddingBottom: spacing['4xl'],
  },
  label: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
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
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  pickerButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pickerText: {
    color: colors.textTertiary,
  },
  pickerTextSelected: {
    color: colors.textPrimary,
  },
  chipContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
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
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.base,
  },
  createButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.base,
    padding: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  createButtonDisabled: {
    opacity: 0.6,
  },
  createButtonText: {
    color: colors.white,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.white,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '70%',
    paddingBottom: spacing.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  modalTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
  },
  modalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  modalItemText: {
    fontSize: typography.fontSize.base,
    color: colors.textPrimary,
  },
});
