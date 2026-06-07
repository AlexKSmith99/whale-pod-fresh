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
import { colors as legacyColors, typography, spacing, borderRadius, editorial } from '../theme/designSystem';
import { useTheme } from '../theme/ThemeContext';
import { getThemedStyles } from '../theme/themedStyles';
import GrainTexture from '../components/ui/GrainTexture';

// Editorial light-mode card: white surface, hairline border, soft shadow.
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
        <Text style={[styles.errorText, { color: colors.textSecondary }, !isNewTheme && { fontFamily: 'InterTight_600SemiBold', color: editorial.muted }]}>Meeting not found</Text>
        <TouchableOpacity style={[styles.closeButtonError, { backgroundColor: accentColor }, !isNewTheme && { backgroundColor: editorial.ink, borderRadius: 999 }]} onPress={onBack}>
          <Text style={[styles.closeButtonErrorText, { color: isNewTheme ? colors.background : colors.white }, !isNewTheme && { fontFamily: 'InterTight_600SemiBold' }]}>Close</Text>
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
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }, !isNewTheme && { backgroundColor: editorial.bg, borderBottomWidth: 0 }]}>
        <TouchableOpacity onPress={onBack} style={styles.closeButton} activeOpacity={isNewTheme ? 0.7 : 0.6}>
          <Ionicons name="close" size={28} color={isNewTheme ? colors.textPrimary : editorial.ink} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }, !isNewTheme && { fontFamily: 'PlayfairDisplay_700Bold', fontSize: 22, letterSpacing: -0.4 }]}>Meeting Invitation</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Pod Badge */}
        <View style={[styles.podBadge, { backgroundColor: colors.backgroundSecondary }, !isNewTheme && { backgroundColor: 'transparent', borderWidth: 1, borderColor: editorial.hairline }]}>
          <Ionicons name="people-circle" size={16} color={isNewTheme ? accentColor : editorial.carolinaDeep} />
          <Text style={[styles.podBadgeText, { color: accentColor }, !isNewTheme && { color: editorial.carolinaDeep, fontFamily: 'InterTight_600SemiBold', letterSpacing: 0.3 }]}>{meeting.pursuit?.title}</Text>
        </View>

        {/* Meeting Title */}
        <Text style={[styles.meetingTitle, { color: colors.textPrimary }, !isNewTheme && { fontFamily: 'PlayfairDisplay_700Bold', fontSize: 28, letterSpacing: -0.5 }]}>{meeting.title}</Text>

        {/* Organizer */}
        <View style={styles.organizerRow}>
          <Text style={[styles.organizerLabel, { color: colors.textSecondary }, !isNewTheme && { fontFamily: 'InterTight_600SemiBold', color: editorial.muted }]}>Organized by </Text>
          <Text style={[styles.organizerName, { color: colors.textPrimary }, !isNewTheme && { fontFamily: 'InterTight_600SemiBold' }]}>
            {meeting.creator?.name || meeting.creator?.email?.split('@')[0] || 'The organizer'}
          </Text>
        </View>

        {/* Meeting Details Card */}
        <View style={[styles.detailsCard, { backgroundColor: colors.surface, borderWidth: isNewTheme ? 1 : 0, borderColor: colors.border }, !isNewTheme && lightCard]}>
          {/* Date & Time */}
          <View style={styles.detailRow}>
            <View style={[styles.detailIcon, { backgroundColor: colors.backgroundSecondary }, !isNewTheme && { backgroundColor: 'transparent' }]}>
              <Ionicons name="calendar" size={22} color={accentColor} />
            </View>
            <View style={styles.detailContent}>
              <Text style={[styles.detailTitle, { color: colors.textPrimary }, !isNewTheme && { fontFamily: 'InterTight_600SemiBold' }]}>{date}</Text>
              <Text style={[styles.detailSubtitle, { color: colors.textSecondary }, !isNewTheme && { fontFamily: 'InterTight_600SemiBold', color: editorial.muted }]}>{time} ({meeting.duration_minutes} min)</Text>
            </View>
          </View>

          {/* Meeting Type */}
          <View style={styles.detailRow}>
            <View style={[styles.detailIcon, { backgroundColor: colors.backgroundSecondary }, !isNewTheme && { backgroundColor: 'transparent' }]}>
              <Ionicons name={getMeetingTypeIcon(meeting.meeting_type) as any} size={22} color={accentColor} />
            </View>
            <View style={styles.detailContent}>
              <Text style={[styles.detailTitle, { color: colors.textPrimary }, !isNewTheme && { fontFamily: 'InterTight_600SemiBold' }]}>{getMeetingTypeLabel(meeting.meeting_type)}</Text>
              {meeting.location && (
                <Text style={[styles.detailSubtitle, { color: colors.textSecondary }, !isNewTheme && { fontFamily: 'InterTight_600SemiBold', color: editorial.muted }]}>{meeting.location}</Text>
              )}
            </View>
          </View>

          {/* Description */}
          {meeting.description && (
            <View style={[styles.descriptionSection, { borderTopColor: colors.border }]}>
              <Text style={[styles.descriptionLabel, { color: colors.textSecondary }, !isNewTheme && { ...{ color: editorial.muted, fontFamily: 'InterTight_600SemiBold', fontSize: 10, textTransform: 'uppercase' as const, letterSpacing: 0.6 } }]}>Description</Text>
              <Text style={[styles.descriptionText, { color: colors.textPrimary }, !isNewTheme && { fontFamily: 'InterTight_600SemiBold' }]}>{meeting.description}</Text>
            </View>
          )}
        </View>

        {/* Current Status */}
        {hasResponded && (
          <View style={styles.currentStatusContainer}>
            <Text style={[styles.currentStatusLabel, { color: colors.textSecondary }, !isNewTheme && { color: editorial.muted, fontFamily: 'InterTight_600SemiBold' }]}>Your Response:</Text>
            <View style={[
              styles.currentStatusBadge,
              currentStatus === 'accepted' && styles.statusAccepted,
              currentStatus === 'declined' && styles.statusDeclined,
              currentStatus === 'maybe' && styles.statusMaybe,
              // Light editorial: ink (accepted), red (declined), gold (tentative).
              !isNewTheme && currentStatus === 'accepted' && { backgroundColor: editorial.ink },
              !isNewTheme && currentStatus === 'declined' && { backgroundColor: editorial.red },
              !isNewTheme && currentStatus === 'maybe' && { backgroundColor: editorial.gold },
            ]}>
              <Ionicons
                name={currentStatus === 'accepted' ? 'checkmark-circle' : currentStatus === 'declined' ? 'close-circle' : 'help-circle'}
                size={18}
                color={colors.white}
              />
              <Text style={[styles.currentStatusText, { color: colors.white }, !isNewTheme && { fontFamily: 'InterTight_600SemiBold' }]}>
                {currentStatus === 'accepted' ? 'Accepted' : currentStatus === 'declined' ? 'Declined' : 'Tentative'}
              </Text>
            </View>
          </View>
        )}

        {/* Response Buttons */}
        <View style={[styles.responseSection, { backgroundColor: colors.surface, borderWidth: isNewTheme ? 1 : 0, borderColor: colors.border }, !isNewTheme && lightCard]}>
          <Text style={[styles.responseSectionTitle, { color: colors.textPrimary }, !isNewTheme && { fontFamily: 'PlayfairDisplay_700Bold', letterSpacing: -0.3 }]}>
            {hasResponded ? 'Change your response' : 'Will you attend?'}
          </Text>

          <View style={styles.responseButtons}>
            <TouchableOpacity
              style={[
                styles.responseButton,
                styles.acceptButton,
                // Light: hairline-outline pill, fills ink when selected (positive confirm).
                !isNewTheme && { backgroundColor: 'transparent', borderColor: editorial.hairline, borderWidth: 1, borderRadius: 999 },
                currentStatus === 'accepted' && { backgroundColor: '#22c55e', borderColor: '#22c55e' },
                !isNewTheme && currentStatus === 'accepted' && { backgroundColor: editorial.ink, borderColor: editorial.ink },
              ]}
              onPress={() => handleResponse('accepted')}
              disabled={responding}
            >
              <Ionicons name="checkmark-circle" size={24} color={currentStatus === 'accepted' ? colors.white : (isNewTheme ? '#22c55e' : editorial.ink)} />
              <Text style={[
                styles.responseButtonText,
                styles.acceptButtonText,
                !isNewTheme && { color: editorial.ink, fontFamily: 'InterTight_600SemiBold' },
                currentStatus === 'accepted' && { color: colors.white },
              ]}>Accept</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.responseButton,
                styles.maybeButton,
                // Light: hairline-outline pill, fills gold when selected.
                !isNewTheme && { backgroundColor: 'transparent', borderColor: editorial.hairline, borderWidth: 1, borderRadius: 999 },
                currentStatus === 'maybe' && { backgroundColor: '#f59e0b', borderColor: '#f59e0b' },
                !isNewTheme && currentStatus === 'maybe' && { backgroundColor: editorial.gold, borderColor: editorial.gold },
              ]}
              onPress={() => handleResponse('maybe')}
              disabled={responding}
            >
              <Ionicons name="help-circle" size={24} color={currentStatus === 'maybe' ? colors.white : (isNewTheme ? '#f59e0b' : editorial.muted)} />
              <Text style={[
                styles.responseButtonText,
                styles.maybeButtonText,
                !isNewTheme && { color: editorial.muted, fontFamily: 'InterTight_600SemiBold' },
                currentStatus === 'maybe' && { color: colors.white },
              ]}>Tentative</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.responseButton,
                styles.declineButton,
                // Light: hairline-outline pill with red text/glyph; fills red when selected (destructive).
                !isNewTheme && { backgroundColor: 'transparent', borderColor: editorial.hairline, borderWidth: 1, borderRadius: 999 },
                currentStatus === 'declined' && { backgroundColor: '#ef4444', borderColor: '#ef4444' },
                !isNewTheme && currentStatus === 'declined' && { backgroundColor: editorial.red, borderColor: editorial.red },
              ]}
              onPress={() => handleResponse('declined')}
              disabled={responding}
            >
              <Ionicons name="close-circle" size={24} color={currentStatus === 'declined' ? colors.white : (isNewTheme ? '#ef4444' : editorial.red)} />
              <Text style={[
                styles.responseButtonText,
                styles.declineButtonText,
                !isNewTheme && { color: editorial.red, fontFamily: 'InterTight_600SemiBold' },
                currentStatus === 'declined' && { color: colors.white },
              ]}>Decline</Text>
            </TouchableOpacity>
          </View>
        </View>

        {responding && (
          <View style={styles.respondingOverlay}>
            <ActivityIndicator size="small" color={accentColor} />
            <Text style={[styles.respondingText, { color: colors.textSecondary }, !isNewTheme && { fontFamily: 'InterTight_600SemiBold', color: editorial.muted }]}>Recording your response...</Text>
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
