import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal, TextInput, Image, ActivityIndicator, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuth } from '../contexts/AuthContext';
import { meetingService } from '../services/meetingService';
import { colors as legacyColors, typography, spacing, borderRadius, shadows } from '../theme/designSystem';
import { useTheme } from '../theme/ThemeContext';
import { getThemedStyles } from '../theme/themedStyles';
import GrainTexture from '../components/ui/GrainTexture';

interface Props {
  meeting: any;
  onClose: () => void;
  onJoinCall?: (meeting: any) => void;
  onMeetingUpdated?: (meeting: any) => void;
}

export default function MeetingDetailScreen({ meeting, onClose, onJoinCall, onMeetingUpdated }: Props) {
  const { user } = useAuth();
  const { theme, isNewTheme } = useTheme();
  const colors = theme.colors;
  const themedStyles = getThemedStyles(colors, isNewTheme);

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
    if (!meeting?.id) {
      console.warn('loadParticipants: No meeting ID available');
      setLoadingParticipants(false);
      return;
    }
    try {
      setLoadingParticipants(true);
      const data = await meetingService.getMeetingParticipants(meeting.id);
      setParticipants(data || []);
    } catch (error: any) {
      console.error('Error loading participants:', error?.message || error);
    } finally {
      setLoadingParticipants(false);
    }
  };

  const loadPodMembers = async () => {
    if (!meeting?.pursuit_id) {
      return;
    }
    try {
      const data = await meetingService.getPodMembers(meeting.pursuit_id);
      setPodMembers(data || []);
    } catch (error: any) {
      console.error('Error loading pod members:', error?.message || error);
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

  const accentColor = isNewTheme ? colors.accentGreen : legacyColors.primary;

  const renderParticipant = (participant: any) => {
    const profile = participant.user;
    const isParticipantCreator = participant.user_id === meeting.creator_id;

    return (
      <View key={participant.user_id} style={[styles.participantRow, { borderTopColor: colors.border }]}>
        {profile?.profile_picture ? (
          <Image source={{ uri: profile.profile_picture }} style={styles.participantAvatar} />
        ) : (
          <View style={[styles.participantAvatar, styles.participantAvatarPlaceholder, { backgroundColor: accentColor }]}>
            <Text style={[styles.participantInitial, { color: isNewTheme ? colors.background : colors.white }]}>
              {profile?.name?.charAt(0)?.toUpperCase() || '?'}
            </Text>
          </View>
        )}
        <View style={styles.participantInfo}>
          <Text style={[styles.participantName, { color: colors.textPrimary }]}>
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
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar barStyle={isNewTheme ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
        {isNewTheme && <GrainTexture opacity={0.06} />}
        <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => setIsEditing(false)} style={styles.closeButton}>
            <Ionicons name="close" size={28} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Edit Meeting</Text>
          <TouchableOpacity onPress={handleSaveChanges} disabled={saving}>
            {saving ? (
              <ActivityIndicator size="small" color={accentColor} />
            ) : (
              <Text style={[styles.saveButton, { color: accentColor }]}>Save</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scrollView} keyboardShouldPersistTaps="handled">
          <View style={styles.editForm}>
            <Text style={[styles.editLabel, { color: colors.textSecondary }]}>Title *</Text>
            <TextInput
              style={[styles.editInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
              value={editTitle}
              onChangeText={setEditTitle}
              placeholder="Meeting title"
              placeholderTextColor={colors.textTertiary}
            />

            <Text style={[styles.editLabel, { color: colors.textSecondary }]}>Description</Text>
            <TextInput
              style={[styles.editInput, styles.editTextArea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
              value={editDescription}
              onChangeText={setEditDescription}
              placeholder="Add a description..."
              placeholderTextColor={colors.textTertiary}
              multiline
              numberOfLines={4}
            />

            <Text style={[styles.editLabel, { color: colors.textSecondary }]}>Date & Time</Text>
            <View style={styles.dateTimeRow}>
              <TouchableOpacity
                style={[styles.editInput, styles.dateTimeButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => setShowDatePicker(true)}
              >
                <Ionicons name="calendar" size={20} color={colors.textSecondary} />
                <Text style={[styles.dateTimeText, { color: colors.textPrimary }]}>{editDate.toLocaleDateString()}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.editInput, styles.dateTimeButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => setShowTimePicker(true)}
              >
                <Ionicons name="time" size={20} color={colors.textSecondary} />
                <Text style={[styles.dateTimeText, { color: colors.textPrimary }]}>
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

            <Text style={[styles.editLabel, { color: colors.textSecondary }]}>Duration (minutes)</Text>
            <TextInput
              style={[styles.editInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
              value={editDuration}
              onChangeText={setEditDuration}
              placeholder="60"
              placeholderTextColor={colors.textTertiary}
              keyboardType="numeric"
            />

            <Text style={[styles.editLabel, { color: colors.textSecondary }]}>Meeting Type</Text>
            <View style={styles.meetingTypeOptions}>
              {['video', 'in_person', 'hybrid'].map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.meetingTypeOption,
                    { backgroundColor: colors.backgroundSecondary, borderColor: colors.border },
                    editMeetingType === type && { backgroundColor: accentColor, borderColor: accentColor }
                  ]}
                  onPress={() => setEditMeetingType(type as any)}
                >
                  <Ionicons
                    name={type === 'video' ? 'videocam' : type === 'in_person' ? 'location' : 'globe'}
                    size={18}
                    color={editMeetingType === type ? (isNewTheme ? colors.background : colors.white) : colors.textSecondary}
                  />
                  <Text style={[
                    styles.meetingTypeText,
                    { color: colors.textSecondary },
                    editMeetingType === type && { color: isNewTheme ? colors.background : colors.white, fontWeight: typography.fontWeight.semibold }
                  ]}>
                    {getMeetingTypeLabel(type)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {(editMeetingType === 'in_person' || editMeetingType === 'hybrid') && (
              <>
                <Text style={[styles.editLabel, { color: colors.textSecondary }]}>Location</Text>
                <TextInput
                  style={[styles.editInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
                  value={editLocation}
                  onChangeText={setEditLocation}
                  placeholder="Enter meeting location"
                  placeholderTextColor={colors.textTertiary}
                />
              </>
            )}
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
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={28} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Meeting Details</Text>
        {isCreator ? (
          <TouchableOpacity onPress={() => setIsEditing(true)}>
            <Ionicons name="create-outline" size={24} color={accentColor} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 24 }} />
        )}
      </View>

      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          {/* Meeting Title */}
          <View style={styles.titleSection}>
            <Text style={[styles.meetingTitle, { color: colors.textPrimary }]}>{meeting.title}</Text>
            {meeting.is_kickoff && (
              <View style={[styles.kickoffBadge, { backgroundColor: colors.warning }]}>
                <Text style={[styles.kickoffBadgeText, { color: isNewTheme ? colors.background : colors.white }]}>KICKOFF MEETING</Text>
              </View>
            )}
          </View>

          {/* Pursuit Link */}
          {meeting.pursuit && (
            <View style={[styles.pursuitCard, { backgroundColor: isNewTheme ? colors.primaryLight : legacyColors.primaryLight }]}>
              <Ionicons name="flag" size={20} color={accentColor} />
              <Text style={[styles.pursuitText, { color: accentColor }]}>{meeting.pursuit.title}</Text>
            </View>
          )}

          {/* Time & Date */}
          <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: isNewTheme ? 1 : 0 }]}>
            <View style={styles.infoRow}>
              <Ionicons name="calendar" size={24} color={accentColor} />
              <View style={styles.infoTextContainer}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Date</Text>
                <Text style={[styles.infoValue, { color: colors.textPrimary }]}>{formatDate(meeting.scheduled_time)}</Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <Ionicons name="time" size={24} color={accentColor} />
              <View style={styles.infoTextContainer}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Time</Text>
                <Text style={[styles.infoValue, { color: colors.textPrimary }]}>
                  {formatTime(meeting.scheduled_time)} ({meeting.duration_minutes || 60} min)
                </Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <Ionicons name={getMeetingTypeIcon()} size={24} color={accentColor} />
              <View style={styles.infoTextContainer}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Meeting Type</Text>
                <Text style={[styles.infoValue, { color: colors.textPrimary }]}>{getMeetingTypeLabel()}</Text>
              </View>
            </View>

            {meeting.location && (
              <View style={styles.infoRow}>
                <Ionicons name="location" size={24} color={accentColor} />
                <View style={styles.infoTextContainer}>
                  <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Location</Text>
                  <Text style={[styles.infoValue, { color: colors.textPrimary }]}>{meeting.location}</Text>
                </View>
              </View>
            )}
          </View>

          {/* Description */}
          {meeting.description && (
            <View style={[styles.descriptionCard, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: isNewTheme ? 1 : 0 }]}>
              <Text style={[styles.descriptionLabel, { color: colors.textSecondary }]}>Description</Text>
              <Text style={[styles.descriptionText, { color: colors.textPrimary }]}>{meeting.description}</Text>
            </View>
          )}

          {/* Participants Section */}
          <View style={[styles.participantsCard, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: isNewTheme ? 1 : 0 }]}>
            <View style={styles.participantsHeader}>
              <Text style={[styles.participantsTitle, { color: colors.textPrimary }]}>
                Participants ({participants.length})
              </Text>
              {isCreator && availableMembers.length > 0 && (
                <TouchableOpacity
                  style={styles.addParticipantBtn}
                  onPress={() => setShowAddParticipant(true)}
                >
                  <Ionicons name="person-add" size={18} color={accentColor} />
                  <Text style={[styles.addParticipantText, { color: accentColor }]}>Add</Text>
                </TouchableOpacity>
              )}
            </View>

            {loadingParticipants ? (
              <ActivityIndicator size="small" color={accentColor} style={{ padding: 20 }} />
            ) : participants.length === 0 ? (
              <Text style={[styles.noParticipantsText, { color: colors.textSecondary }]}>No participants yet</Text>
            ) : (
              participants.map(renderParticipant)
            )}
          </View>

          {/* Status Badge */}
          <View style={[styles.statusBadge, { backgroundColor: colors.backgroundSecondary }]}>
            <Text style={[styles.statusText, { color: colors.textSecondary }]}>
              {isUpcoming ? 'Upcoming' : 'Completed'}
            </Text>
          </View>

          {/* Join Video Call Button */}
          {canJoinVideo && (
            <TouchableOpacity
              style={[styles.joinButton, { backgroundColor: accentColor }]}
              onPress={handleJoinCall}
            >
              <Ionicons name="videocam" size={24} color={isNewTheme ? colors.background : colors.white} />
              <Text style={[styles.joinButtonText, { color: isNewTheme ? colors.background : colors.white }]}>Join Video Call</Text>
            </TouchableOpacity>
          )}

          {/* Channel Info for debugging (only show to creator) */}
          {isCreator && meeting.agora_channel_name && (
            <View style={[styles.debugInfo, { backgroundColor: colors.backgroundSecondary }]}>
              <Text style={[styles.debugLabel, { color: colors.textTertiary }]}>Video Channel:</Text>
              <Text style={[styles.debugValue, { color: colors.textSecondary }]}>{meeting.agora_channel_name}</Text>
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
        <View style={[styles.modalOverlay, { backgroundColor: isNewTheme ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.5)' }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Add Participant</Text>
              <TouchableOpacity onPress={() => setShowAddParticipant(false)}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll}>
              {availableMembers.length === 0 ? (
                <Text style={[styles.noMembersText, { color: colors.textSecondary }]}>All pod members are already in this meeting</Text>
              ) : (
                availableMembers.map((member) => {
                  const profile = member.user;
                  return (
                    <TouchableOpacity
                      key={member.user_id}
                      style={[styles.memberRow, { borderBottomColor: colors.border }]}
                      onPress={() => handleAddParticipant(member.user_id)}
                    >
                      {profile?.profile_picture ? (
                        <Image source={{ uri: profile.profile_picture }} style={styles.participantAvatar} />
                      ) : (
                        <View style={[styles.participantAvatar, styles.participantAvatarPlaceholder, { backgroundColor: accentColor }]}>
                          <Text style={[styles.participantInitial, { color: isNewTheme ? colors.background : colors.white }]}>
                            {profile?.name?.charAt(0)?.toUpperCase() || '?'}
                          </Text>
                        </View>
                      )}
                      <Text style={[styles.memberName, { color: colors.textPrimary }]}>
                        {profile?.name || profile?.email?.split('@')[0] || 'Unknown'}
                      </Text>
                      <Ionicons name="add-circle" size={24} color={accentColor} />
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
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 50,
    paddingBottom: spacing.base,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
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
  },
  saveButton: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
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
    marginBottom: spacing.sm,
  },
  kickoffBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  kickoffBadgeText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  pursuitCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.base,
    borderRadius: borderRadius.base,
    marginBottom: spacing.lg,
  },
  pursuitText: {
    flex: 1,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  infoCard: {
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
    marginBottom: 2,
  },
  infoValue: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  descriptionCard: {
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  descriptionLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  descriptionText: {
    fontSize: typography.fontSize.base,
    lineHeight: 22,
  },
  participantsCard: {
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
  },
  addParticipantBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addParticipantText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
  },
  participantAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  participantAvatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  participantInitial: {
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
  },
  participantStatus: {
    fontSize: typography.fontSize.sm,
  },
  removeParticipantBtn: {
    padding: spacing.xs,
  },
  noParticipantsText: {
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    marginBottom: spacing.lg,
  },
  statusText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  joinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: borderRadius.base,
    padding: spacing.lg,
    ...shadows.base,
  },
  joinButtonText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },
  debugInfo: {
    marginTop: spacing.lg,
    padding: spacing.base,
    borderRadius: borderRadius.base,
  },
  debugLabel: {
    fontSize: typography.fontSize.xs,
    marginBottom: 2,
  },
  debugValue: {
    fontSize: typography.fontSize.sm,
    fontFamily: 'monospace',
  },
  // Edit form styles
  editForm: {
    padding: spacing.lg,
  },
  editLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.xs,
    marginTop: spacing.base,
  },
  editInput: {
    borderWidth: 1,
    borderRadius: borderRadius.base,
    padding: spacing.base,
    fontSize: typography.fontSize.base,
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
  },
  meetingTypeOptions: {
    gap: spacing.sm,
  },
  meetingTypeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.base,
    borderRadius: borderRadius.base,
    borderWidth: 1,
  },
  meetingTypeText: {
    fontSize: typography.fontSize.base,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
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
  },
  modalTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },
  modalScroll: {
    padding: spacing.lg,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.base,
    borderBottomWidth: 1,
  },
  memberName: {
    flex: 1,
    marginLeft: spacing.base,
    fontSize: typography.fontSize.base,
  },
  noMembersText: {
    fontSize: typography.fontSize.base,
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },
});
