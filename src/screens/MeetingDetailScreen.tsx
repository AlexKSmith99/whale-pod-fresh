import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { agoraService } from '../services/agoraService';
import { colors, typography, spacing, borderRadius, shadows } from '../theme/designSystem';

interface Props {
  meeting: any;
  onClose: () => void;
  onJoinCall?: (meeting: any) => void;
}

export default function MeetingDetailScreen({ meeting, onClose, onJoinCall }: Props) {
  const { user } = useAuth();
  const [isCreator, setIsCreator] = useState(false);

  useEffect(() => {
    setIsCreator(meeting.creator_id === user?.id);
  }, [meeting, user]);

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

  const getMeetingTypeLabel = () => {
    switch (meeting.meeting_type) {
      case 'video':
        return 'Video Call';
      case 'in_person':
        return 'In Person';
      case 'hybrid':
        return 'Hybrid (Video + In Person)';
      default:
        return meeting.meeting_type;
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

    // Allow joining at any time once the meeting is scheduled
    console.log('🎥 Joining video call:', meeting.agora_channel_name);

    if (onJoinCall) {
      onJoinCall(meeting);
    }
  };

  const isUpcoming = new Date(meeting.scheduled_time) >= new Date();
  const canJoinVideo = (meeting.meeting_type === 'video' || meeting.meeting_type === 'hybrid') && meeting.agora_channel_name;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={28} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Meeting Details</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          {/* Meeting Title */}
          <View style={styles.titleSection}>
            <Text style={styles.meetingTitle}>{meeting.title}</Text>
            {meeting.is_kickoff && (
              <View style={styles.kickoffBadge}>
                <Text style={styles.kickoffBadgeText}>🚀 KICKOFF MEETING</Text>
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

          {/* Status Badge */}
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>
              {isUpcoming ? '📅 Upcoming' : '✅ Completed'}
            </Text>
          </View>

          {/* Join Video Call Button */}
          {canJoinVideo && isUpcoming && (
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
});
