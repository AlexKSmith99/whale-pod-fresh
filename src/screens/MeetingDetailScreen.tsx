import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal, TextInput, Image, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuth } from '../contexts/AuthContext';
import { meetingService } from '../services/meetingService';
import { colors, typography, spacing, borderRadius, shadows } from '../theme/designSystem';

interface Props {
  meeting: any;
  onClose: () => void;
  onJoinCall?: (meeting: any) => void;
  onMeetingUpdated?: (meeting: any) => void;
}

export default function MeetingDetailScreen({ meeting, onClose, onJoinCall, onMeetingUpdated }: Props) {
  const { user } = useAuth();
  const [isCreator, setIsCreator] = useState(false);
  const [participants, setParticipants] = useState<any[]>([]);
  const [podMembers, setPodMembers] = useState<any[]>([]);
  const [loadingParticipants, setLoadingParticipants] = useState(true);

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(meeting.title || '');
  const [editDescription, setEditDescription] = useState(meeting.description || '');
  const [editDate, setEditDate] = useState(new Date(meeting.scheduled_time));
  const [editDuration, setEditDuration] = useState(String(meeting.duration_minutes || 60));
  const [editMeetingType, setEditMeetingType] = useState(meeting.meeting_type || 'video');
  const [editLocation, setEditLocation] = useState(meeting.location || '');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [saving, setSaving] = useState(false);

  // Add participant modal
  const [showAddParticipant, setShowAddParticipant] = useState(false);

  useEffect(() => {
    setIsCreator(meeting.creator_id === user?.id);
    loadParticipants();
    if (meeting.pursuit_id) {
      loadPodMembers();
    }
  }, [meeting, user]);

  const loadParticipants = async () => {
    try {
      setLoadingParticipants(true);
      const data = await meetingService.getMeetingParticipants(meeting.id);
      setParticipants(data);
    } catch (error) {
      console.error('Error loading participants:', error);
    } finally {
      setLoadingParticipants(false);
    }
  };

  const loadPodMembers = async () => {
    try {
      const data = await meetingService.getPodMembers(meeting.pursuit_id);
      setPodMembers(data);
    } catch (error) {
      console.error('Error loading pod members:', error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const getMeetingTypeLabel = (type?: string) => {
    const t = type || meeting.meeting_type;
    switch (t) {
      case 'video':
        return 'Video Call';
      case 'in_person':
        return 'In Person';
      case 'hybrid':
        return 'Hybrid (Video + In Person)';
      default:
        return t;
    }
  };

  const getMeetingTypeIcon = () => {
    switch (meeting.meeting_type) {
      case 'video':
        return 'videocam';
      case 'in_person':
        return 'location';
      case 'hybrid':
        return 'globe';
      default:
        return 'calendar';
    }
  };

  const handleJoinCall = () => {
    if (!meeting.agora_channel_name) {
      Alert.alert('Error', 'Video channel not available for this meeting');
      return;
    }

    if (meeting.meeting_type === 'in_person') {
      Alert.alert('In-Person Meeting', 'This is an in-person meeting. Please go to the location.');
      return;
    }

    if (onJoinCall) {
      onJoinCall(meeting);
    }
  };

  const handleSaveChanges = async () => {
    if (!editTitle.trim()) {
      Alert.alert('Error', 'Meeting title is required');
      return;
    }

    setSaving(true);
    try {
      const updatedMeeting = await meetingService.updateMeeting(meeting.id, {
        title: editTitle.trim(),
        description: editDescription.trim() || null,
        scheduled_time: editDate.toISOString(),
        duration_minutes: parseInt(editDuration) || 60,
        meeting_type: editMeetingType,
        location: editLocation.trim() || null,
      });

      Alert.alert('Success', 'Meeting updated successfully');
      setIsEditing(false);

      if (onMeetingUpdated) {
        onMeetingUpdated({ ...meeting, ...updatedMeeting });
      }
    } catch (error: any) {
      console.error('Error updating meeting:', error);
      Alert.alert('Error', error.message || 'Failed to update meeting');
    } finally {
      setSaving(false);
    }
  };

  const handleAddParticipant = async (userId: string) => {
    try {
      await meetingService.addParticipant(meeting.id, userId);
      await loadParticipants();
      setShowAddParticipant(false);
      Alert.alert('Success', 'Participant added');
    } catch (error: any) {
      console.error('Error adding participant:', error);
      Alert.alert('Error', error.message || 'Failed to add participant');
    }
  };

  const handleRemoveParticipant = (participant: any) => {
    if (participant.user_id === meeting.creator_id) {
      Alert.alert('Cannot Remove', 'Cannot remove the meeting creator');
      return;
    }

    Alert.alert(
      'Remove Participant',
      `Remove ${participant.user?.name || 'this person'} from the meeting?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await meetingService.removeParticipant(meeting.id, participant.user_id);
              await loadParticipants();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to remove participant');
            }
          }
        }
      ]
    );
  };

  const getParticipantStatusColor = (status: string) => {
    switch (status) {
      case 'accepted':
        return colors.success;
      case 'declined':
        return colors.error;
      case 'maybe':
        return colors.warning;
      default:
        return colors.textTertiary;
    }
  };

  const getParticipantStatusLabel = (status: string) => {
    switch (status) {
      case 'accepted':
        return 'Accepted';
      case 'declined':
        return 'Declined';
      case 'maybe':
        return 'Maybe';
      default:
        return 'Invited';
    }
  };

  const isUpcoming = new Date(meeting.scheduled_time) >= new Date();
  const canJoinVideo = (meeting.meeting_type === 'video' || meeting.meeting_type === 'hybrid') && meeting.agora_channel_name;

  // Get members not yet in meeting
  const availableMembers = podMembers.filter(
    member => !participants.some(p => p.user_id === member.user_id)
  );

  const renderParticipant = (participant: any) => {
    const profile = participant.user;
    const isParticipantCreator = participant.user_id === meeting.creator_id;

    return (
      <View key={participant.user_id} style={styles.participantRow}>
        {profile?.profile_picture ? (
          <Image source={{ uri: profile.profile_picture }} style={styles.participantAvatar} />
        ) : (
          <View style={[styles.participantAvatar, styles.participantAvatarPlaceholder]}>
            <Text style={styles.participantInitial}>
              {profile?.name?.charAt(0)?.toUpperCase() || '?'}
            </Text>
          </View>
        )}
        <View style={styles.participantInfo}>
          <Text style={styles.participantName}>
            {profile?.name || profile?.email?.split('@')[0] || 'Unknown'}
            {isParticipantCreator && ' (Organizer)'}
          </Text>
          <Text style={[styles.participantStatus, { color: getParticipantStatusColor(participant.status) }]}>
            {getParticipantStatusLabel(participant.status)}
          </Text>
        </View>
        {isCreator && !isParticipantCreator && (
          <TouchableOpacity
            style={styles.removeParticipantBtn}
            onPress={() => handleRemoveParticipant(participant)}
          >
            <Ionicons name="close-circle" size={22} color={colors.error} />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // Edit Mode View
  if (isEditing) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setIsEditing(false)} style={styles.closeButton}>
            <Ionicons name="close" size={28} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Meeting</Text>
          <TouchableOpacity onPress={handleSaveChanges} disabled={saving}>
            {saving ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={styles.saveButton}>Save</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scrollView} keyboardShouldPersistTaps="handled">
          <View style={styles.editForm}>
            <Text style={styles.editLabel}>Title *</Text>
            <TextInput
              style={styles.editInput}
              value={editTitle}
              onChangeText={setEditTitle}
              placeholder="Meeting title"
            />

            <Text style={styles.editLabel}>Description</Text>
            <TextInput
              style={[styles.editInput, styles.editTextArea]}
              value={editDescription}
              onChangeText={setEditDescription}
              placeholder="Add a description..."
              multiline
              numberOfLines={4}
            />

            <Text style={styles.editLabel}>Date & Time</Text>
            <View style={styles.dateTimeRow}>
              <TouchableOpacity
                style={[styles.editInput, styles.dateTimeButton]}
                onPress={() => setShowDatePicker(true)}
              >
                <Ionicons name="calendar" size={20} color={colors.textSecondary} />
                <Text style={styles.dateTimeText}>{editDate.toLocaleDateString()}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.editInput, styles.dateTimeButton]}
                onPress={() => setShowTimePicker(true)}
              >
                <Ionicons name="time" size={20} color={colors.textSecondary} />
                <Text style={styles.dateTimeText}>
                  {editDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                </Text>
              </TouchableOpacity>
            </View>

            {showDatePicker && (
              <DateTimePicker
                value={editDate}
                mode="date"
                onChange={(event, date) => {
                  setShowDatePicker(false);
                  if (date) {
                    const newDate = new Date(editDate);
                    newDate.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
                    setEditDate(newDate);
                  }
                }}
              />
            )}

            {showTimePicker && (
              <DateTimePicker
                value={editDate}
                mode="time"
                onChange={(event, date) => {
                  setShowTimePicker(false);
                  if (date) {
                    const newDate = new Date(editDate);
                    newDate.setHours(date.getHours(), date.getMinutes());
                    setEditDate(newDate);
                  }
                }}
              />
            )}

            <Text style={styles.editLabel}>Duration (minutes)</Text>
            <TextInput
              style={styles.editInput}
              value={editDuration}
              onChangeText={setEditDuration}
              placeholder="60"
              keyboardType="numeric"
            />

            <Text style={styles.editLabel}>Meeting Type</Text>
            <View style={styles.meetingTypeOptions}>
              {['video', 'in_person', 'hybrid'].map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.meetingTypeOption,
                    editMeetingType === type && styles.meetingTypeOptionSelected
                  ]}
                  onPress={() => setEditMeetingType(type as any)}
                >
                  <Ionicons
                    name={type === 'video' ? 'videocam' : type === 'in_person' ? 'location' : 'globe'}
                    size={18}
                    color={editMeetingType === type ? colors.white : colors.textSecondary}
                  />
                  <Text style={[
                    styles.meetingTypeText,
                    editMeetingType === type && styles.meetingTypeTextSelected
                  ]}>
                    {getMeetingTypeLabel(type)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {(editMeetingType === 'in_person' || editMeetingType === 'hybrid') && (
              <>
                <Text style={styles.editLabel}>Location</Text>
                <TextInput
                  style={styles.editInput}
                  value={editLocation}
                  onChangeText={setEditLocation}
                  placeholder="Enter meeting location"
                />
              </>
            )}
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={28} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Meeting Details</Text>
        {isCreator ? (
          <TouchableOpacity onPress={() => setIsEditing(true)}>
            <Ionicons name="create-outline" size={24} color={colors.primary} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 24 }} />
        )}
      </View>

      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          {/* Meeting Title */}
          <View style={styles.titleSection}>
            <Text style={styles.meetingTitle}>{meeting.title}</Text>
            {meeting.is_kickoff && (
              <View style={styles.kickoffBadge}>
                <Text style={styles.kickoffBadgeText}>KICKOFF MEETING</Text>
              </View>
            )}
          </View>

          {/* Pursuit Link */}
          {meeting.pursuit && (
            <View style={styles.pursuitCard}>
              <Ionicons name="flag" size={20} color={colors.primary} />
              <Text style={styles.pursuitText}>{meeting.pursuit.title}</Text>
            </View>
          )}

          {/* Time & Date */}
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Ionicons name="calendar" size={24} color={colors.primary} />
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoLabel}>Date</Text>
                <Text style={styles.infoValue}>{formatDate(meeting.scheduled_time)}</Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <Ionicons name="time" size={24} color={colors.primary} />
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoLabel}>Time</Text>
                <Text style={styles.infoValue}>
                  {formatTime(meeting.scheduled_time)} ({meeting.duration_minutes || 60} min)
                </Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <Ionicons name={getMeetingTypeIcon()} size={24} color={colors.primary} />
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoLabel}>Meeting Type</Text>
                <Text style={styles.infoValue}>{getMeetingTypeLabel()}</Text>
              </View>
            </View>

            {meeting.location && (
              <View style={styles.infoRow}>
                <Ionicons name="location" size={24} color={colors.primary} />
                <View style={styles.infoTextContainer}>
                  <Text style={styles.infoLabel}>Location</Text>
                  <Text style={styles.infoValue}>{meeting.location}</Text>
                </View>
              </View>
            )}
          </View>

          {/* Description */}
          {meeting.description && (
            <View style={styles.descriptionCard}>
              <Text style={styles.descriptionLabel}>Description</Text>
              <Text style={styles.descriptionText}>{meeting.description}</Text>
            </View>
          )}

          {/* Participants Section */}
          <View style={styles.participantsCard}>
            <View style={styles.participantsHeader}>
              <Text style={styles.participantsTitle}>
                Participants ({participants.length})
              </Text>
              {isCreator && availableMembers.length > 0 && (
                <TouchableOpacity
                  style={styles.addParticipantBtn}
                  onPress={() => setShowAddParticipant(true)}
                >
                  <Ionicons name="person-add" size={18} color={colors.primary} />
                  <Text style={styles.addParticipantText}>Add</Text>
                </TouchableOpacity>
              )}
            </View>

            {loadingParticipants ? (
              <ActivityIndicator size="small" color={colors.primary} style={{ padding: 20 }} />
            ) : participants.length === 0 ? (
              <Text style={styles.noParticipantsText}>No participants yet</Text>
            ) : (
              participants.map(renderParticipant)
            )}
          </View>

          {/* Status Badge */}
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>
              {isUpcoming ? 'Upcoming' : 'Completed'}
            </Text>
          </View>

          {/* Join Video Call Button */}
          {canJoinVideo && (
            <TouchableOpacity
              style={styles.joinButton}
              onPress={handleJoinCall}
            >
              <Ionicons name="videocam" size={24} color={colors.white} />
              <Text style={styles.joinButtonText}>Join Video Call</Text>
            </TouchableOpacity>
          )}

          {/* Channel Info for debugging (only show to creator) */}
          {isCreator && meeting.agora_channel_name && (
            <View style={styles.debugInfo}>
              <Text style={styles.debugLabel}>Video Channel:</Text>
              <Text style={styles.debugValue}>{meeting.agora_channel_name}</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Add Participant Modal */}
      <Modal
        visible={showAddParticipant}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddParticipant(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Participant</Text>
              <TouchableOpacity onPress={() => setShowAddParticipant(false)}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll}>
              {availableMembers.length === 0 ? (
                <Text style={styles.noMembersText}>All pod members are already in this meeting</Text>
              ) : (
                availableMembers.map((member) => {
                  const profile = member.user;
                  return (
                    <TouchableOpacity
                      key={member.user_id}
                      style={styles.memberRow}
                      onPress={() => handleAddParticipant(member.user_id)}
                    >
                      {profile?.profile_picture ? (
                        <Image source={{ uri: profile.profile_picture }} style={styles.participantAvatar} />
                      ) : (
                        <View style={[styles.participantAvatar, styles.participantAvatarPlaceholder]}>
                          <Text style={styles.participantInitial}>
                            {profile?.name?.charAt(0)?.toUpperCase() || '?'}
                          </Text>
                        </View>
                      )}
                      <Text style={styles.memberName}>
                        {profile?.name || profile?.email?.split('@')[0] || 'Unknown'}
                      </Text>
                      <Ionicons name="add-circle" size={24} color={colors.primary} />
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
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
  saveButton: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing['4xl'],
  },
  titleSection: {
    marginBottom: spacing.lg,
  },
  meetingTitle: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  kickoffBadge: {
    backgroundColor: colors.warning,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  kickoffBadgeText: {
    color: colors.white,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  pursuitCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primaryLight,
    padding: spacing.base,
    borderRadius: borderRadius.base,
    marginBottom: spacing.lg,
  },
  pursuitText: {
    flex: 1,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary,
  },
  infoCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    gap: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
  },
  infoTextContainer: {
    flex: 1,
  },
  infoLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
  },
  descriptionCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  descriptionLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  descriptionText: {
    fontSize: typography.fontSize.base,
    color: colors.textPrimary,
    lineHeight: 22,
  },
  participantsCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  participantsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.base,
  },
  participantsTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
  },
  addParticipantBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addParticipantText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary,
  },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
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
  participantInitial: {
    color: colors.white,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
  },
  participantInfo: {
    flex: 1,
    marginLeft: spacing.base,
  },
  participantName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.textPrimary,
  },
  participantStatus: {
    fontSize: typography.fontSize.sm,
  },
  removeParticipantBtn: {
    padding: spacing.xs,
  },
  noParticipantsText: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.backgroundSecondary,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    marginBottom: spacing.lg,
  },
  statusText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.textSecondary,
  },
  joinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.base,
    padding: spacing.lg,
    ...shadows.base,
  },
  joinButtonText: {
    color: colors.white,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },
  debugInfo: {
    marginTop: spacing.lg,
    padding: spacing.base,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.base,
  },
  debugLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.textTertiary,
    marginBottom: 2,
  },
  debugValue: {
    fontSize: typography.fontSize.sm,
    fontFamily: 'monospace',
    color: colors.textSecondary,
  },
  // Edit form styles
  editForm: {
    padding: spacing.lg,
  },
  editLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    marginTop: spacing.base,
  },
  editInput: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.base,
    padding: spacing.base,
    fontSize: typography.fontSize.base,
    color: colors.textPrimary,
  },
  editTextArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  dateTimeRow: {
    flexDirection: 'row',
    gap: spacing.base,
  },
  dateTimeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dateTimeText: {
    fontSize: typography.fontSize.base,
    color: colors.textPrimary,
  },
  meetingTypeOptions: {
    gap: spacing.sm,
  },
  meetingTypeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.base,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.base,
    borderWidth: 1,
    borderColor: colors.border,
  },
  meetingTypeOptionSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  meetingTypeText: {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
  },
  meetingTypeTextSelected: {
    color: colors.white,
    fontWeight: typography.fontWeight.semibold,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.white,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '70%',
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
  modalScroll: {
    padding: spacing.lg,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  memberName: {
    flex: 1,
    marginLeft: spacing.base,
    fontSize: typography.fontSize.base,
    color: colors.textPrimary,
  },
  noMembersText: {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },
});
