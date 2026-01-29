import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { meetingService } from '../services/meetingService';
import { supabase } from '../config/supabase';
import { colors, typography, spacing, borderRadius } from '../theme/designSystem';

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
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState(false);
  const [meeting, setMeeting] = useState<MeetingDetails | null>(null);
  const [currentStatus, setCurrentStatus] = useState<string>('invited');

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
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!meeting) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Meeting not found</Text>
        <TouchableOpacity style={styles.closeButtonError} onPress={onBack}>
          <Text style={styles.closeButtonErrorText}>Close</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { date, time } = formatDateTime(meeting.scheduled_time);
  const hasResponded = currentStatus !== 'invited';

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.closeButton}>
          <Ionicons name="close" size={28} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Meeting Invitation</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Pod Badge */}
        <View style={styles.podBadge}>
          <Ionicons name="people-circle" size={16} color={colors.primary} />
          <Text style={styles.podBadgeText}>{meeting.pursuit?.title}</Text>
        </View>

        {/* Meeting Title */}
        <Text style={styles.meetingTitle}>{meeting.title}</Text>

        {/* Organizer */}
        <View style={styles.organizerRow}>
          <Text style={styles.organizerLabel}>Organized by </Text>
          <Text style={styles.organizerName}>
            {meeting.creator?.name || meeting.creator?.email?.split('@')[0] || 'The organizer'}
          </Text>
        </View>

        {/* Meeting Details Card */}
        <View style={styles.detailsCard}>
          {/* Date & Time */}
          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <Ionicons name="calendar" size={22} color={colors.primary} />
            </View>
            <View style={styles.detailContent}>
              <Text style={styles.detailTitle}>{date}</Text>
              <Text style={styles.detailSubtitle}>{time} ({meeting.duration_minutes} min)</Text>
            </View>
          </View>

          {/* Meeting Type */}
          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <Ionicons name={getMeetingTypeIcon(meeting.meeting_type) as any} size={22} color={colors.primary} />
            </View>
            <View style={styles.detailContent}>
              <Text style={styles.detailTitle}>{getMeetingTypeLabel(meeting.meeting_type)}</Text>
              {meeting.location && (
                <Text style={styles.detailSubtitle}>{meeting.location}</Text>
              )}
            </View>
          </View>

          {/* Description */}
          {meeting.description && (
            <View style={styles.descriptionSection}>
              <Text style={styles.descriptionLabel}>Description</Text>
              <Text style={styles.descriptionText}>{meeting.description}</Text>
            </View>
          )}
        </View>

        {/* Current Status */}
        {hasResponded && (
          <View style={styles.currentStatusContainer}>
            <Text style={styles.currentStatusLabel}>Your Response:</Text>
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
              <Text style={styles.currentStatusText}>
                {currentStatus === 'accepted' ? 'Accepted' : currentStatus === 'declined' ? 'Declined' : 'Tentative'}
              </Text>
            </View>
          </View>
        )}

        {/* Response Buttons */}
        <View style={styles.responseSection}>
          <Text style={styles.responseSectionTitle}>
            {hasResponded ? 'Change your response' : 'Will you attend?'}
          </Text>

          <View style={styles.responseButtons}>
            <TouchableOpacity
              style={[
                styles.responseButton,
                styles.acceptButton,
                currentStatus === 'accepted' && styles.responseButtonActive,
              ]}
              onPress={() => handleResponse('accepted')}
              disabled={responding}
            >
              <Ionicons name="checkmark-circle" size={24} color={currentStatus === 'accepted' ? colors.white : '#22c55e'} />
              <Text style={[
                styles.responseButtonText,
                styles.acceptButtonText,
                currentStatus === 'accepted' && styles.responseButtonTextActive,
              ]}>Accept</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.responseButton,
                styles.maybeButton,
                currentStatus === 'maybe' && styles.responseButtonActive,
              ]}
              onPress={() => handleResponse('maybe')}
              disabled={responding}
            >
              <Ionicons name="help-circle" size={24} color={currentStatus === 'maybe' ? colors.white : '#f59e0b'} />
              <Text style={[
                styles.responseButtonText,
                styles.maybeButtonText,
                currentStatus === 'maybe' && styles.responseButtonTextActive,
              ]}>Tentative</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.responseButton,
                styles.declineButton,
                currentStatus === 'declined' && styles.responseButtonActive,
              ]}
              onPress={() => handleResponse('declined')}
              disabled={responding}
            >
              <Ionicons name="close-circle" size={24} color={currentStatus === 'declined' ? colors.white : '#ef4444'} />
              <Text style={[
                styles.responseButtonText,
                styles.declineButtonText,
                currentStatus === 'declined' && styles.responseButtonTextActive,
              ]}>Decline</Text>
            </TouchableOpacity>
          </View>
        </View>

        {responding && (
          <View style={styles.respondingOverlay}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.respondingText}>Recording your response...</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  podBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.backgroundSecondary,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    marginBottom: spacing.base,
  },
  podBadgeText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.primary,
    marginLeft: spacing.xs,
  },
  meetingTitle: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  organizerRow: {
    flexDirection: 'row',
    marginBottom: spacing.lg,
  },
  organizerLabel: {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
  },
  organizerName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
  },
  detailsCard: {
    backgroundColor: colors.white,
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
    backgroundColor: colors.backgroundSecondary,
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
    color: colors.textPrimary,
  },
  detailSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  descriptionSection: {
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingTop: spacing.lg,
    marginTop: spacing.sm,
  },
  descriptionLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  descriptionText: {
    fontSize: typography.fontSize.base,
    color: colors.textPrimary,
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
    color: colors.textSecondary,
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
    color: colors.white,
    marginLeft: spacing.xs,
  },
  responseSection: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
  },
  responseSectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
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
  responseButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
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
  responseButtonTextActive: {
    color: colors.white,
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
    color: colors.textSecondary,
    marginLeft: spacing.sm,
  },
  errorText: {
    fontSize: typography.fontSize.lg,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 100,
  },
  closeButtonError: {
    alignSelf: 'center',
    marginTop: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.base,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.base,
  },
  closeButtonErrorText: {
    color: colors.white,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
});
