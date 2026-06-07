import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal, TextInput, Image, ActivityIndicator, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuth } from '../contexts/AuthContext';
import { meetingService } from '../services/meetingService';
import { supabase } from '../config/supabase';
import { colors as legacyColors, typography, spacing, borderRadius, shadows, editorial } from '../theme/designSystem';
import { useTheme } from '../theme/ThemeContext';
import { getThemedStyles } from '../theme/themedStyles';
import GrainTexture from '../components/ui/GrainTexture';
import { AppAlert } from '../components/ui/AppAlert';

// Editorial light-mode helpers.
const lightLabel = {
  color: editorial.muted,
  fontFamily: 'InterTight_600SemiBold' as const,
  fontSize: 10,
  textTransform: 'uppercase' as const,
  letterSpacing: 0.6,
};
// Pie dark-mode label — 12px uppercase, dimmed, ls 1 (de-shouted section labels).
const darkLabel = {
  color: 'rgba(255, 255, 255, 0.45)' as const,
  fontFamily: 'Sora_600SemiBold' as const,
  fontSize: 12,
  textTransform: 'uppercase' as const,
  letterSpacing: 1,
};
const lightInput = {
  backgroundColor: 'transparent' as const,
  borderWidth: 0,
  borderBottomWidth: 1,
  borderColor: editorial.hairline,
  borderRadius: 0,
  paddingHorizontal: 0,
  fontFamily: 'InterTight_600SemiBold' as const,
  color: editorial.ink,
};
const lightSurfaceInput = {
  backgroundColor: editorial.surface,
  borderWidth: 1,
  borderColor: editorial.hairline,
  borderRadius: 14,
  fontFamily: 'InterTight_600SemiBold' as const,
};
// White card with hairline border + soft editorial shadow.
const lightCard = {
  backgroundColor: editorial.surface,
  borderWidth: 1,
  borderColor: editorial.hairline,
  borderRadius: 14,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.06,
  shadowRadius: 14,
  elevation: 3,
};

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

  // Recurring series info (loaded when meeting.series_id is set)
  const [seriesCadence, setSeriesCadence] = useState<string | null>(null);
  const [canEditRecurring, setCanEditRecurring] = useState(false);

  useEffect(() => {
    setIsCreator(meeting.creator_id === user?.id);
    loadParticipants();
    if (meeting.pursuit_id) {
      loadPodMembers();
    }
    if (meeting.series_id) {
      loadSeriesMetadata();
    } else {
      setSeriesCadence(null);
    }
    if (meeting.pursuit_id && user) {
      meetingService.canCreateRecurring(meeting.pursuit_id, user.id).then(setCanEditRecurring);
    }
  }, [meeting, user]);

  const loadSeriesMetadata = async () => {
    try {
      const { data } = await supabase
        .from('meeting_series')
        .select('cadence')
        .eq('id', meeting.series_id)
        .single();
      if (data?.cadence) setSeriesCadence(data.cadence);
    } catch (err) {
      console.warn('Error loading series metadata:', err);
    }
  };

  const recurringLabel = () => {
    if (!seriesCadence) return null;
    switch (seriesCadence) {
      case 'weekly': return 'Repeats weekly';
      case 'biweekly': return 'Repeats every 2 weeks';
      case 'monthly': return 'Repeats monthly';
      default: return `Repeats ${seriesCadence}`;
    }
  };

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
      AppAlert.alert('Error', 'Video channel not available for this meeting');
      return;
    }

    if (meeting.meeting_type === 'in_person') {
      AppAlert.alert('In-Person Meeting', 'This is an in-person meeting. Please go to the location.');
      return;
    }

    if (onJoinCall) {
      onJoinCall(meeting);
    }
  };

  // Persist changes to either a single occurrence or the entire series.
  const applyMeetingChanges = async (scope: 'single' | 'series') => {
    setSaving(true);
    try {
      if (scope === 'series' && meeting.series_id) {
        // Split out time-of-day so the series helper can re-apply it to every future instance
        const timeOfDay = { hours: editDate.getHours(), minutes: editDate.getMinutes() };
        await meetingService.updateMeetingSeries(meeting.series_id, {
          title: editTitle.trim(),
          description: editDescription.trim() || null,
          duration_minutes: parseInt(editDuration) || 60,
          meeting_type: editMeetingType,
          location: editLocation.trim() || null,
          time_of_day: timeOfDay,
        });
        AppAlert.alert('Series Updated', 'All future occurrences have been updated.');
      } else if (meeting.series_id) {
        // Single occurrence inside a series — flag as exception
        await meetingService.updateSingleMeetingInSeries(meeting.id, {
          title: editTitle.trim(),
          description: editDescription.trim() || null,
          scheduled_time: editDate.toISOString(),
          duration_minutes: parseInt(editDuration) || 60,
          meeting_type: editMeetingType,
          location: editLocation.trim() || null,
        });
        AppAlert.alert('Meeting Updated', 'This occurrence was updated. Other occurrences in the series were not affected.');
      } else {
        await meetingService.updateMeeting(meeting.id, {
          title: editTitle.trim(),
          description: editDescription.trim() || null,
          scheduled_time: editDate.toISOString(),
          duration_minutes: parseInt(editDuration) || 60,
          meeting_type: editMeetingType,
          location: editLocation.trim() || null,
        });
        AppAlert.alert('Success', 'Meeting updated successfully');
      }
      setIsEditing(false);
      if (onMeetingUpdated) {
        onMeetingUpdated({
          ...meeting,
          title: editTitle.trim(),
          description: editDescription.trim() || null,
          scheduled_time: editDate.toISOString(),
          duration_minutes: parseInt(editDuration) || 60,
          meeting_type: editMeetingType,
          location: editLocation.trim() || null,
        });
      }
    } catch (error: any) {
      console.error('Error updating meeting:', error);
      AppAlert.alert('Error', error.message || 'Failed to update meeting');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveChanges = async () => {
    if (!editTitle.trim()) {
      AppAlert.alert('Error', 'Meeting title is required');
      return;
    }

    // If this meeting belongs to a series, ask scope
    if (meeting.series_id) {
      AppAlert.alert(
        'Save Changes',
        'This meeting is part of a recurring series. What would you like to update?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'This meeting only', onPress: () => applyMeetingChanges('single') },
          { text: 'Entire series', onPress: () => applyMeetingChanges('series') },
        ]
      );
      return;
    }

    // Non-series path — preserve existing one-off behavior
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

      AppAlert.alert('Success', 'Meeting updated successfully');
      setIsEditing(false);

      if (onMeetingUpdated) {
        onMeetingUpdated({ ...meeting, ...updatedMeeting });
      }
    } catch (error: any) {
      console.error('Error updating meeting:', error);
      AppAlert.alert('Error', error.message || 'Failed to update meeting');
    } finally {
      setSaving(false);
    }
  };

  const handleAddParticipant = async (userId: string) => {
    try {
      await meetingService.addParticipant(meeting.id, userId);
      await loadParticipants();
      setShowAddParticipant(false);
      AppAlert.alert('Success', 'Participant added');
    } catch (error: any) {
      console.error('Error adding participant:', error);
      // native Alert: fires while Add Participant modal is open (error thrown before modal closes)
      Alert.alert('Error', error.message || 'Failed to add participant');
    }
  };

  const handleRemoveParticipant = (participant: any) => {
    if (participant.user_id === meeting.creator_id) {
      AppAlert.alert('Cannot Remove', 'Cannot remove the meeting creator');
      return;
    }

    AppAlert.alert(
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
              AppAlert.alert('Error', error.message || 'Failed to remove participant');
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
  // Info-card icons: lime in dark, but demoted to muted ink in light so Carolina
  // stays an exception (≤3 accents/screen — editorial restraint).
  const infoIconColor = isNewTheme ? colors.accentGreen : editorial.muted;

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
          <Text style={[styles.participantName, { color: colors.textPrimary }, !isNewTheme && { fontFamily: 'InterTight_600SemiBold' }]}>
            {profile?.name || profile?.email?.split('@')[0] || 'Unknown'}
            {isParticipantCreator && ' (Organizer)'}
          </Text>
          <Text style={[styles.participantStatus, { color: getParticipantStatusColor(participant.status) }, !isNewTheme && { fontFamily: 'InterTight_600SemiBold' }]}>
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
        <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }, !isNewTheme && { backgroundColor: editorial.bg, borderBottomWidth: 0 }]}>
          <TouchableOpacity onPress={() => setIsEditing(false)} style={styles.closeButton} activeOpacity={0.6} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={28} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }, isNewTheme ? { fontFamily: 'Sora_700Bold', letterSpacing: -0.3 } : { fontFamily: 'PlayfairDisplay_700Bold', fontSize: 22, letterSpacing: -0.4 }]}>Edit Meeting</Text>
          <TouchableOpacity onPress={handleSaveChanges} disabled={saving} activeOpacity={0.6} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            {saving ? (
              <ActivityIndicator size="small" color={accentColor} />
            ) : (
              <Text style={[styles.saveButton, { color: accentColor }]}>Save</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scrollView} keyboardShouldPersistTaps="handled">
          <View style={styles.editForm}>
            <Text style={[styles.editLabel, (isNewTheme ? darkLabel : lightLabel)]}>Title *</Text>
            <TextInput
              style={[styles.editInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }, !isNewTheme && lightInput]}
              value={editTitle}
              onChangeText={setEditTitle}
              placeholder="Meeting title"
              placeholderTextColor={colors.textTertiary}
            />

            <Text style={[styles.editLabel, (isNewTheme ? darkLabel : lightLabel)]}>Description</Text>
            <TextInput
              style={[styles.editInput, styles.editTextArea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }, !isNewTheme && lightSurfaceInput]}
              value={editDescription}
              onChangeText={setEditDescription}
              placeholder="Add a description..."
              placeholderTextColor={colors.textTertiary}
              multiline
              numberOfLines={4}
            />

            <Text style={[styles.editLabel, (isNewTheme ? darkLabel : lightLabel)]}>Date & Time</Text>
            <View style={styles.dateTimeRow}>
              <TouchableOpacity
                style={[styles.editInput, styles.dateTimeButton, { backgroundColor: colors.surface, borderColor: colors.border }, !isNewTheme && lightSurfaceInput]}
                onPress={() => setShowDatePicker(true)}
              >
                <Ionicons name="calendar" size={20} color={colors.textSecondary} />
                <Text style={[styles.dateTimeText, { color: colors.textPrimary }]}>{editDate.toLocaleDateString()}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.editInput, styles.dateTimeButton, { backgroundColor: colors.surface, borderColor: colors.border }, !isNewTheme && lightSurfaceInput]}
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

            <Text style={[styles.editLabel, (isNewTheme ? darkLabel : lightLabel)]}>Duration (minutes)</Text>
            <TextInput
              style={[styles.editInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }, !isNewTheme && lightInput]}
              value={editDuration}
              onChangeText={setEditDuration}
              placeholder="60"
              placeholderTextColor={colors.textTertiary}
              keyboardType="numeric"
            />

            <Text style={[styles.editLabel, (isNewTheme ? darkLabel : lightLabel)]}>Meeting Type</Text>
            <View style={styles.meetingTypeOptions}>
              {['video', 'in_person', 'hybrid'].map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.meetingTypeOption,
                    { backgroundColor: 'transparent', borderColor: isNewTheme ? colors.border : editorial.hairline },
                    editMeetingType === type && { backgroundColor: accentColor, borderColor: accentColor }
                  ]}
                  activeOpacity={0.6}
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
                <Text style={[styles.editLabel, (isNewTheme ? darkLabel : lightLabel)]}>Location</Text>
                <TextInput
                  style={[styles.editInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }, !isNewTheme && lightInput]}
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
        <TouchableOpacity onPress={onClose} style={styles.closeButton} activeOpacity={0.6} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="close" size={28} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }, isNewTheme ? { fontFamily: 'Sora_700Bold', letterSpacing: -0.3 } : { fontFamily: 'PlayfairDisplay_700Bold', fontSize: 22, letterSpacing: -0.4 }]}>Meeting Details</Text>
        {isCreator || (meeting.series_id && canEditRecurring) ? (
          <TouchableOpacity onPress={() => setIsEditing(true)} activeOpacity={0.6} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="create-outline" size={24} color={isNewTheme ? accentColor : editorial.ink} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 24 }} />
        )}
      </View>

      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          {/* Meeting Title */}
          <View style={styles.titleSection}>
            <Text style={[styles.meetingTitle, { color: colors.textPrimary }, isNewTheme ? { fontFamily: 'Sora_700Bold', letterSpacing: -0.3 } : { fontFamily: 'PlayfairDisplay_700Bold', fontSize: 28, letterSpacing: -0.5 }]}>{meeting.title}</Text>
            {meeting.is_kickoff && (
              <View style={[
                styles.kickoffBadge,
                isNewTheme
                  ? { backgroundColor: 'rgba(184, 134, 11, 0.16)', borderWidth: 1, borderColor: 'rgba(184, 134, 11, 0.40)' }
                  : { backgroundColor: editorial.goldTint, borderWidth: 1, borderColor: 'rgba(196, 155, 0, 0.30)' },
              ]}>
                <Text style={[
                  styles.kickoffBadgeText,
                  isNewTheme
                    ? { color: colors.warning, fontFamily: 'Sora_600SemiBold', fontSize: 10, letterSpacing: 1, textTransform: 'uppercase' }
                    : { color: editorial.gold, fontFamily: 'InterTight_600SemiBold', fontSize: 10, letterSpacing: 0.6, textTransform: 'uppercase' },
                ]}>KICKOFF MEETING</Text>
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
          <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: isNewTheme ? 1 : 0 }, !isNewTheme && lightCard]}>
            <View style={styles.infoRow}>
              <Ionicons name="calendar" size={24} color={infoIconColor} />
              <View style={styles.infoTextContainer}>
                <Text style={[styles.infoLabel, (isNewTheme ? darkLabel : lightLabel)]}>Date</Text>
                <Text style={[styles.infoValue, { color: colors.textPrimary }]}>{formatDate(meeting.scheduled_time)}</Text>
                {seriesCadence && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 }}>
                    <Ionicons name="repeat" size={14} color={accentColor} />
                    <Text style={{ fontSize: 12, color: colors.textSecondary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }}>
                      {recurringLabel()}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            <View style={styles.infoRow}>
              <Ionicons name="time" size={24} color={infoIconColor} />
              <View style={styles.infoTextContainer}>
                <Text style={[styles.infoLabel, (isNewTheme ? darkLabel : lightLabel)]}>Time</Text>
                <Text style={[styles.infoValue, { color: colors.textPrimary }]}>
                  {formatTime(meeting.scheduled_time)} ({meeting.duration_minutes || 60} min)
                </Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <Ionicons name={getMeetingTypeIcon()} size={24} color={infoIconColor} />
              <View style={styles.infoTextContainer}>
                <Text style={[styles.infoLabel, (isNewTheme ? darkLabel : lightLabel)]}>Meeting Type</Text>
                <Text style={[styles.infoValue, { color: colors.textPrimary }]}>{getMeetingTypeLabel()}</Text>
              </View>
            </View>

            {meeting.location && (
              <View style={styles.infoRow}>
                <Ionicons name="location" size={24} color={infoIconColor} />
                <View style={styles.infoTextContainer}>
                  <Text style={[styles.infoLabel, (isNewTheme ? darkLabel : lightLabel)]}>Location</Text>
                  <Text style={[styles.infoValue, { color: colors.textPrimary }]}>{meeting.location}</Text>
                </View>
              </View>
            )}
          </View>

          {/* Description */}
          {meeting.description && (
            <View style={[styles.descriptionCard, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: isNewTheme ? 1 : 0 }, !isNewTheme && lightCard]}>
              <Text style={[styles.descriptionLabel, (isNewTheme ? darkLabel : lightLabel)]}>Description</Text>
              <Text style={[styles.descriptionText, { color: colors.textPrimary }]}>{meeting.description}</Text>
            </View>
          )}

          {/* Participants Section */}
          <View style={[styles.participantsCard, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: isNewTheme ? 1 : 0 }, !isNewTheme && lightCard]}>
            <View style={styles.participantsHeader}>
              <Text style={[styles.participantsTitle, { color: colors.textPrimary }, { fontFamily: isNewTheme ? 'Sora_700Bold' : 'InterTight_600SemiBold' }]}>
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

          {/* Status — passive status = plain de-shouted label (no pill) in both themes */}
          <View style={[styles.statusBadge, { backgroundColor: 'transparent', paddingHorizontal: 0 }]}>
            <Text style={[
              styles.statusText,
              isNewTheme
                ? { color: 'rgba(255, 255, 255, 0.45)', fontFamily: 'Sora_600SemiBold', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }
                : { color: editorial.muted, fontFamily: 'InterTight_600SemiBold', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.6 },
            ]}>
              {isUpcoming ? 'Upcoming' : 'Completed'}
            </Text>
          </View>

          {/* Join Video Call Button */}
          {canJoinVideo && (
            <TouchableOpacity
              style={[styles.joinButton, { backgroundColor: accentColor, borderRadius: 999 }, !isNewTheme && { backgroundColor: editorial.ink, shadowOpacity: 0 }]}
              onPress={handleJoinCall}
              activeOpacity={0.85}
            >
              <Ionicons name="videocam" size={24} color={isNewTheme ? colors.background : colors.white} />
              <Text style={[styles.joinButtonText, { color: isNewTheme ? colors.background : colors.white }, !isNewTheme && { fontFamily: 'InterTight_600SemiBold' }]}>Join Video Call</Text>
            </TouchableOpacity>
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
              <Text style={[styles.modalTitle, { color: colors.textPrimary }, { fontFamily: isNewTheme ? 'Sora_700Bold' : 'PlayfairDisplay_700Bold' }]}>Add Participant</Text>
              <TouchableOpacity onPress={() => setShowAddParticipant(false)} activeOpacity={0.6} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
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
                      <Text style={[styles.memberName, { color: colors.textPrimary }, !isNewTheme && { fontFamily: 'InterTight_600SemiBold' }]}>
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
    marginBottom: 5,
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
