import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { meetingService } from '../services/meetingService';
import { supabase } from '../config/supabase';
import { colors as legacyColors, typography, spacing, borderRadius } from '../theme/designSystem';
import { useTheme } from '../theme/ThemeContext';
import { getThemedStyles } from '../theme/themedStyles';
import GrainTexture from '../components/ui/GrainTexture';

interface Props {
  meetingId: string;
  onBack: () => void;
  onResponded?: () => void;
}

interface MeetingDetails {
  id: string;
  title: string;
  description: string;
  meeting_type: 'in_person' | 'video' | 'hybrid';
  location: string;
  scheduled_time: string;
  duration_minutes: number;
  timezone: string;
  pursuit: {
    id: string;
    title: string;
  };
  creator: {
    id: string;
    name: string;
    email: string;
  };
}

export default function MeetingInvitationScreen({ meetingId, onBack, onResponded }: Props) {
  const { user } = useAuth();
  const { theme, isNewTheme } = useTheme();
  const colors = theme.colors;
  const themedStyles = getThemedStyles(colors, isNewTheme);

  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState(false);
  const [meeting, setMeeting] = useState<MeetingDetails | null>(null);
  const [currentStatus, setCurrentStatus] = useState<string>('invited');

  const accentColor = isNewTheme ? colors.accentGreen : legacyColors.primary;

  useEffect(() => {
    loadMeetingDetails();
  }, [meetingId]);

  const loadMeetingDetails = async () => {
    try {
      // Get meeting details
      const { data: meetingData, error: meetingError } = await supabase
        .from('meetings')
        .select(`
          *,
          pursuit:pursuits(id, title),
          creator:profiles!meetings_creator_id_fkey(id, name, email)
        `)
        .eq('id', meetingId)
        .single();

      if (meetingError) throw meetingError;

      setMeeting(meetingData);

      // Get current user's participant status
      if (user) {
        const { data: participantData } = await supabase
          .from('meeting_participants')
          .select('status')
          .eq('meeting_id', meetingId)
          .eq('user_id', user.id)
          .single();

        if (participantData) {
          setCurrentStatus(participantData.status);
        }
      }
    } catch (error) {
      console.error('Error loading meeting details:', error);
      Alert.alert('Error', 'Failed to load meeting details');
    } finally {
      setLoading(false);
    }
  };

  const handleResponse = async (status: 'accepted' | 'declined' | 'maybe') => {
    if (!user || !meeting) return;

    setResponding(true);
    try {
      await meetingService.updateParticipantStatus(meetingId, user.id, status);
      setCurrentStatus(status);

      const statusMessages = {
        accepted: 'Meeting accepted! It has been added to your calendar.',
        declined: 'Meeting declined.',
        maybe: 'Marked as tentative. It has been added to your calendar.',
      };

      Alert.alert('Response Recorded', statusMessages[status], [
        { text: 'OK', onPress: () => {
          onResponded?.();
        }}
      ]);
    } catch (error) {
      console.error('Error responding to meeting:', error);
      Alert.alert('Error', 'Failed to record your response');
    } finally {
      setResponding(false);
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    const dateFormatted = date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
    const timeFormatted = date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    return { date: dateFormatted, time: timeFormatted };
  };

  const getMeetingTypeIcon = (type: string) => {
    switch (type) {
      case 'video':
        return 'videocam';
      case 'in_person':
        return 'location';
      case 'hybrid':
        return 'people';
      default:
        return 'calendar';
    }
  };

  const getMeetingTypeLabel = (type: string) => {
    switch (type) {
      case 'video':
        return 'Video Call';
      case 'in_person':
        return 'In Person';
      case 'hybrid':
        return 'Hybrid';
      default:
        return type;
    }
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <StatusBar barStyle={isNewTheme ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
        {isNewTheme && <GrainTexture opacity={0.06} />}
        <ActivityIndicator size="large" color={accentColor} />
      </View>
    );
  }

  if (!meeting) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar barStyle={isNewTheme ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
        {isNewTheme && <GrainTexture opacity={0.06} />}
        <Text style={[styles.errorText, { color: colors.textSecondary }]}>Meeting not found</Text>
        <TouchableOpacity style={[styles.closeButtonError, { backgroundColor: accentColor }]} onPress={onBack}>
          <Text style={[styles.closeButtonErrorText, { color: isNewTheme ? colors.background : colors.white }]}>Close</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { date, time } = formatDateTime(meeting.scheduled_time);
  const hasResponded = currentStatus !== 'invited';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isNewTheme ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      {isNewTheme && <GrainTexture opacity={0.06} />}
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onBack} style={styles.closeButton}>
          <Ionicons name="close" size={28} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Meeting Invitation</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Pod Badge */}
        <View style={[styles.podBadge, { backgroundColor: colors.backgroundSecondary }]}>
          <Ionicons name="people-circle" size={16} color={accentColor} />
          <Text style={[styles.podBadgeText, { color: accentColor }]}>{meeting.pursuit?.title}</Text>
        </View>

        {/* Meeting Title */}
        <Text style={[styles.meetingTitle, { color: colors.textPrimary }]}>{meeting.title}</Text>

        {/* Organizer */}
        <View style={styles.organizerRow}>
          <Text style={[styles.organizerLabel, { color: colors.textSecondary }]}>Organized by </Text>
          <Text style={[styles.organizerName, { color: colors.textPrimary }]}>
            {meeting.creator?.name || meeting.creator?.email?.split('@')[0] || 'The organizer'}
          </Text>
        </View>

        {/* Meeting Details Card */}
        <View style={[styles.detailsCard, { backgroundColor: colors.surface, borderWidth: isNewTheme ? 1 : 0, borderColor: colors.border }]}>
          {/* Date & Time */}
          <View style={styles.detailRow}>
            <View style={[styles.detailIcon, { backgroundColor: colors.backgroundSecondary }]}>
              <Ionicons name="calendar" size={22} color={accentColor} />
            </View>
            <View style={styles.detailContent}>
              <Text style={[styles.detailTitle, { color: colors.textPrimary }]}>{date}</Text>
              <Text style={[styles.detailSubtitle, { color: colors.textSecondary }]}>{time} ({meeting.duration_minutes} min)</Text>
            </View>
          </View>

          {/* Meeting Type */}
          <View style={styles.detailRow}>
            <View style={[styles.detailIcon, { backgroundColor: colors.backgroundSecondary }]}>
              <Ionicons name={getMeetingTypeIcon(meeting.meeting_type) as any} size={22} color={accentColor} />
            </View>
            <View style={styles.detailContent}>
              <Text style={[styles.detailTitle, { color: colors.textPrimary }]}>{getMeetingTypeLabel(meeting.meeting_type)}</Text>
              {meeting.location && (
                <Text style={[styles.detailSubtitle, { color: colors.textSecondary }]}>{meeting.location}</Text>
              )}
            </View>
          </View>

          {/* Description */}
          {meeting.description && (
            <View style={[styles.descriptionSection, { borderTopColor: colors.border }]}>
              <Text style={[styles.descriptionLabel, { color: colors.textSecondary }]}>Description</Text>
              <Text style={[styles.descriptionText, { color: colors.textPrimary }]}>{meeting.description}</Text>
            </View>
          )}
        </View>

        {/* Current Status */}
        {hasResponded && (
          <View style={styles.currentStatusContainer}>
            <Text style={[styles.currentStatusLabel, { color: colors.textSecondary }]}>Your Response:</Text>
            <View style={[
              styles.currentStatusBadge,
              currentStatus === 'accepted' && styles.statusAccepted,
              currentStatus === 'declined' && styles.statusDeclined,
              currentStatus === 'maybe' && styles.statusMaybe,
            ]}>
              <Ionicons
                name={currentStatus === 'accepted' ? 'checkmark-circle' : currentStatus === 'declined' ? 'close-circle' : 'help-circle'}
                size={18}
                color={colors.white}
              />
              <Text style={[styles.currentStatusText, { color: colors.white }]}>
                {currentStatus === 'accepted' ? 'Accepted' : currentStatus === 'declined' ? 'Declined' : 'Tentative'}
              </Text>
            </View>
          </View>
        )}

        {/* Response Buttons */}
        <View style={[styles.responseSection, { backgroundColor: colors.surface, borderWidth: isNewTheme ? 1 : 0, borderColor: colors.border }]}>
          <Text style={[styles.responseSectionTitle, { color: colors.textPrimary }]}>
            {hasResponded ? 'Change your response' : 'Will you attend?'}
          </Text>

          <View style={styles.responseButtons}>
            <TouchableOpacity
              style={[
                styles.responseButton,
                styles.acceptButton,
                currentStatus === 'accepted' && { backgroundColor: '#22c55e', borderColor: '#22c55e' },
              ]}
              onPress={() => handleResponse('accepted')}
              disabled={responding}
            >
              <Ionicons name="checkmark-circle" size={24} color={currentStatus === 'accepted' ? colors.white : '#22c55e'} />
              <Text style={[
                styles.responseButtonText,
                styles.acceptButtonText,
                currentStatus === 'accepted' && { color: colors.white },
              ]}>Accept</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.responseButton,
                styles.maybeButton,
                currentStatus === 'maybe' && { backgroundColor: '#f59e0b', borderColor: '#f59e0b' },
              ]}
              onPress={() => handleResponse('maybe')}
              disabled={responding}
            >
              <Ionicons name="help-circle" size={24} color={currentStatus === 'maybe' ? colors.white : '#f59e0b'} />
              <Text style={[
                styles.responseButtonText,
                styles.maybeButtonText,
                currentStatus === 'maybe' && { color: colors.white },
              ]}>Tentative</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.responseButton,
                styles.declineButton,
                currentStatus === 'declined' && { backgroundColor: '#ef4444', borderColor: '#ef4444' },
              ]}
              onPress={() => handleResponse('declined')}
              disabled={responding}
            >
              <Ionicons name="close-circle" size={24} color={currentStatus === 'declined' ? colors.white : '#ef4444'} />
              <Text style={[
                styles.responseButtonText,
                styles.declineButtonText,
                currentStatus === 'declined' && { color: colors.white },
              ]}>Decline</Text>
            </TouchableOpacity>
          </View>
        </View>

        {responding && (
          <View style={styles.respondingOverlay}>
            <ActivityIndicator size="small" color={accentColor} />
            <Text style={[styles.respondingText, { color: colors.textSecondary }]}>Recording your response...</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing['4xl'],
  },
  podBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    marginBottom: spacing.base,
  },
  podBadgeText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginLeft: spacing.xs,
  },
  meetingTitle: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.sm,
  },
  organizerRow: {
    flexDirection: 'row',
    marginBottom: spacing.lg,
  },
  organizerLabel: {
    fontSize: typography.fontSize.base,
  },
  organizerName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  detailsCard: {
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
  },
  detailIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.base,
  },
  detailContent: {
    flex: 1,
    justifyContent: 'center',
  },
  detailTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  detailSubtitle: {
    fontSize: typography.fontSize.sm,
    marginTop: 2,
  },
  descriptionSection: {
    borderTopWidth: 1,
    paddingTop: spacing.lg,
    marginTop: spacing.sm,
  },
  descriptionLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.sm,
  },
  descriptionText: {
    fontSize: typography.fontSize.base,
    lineHeight: 22,
  },
  currentStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  currentStatusLabel: {
    fontSize: typography.fontSize.base,
    marginRight: spacing.sm,
  },
  currentStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
  },
  statusAccepted: {
    backgroundColor: '#22c55e',
  },
  statusDeclined: {
    backgroundColor: '#ef4444',
  },
  statusMaybe: {
    backgroundColor: '#f59e0b',
  },
  currentStatusText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    marginLeft: spacing.xs,
  },
  responseSection: {
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
  },
  responseSectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  responseButtons: {
    flexDirection: 'row',
    gap: spacing.base,
  },
  responseButton: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
  },
  acceptButton: {
    borderColor: '#22c55e',
    backgroundColor: '#f0fdf4',
  },
  maybeButton: {
    borderColor: '#f59e0b',
    backgroundColor: '#fffbeb',
  },
  declineButton: {
    borderColor: '#ef4444',
    backgroundColor: '#fef2f2',
  },
  responseButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    marginTop: spacing.xs,
  },
  acceptButtonText: {
    color: '#22c55e',
  },
  maybeButtonText: {
    color: '#f59e0b',
  },
  declineButtonText: {
    color: '#ef4444',
  },
  respondingOverlay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
    padding: spacing.base,
  },
  respondingText: {
    fontSize: typography.fontSize.sm,
    marginLeft: spacing.sm,
  },
  errorText: {
    fontSize: typography.fontSize.lg,
    textAlign: 'center',
    marginTop: 100,
  },
  closeButtonError: {
    alignSelf: 'center',
    marginTop: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.base,
    borderRadius: borderRadius.base,
  },
  closeButtonErrorText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
});
