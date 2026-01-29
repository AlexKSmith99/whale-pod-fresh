import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, Modal, FlatList, Switch, Image, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuth } from '../contexts/AuthContext';
import { meetingService } from '../services/meetingService';
import { agoraService } from '../services/agoraService';
import { notificationService } from '../services/notificationService';
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
  const [scheduledDate, setScheduledDate] = useState<Date>(new Date());
  const [scheduledTime, setScheduledTime] = useState<Date>(new Date());
  const [duration, setDuration] = useState('60');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
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
      // Get pursuits where user is the creator
      const { data: createdPursuits, error: createdError } = await supabase
        .from('pursuits')
        .select('*')
        .eq('creator_id', user.id);

      if (createdError) throw createdError;

      // Get active memberships (not removed)
      const { data: activeMemberships, error: memberError } = await supabase
        .from('team_members')
        .select('pursuit_id')
        .eq('user_id', user.id)
        .neq('status', 'removed');

      if (memberError) throw memberError;

      const memberPursuitIds = activeMemberships?.map(m => m.pursuit_id) || [];

      let memberPursuits: any[] = [];
      if (memberPursuitIds.length > 0) {
        const { data, error } = await supabase
          .from('pursuits')
          .select('*')
          .in('id', memberPursuitIds);

        if (error) throw error;
        memberPursuits = data || [];
      }

      // Combine and deduplicate (in case user is both creator and team member)
      const allPursuits = [...(createdPursuits || []), ...memberPursuits];
      const uniquePursuits = allPursuits.filter((pursuit, index, self) =>
        index === self.findIndex(p => p.id === pursuit.id)
      );

      setUserPursuits(uniquePursuits);
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
          user:profiles(id, name, email, profile_picture)
        `)
        .eq('pursuit_id', selectedPursuit.id)
        .neq('status', 'removed');

      if (error) throw error;
      setPursuitMembers(data || []);

      // Auto-select all members
      const memberIds = data?.map((m: any) => m.user_id) || [];
      setSelectedParticipants(memberIds);
    } catch (error) {
      console.error('Error loading members:', error);
    }
  };

  const toggleSelectAll = () => {
    const allMemberIds = pursuitMembers.map((m: any) => m.user_id);
    if (selectedParticipants.length === allMemberIds.length) {
      // Deselect all
      setSelectedParticipants([]);
    } else {
      // Select all
      setSelectedParticipants(allMemberIds);
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

    // Combine date and time into a single DateTime
    const scheduledDateTime = new Date(scheduledDate);
    scheduledDateTime.setHours(scheduledTime.getHours(), scheduledTime.getMinutes(), 0, 0);

    // Validate date/time is not in the past
    if (scheduledDateTime < new Date()) {
      Alert.alert('Invalid Time', 'You cannot schedule a meeting in the past. Please select a future date and time.');
      return;
    }

    // Validate minimum duration (15 minutes)
    const durationNum = parseInt(duration) || 60;
    if (durationNum < 15) {
      Alert.alert('Invalid Duration', 'Meeting duration must be at least 15 minutes.');
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
      // Use the already validated scheduledDateTime
      const scheduledDateTimeISO = scheduledDateTime.toISOString();

      // Create meeting
      const meeting = await meetingService.createMeeting({
        pursuit_id: selectedPursuit.id,
        creator_id: user!.id,
        title,
        description,
        meeting_type: meetingType,
        location: (meetingType === 'in_person' || meetingType === 'hybrid') ? location : undefined,
        scheduled_time: scheduledDateTimeISO,
        duration_minutes: durationNum,
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

      // Get creator's profile for notification
      const { data: creatorProfile } = await supabase
        .from('profiles')
        .select('name, email')
        .eq('id', user!.id)
        .single();

      const creatorName = creatorProfile?.name || creatorProfile?.email?.split('@')[0] || 'The organizer';

      // Format date and time for notification
      const meetingDate = scheduledDateTime;
      const formattedDate = meetingDate.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
      const formattedTime = meetingDate.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });

      // Send meeting invitation notifications to all participants (except creator)
      const participantsToNotify = selectedParticipants.filter(id => id !== user!.id);
      if (participantsToNotify.length > 0) {
        await notificationService.notifyMeetingInvitation(
          participantsToNotify,
          meeting.id,
          title,
          creatorName,
          formattedDate,
          formattedTime,
          selectedPursuit.title
        );
      }

      Alert.alert('Invites Sent!', `Meeting invitations sent to ${participantsToNotify.length} team member${participantsToNotify.length !== 1 ? 's' : ''}`, [
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
          {/* Pod Selection - First field */}
          <Text style={[styles.label, { marginTop: 0 }]}>Pod *</Text>
          <TouchableOpacity
            style={[styles.input, styles.pickerButton]}
            onPress={() => setShowPursuitModal(true)}
          >
            <Text style={selectedPursuit ? styles.pickerTextSelected : styles.pickerText}>
              {selectedPursuit ? selectedPursuit.title : 'Select pod'}
            </Text>
            <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          {/* Title */}
          <Text style={styles.label}>Meeting Title *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Weekly Standup"
            value={title}
            onChangeText={setTitle}
          />

          {/* Participants - shown after Pod is selected */}
          {selectedPursuit && (
            <>
              <Text style={styles.label}>Participants * ({selectedParticipants.length} selected)</Text>
              <TouchableOpacity
                style={[styles.input, styles.pickerButton]}
                onPress={() => setShowParticipantsModal(true)}
              >
                <View style={styles.selectedParticipantsPreview}>
                  {selectedParticipants.length > 0 ? (
                    <>
                      {pursuitMembers
                        .filter(m => selectedParticipants.includes(m.user_id))
                        .slice(0, 3)
                        .map((member, index) => (
                          member.user?.profile_picture ? (
                            <Image
                              key={member.user_id}
                              source={{ uri: member.user.profile_picture }}
                              style={[styles.previewAvatar, { marginLeft: index > 0 ? -8 : 0 }]}
                            />
                          ) : (
                            <View key={member.user_id} style={[styles.previewAvatar, styles.previewAvatarPlaceholder, { marginLeft: index > 0 ? -8 : 0 }]}>
                              <Text style={styles.previewAvatarText}>
                                {member.user?.name?.charAt(0).toUpperCase() || '?'}
                              </Text>
                            </View>
                          )
                        ))}
                      {selectedParticipants.length > 3 && (
                        <View style={[styles.previewAvatar, styles.previewAvatarMore, { marginLeft: -8 }]}>
                          <Text style={styles.previewAvatarMoreText}>+{selectedParticipants.length - 3}</Text>
                        </View>
                      )}
                      <Text style={[styles.pickerTextSelected, { marginLeft: 8 }]}>
                        {selectedParticipants.length} team member{selectedParticipants.length !== 1 ? 's' : ''}
                      </Text>
                    </>
                  ) : (
                    <Text style={styles.pickerText}>Select participants</Text>
                  )}
                </View>
                <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </>
          )}

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
          <TouchableOpacity
            style={[styles.input, styles.pickerButton]}
            onPress={() => setShowDatePicker(!showDatePicker)}
          >
            <Ionicons name="calendar" size={20} color={colors.primary} />
            <Text style={styles.pickerTextSelected}>
              {scheduledDate.toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric'
              })}
            </Text>
            <Ionicons name={showDatePicker ? "chevron-up" : "chevron-down"} size={20} color={colors.textSecondary} />
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
                    value={scheduledDate}
                    mode="date"
                    display="spinner"
                    minimumDate={new Date()}
                    onChange={(event, date) => {
                      if (date) setScheduledDate(date);
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
              value={scheduledDate}
              mode="date"
              display="default"
              minimumDate={new Date()}
              onChange={(event, date) => {
                setShowDatePicker(false);
                if (date) setScheduledDate(date);
              }}
            />
          )}

          {/* Time */}
          <Text style={styles.label}>Time *</Text>
          <TouchableOpacity
            style={[styles.input, styles.pickerButton]}
            onPress={() => setShowTimePicker(!showTimePicker)}
          >
            <Ionicons name="time" size={20} color={colors.primary} />
            <Text style={styles.pickerTextSelected}>
              {scheduledTime.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
              })}
            </Text>
            <Ionicons name={showTimePicker ? "chevron-up" : "chevron-down"} size={20} color={colors.textSecondary} />
          </TouchableOpacity>
          {showTimePicker && Platform.OS === 'ios' && (
            <Modal transparent animationType="fade" visible={showTimePicker}>
              <TouchableOpacity 
                style={styles.pickerOverlay} 
                activeOpacity={1} 
                onPress={() => setShowTimePicker(false)}
              >
                <View style={styles.pickerModalContent}>
                  <DateTimePicker
                    value={scheduledTime}
                    mode="time"
                    display="spinner"
                    minuteInterval={15}
                    onChange={(event, time) => {
                      if (time) setScheduledTime(time);
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
              value={scheduledTime}
              mode="time"
              display="default"
              minuteInterval={15}
              onChange={(event, time) => {
                setShowTimePicker(false);
                if (time) setScheduledTime(time);
              }}
            />
          )}

          {/* Duration */}
          <Text style={styles.label}>Duration (minutes)</Text>
          <TextInput
            style={styles.input}
            placeholder="60"
            value={duration}
            onChangeText={setDuration}
            keyboardType="numeric"
          />

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
              {loading ? 'Sending...' : 'Send Meeting Invites'}
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
              <Text style={styles.modalTitle}>Select Pod</Text>
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
            {/* Select All Option */}
            <TouchableOpacity
              style={[styles.modalItem, styles.selectAllItem]}
              onPress={toggleSelectAll}
            >
              <View style={styles.participantInfo}>
                <View style={[styles.selectAllIcon, selectedParticipants.length === pursuitMembers.length && styles.selectAllIconActive]}>
                  <Ionicons
                    name={selectedParticipants.length === pursuitMembers.length ? "checkmark" : "people"}
                    size={18}
                    color={selectedParticipants.length === pursuitMembers.length ? colors.white : colors.primary}
                  />
                </View>
                <Text style={styles.selectAllText}>Select All ({pursuitMembers.length})</Text>
              </View>
              {selectedParticipants.length === pursuitMembers.length && (
                <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
              )}
            </TouchableOpacity>
            <FlatList
              data={pursuitMembers}
              keyExtractor={(item) => item.user_id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => toggleParticipant(item.user_id)}
                >
                  <View style={styles.participantInfo}>
                    {item.user?.profile_picture ? (
                      <Image
                        source={{ uri: item.user.profile_picture }}
                        style={styles.participantAvatar}
                      />
                    ) : (
                      <View style={[styles.participantAvatar, styles.participantAvatarPlaceholder]}>
                        <Text style={styles.participantAvatarText}>
                          {item.user?.name?.charAt(0).toUpperCase() || '?'}
                        </Text>
                      </View>
                    )}
                    <Text style={styles.modalItemText}>{item.user?.name || 'Team Member'}</Text>
                  </View>
                  {selectedParticipants.includes(item.user_id) ? (
                    <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                  ) : (
                    <View style={styles.uncheckedCircle} />
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
    gap: spacing.sm,
  },
  pickerText: {
    color: colors.textTertiary,
    flex: 1,
  },
  pickerTextSelected: {
    color: colors.textPrimary,
    flex: 1,
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
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  modalContent: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
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
  // Participants preview styles
  selectedParticipantsPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  previewAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.white,
  },
  previewAvatarPlaceholder: {
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewAvatarText: {
    fontSize: 12,
    fontWeight: typography.fontWeight.bold,
    color: colors.white,
  },
  previewAvatarMore: {
    backgroundColor: colors.textSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewAvatarMoreText: {
    fontSize: 10,
    fontWeight: typography.fontWeight.bold,
    color: colors.white,
  },
  // Participant modal styles
  participantInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.base,
  },
  participantAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  participantAvatarPlaceholder: {
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  participantAvatarText: {
    fontSize: 16,
    fontWeight: typography.fontWeight.bold,
    color: colors.white,
  },
  uncheckedCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.borderLight,
  },
  selectAllItem: {
    backgroundColor: colors.backgroundSecondary,
  },
  selectAllIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.primary,
  },
  selectAllIconActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  selectAllText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
  },
  datePickerContainer: {
    backgroundColor: colors.backgroundSecondary,
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
    fontWeight: typography.fontWeight.semibold,
  },
});
