import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert, LayoutChangeEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { meetingService } from '../services/meetingService';
import { useAuth } from '../contexts/AuthContext';
import { colors, typography, spacing, borderRadius, shadows } from '../theme/designSystem';

interface Props {
  onCreateMeeting?: () => void;
  onOpenMeeting?: (meeting: any) => void;
}

const PAST_DAYS = 30; // Number of past days to show
const FUTURE_DAYS = 60; // Number of future days to show

export default function CalendarScreen({ onCreateMeeting, onOpenMeeting }: Props) {
  const { user } = useAuth();
  const [meetings, setMeetings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollViewRef = useRef<ScrollView>(null);
  const [todayPosition, setTodayPosition] = useState(0);
  const [hasScrolledToToday, setHasScrolledToToday] = useState(false);
  const datePositions = useRef<{ [key: string]: number }>({});

  useEffect(() => {
    loadMeetings();
  }, []);

  const loadMeetings = async () => {
    if (!user) {
      console.log('📅 CalendarScreen: No user, skipping meeting load');
      return;
    }

    try {
      console.log('📅 CalendarScreen: Loading meetings for user:', user.id);
      setLoading(true);
      const data = await meetingService.getUserMeetings(user.id);
      console.log('📅 CalendarScreen: Received meeting data:', data?.length || 0, 'meetings');
      setMeetings(data || []);
    } catch (error: any) {
      console.error('❌ CalendarScreen: Error loading meetings:', error);
      Alert.alert('Error', 'Failed to load meetings');
    } finally {
      setLoading(false);
    }
  };

  // Generate dates list including past and future days
  const generateDatesList = () => {
    const dates: { date: Date; isToday: boolean; index: number }[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Start from PAST_DAYS ago
    for (let i = -PAST_DAYS; i < FUTURE_DAYS; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      dates.push({
        date,
        isToday: i === 0,
        index: i + PAST_DAYS, // Index in the list (0-based)
      });
    }

    return dates;
  };

  // Get the index of today in the dates list
  const getTodayIndex = () => PAST_DAYS;

  const getMeetingsForDate = (date: Date) => {
    return meetings.filter((item: any) => {
      const meetingDate = new Date(item.meeting.scheduled_time);
      return (
        meetingDate.getDate() === date.getDate() &&
        meetingDate.getMonth() === date.getMonth() &&
        meetingDate.getFullYear() === date.getFullYear()
      );
    });
  };

  const checkIsToday = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    return checkDate.getTime() === today.getTime();
  };

  // Scroll to today when content is ready
  const handleDateLayout = (index: number, y: number, isTodayDate: boolean) => {
    if (isTodayDate && !hasScrolledToToday) {
      setTodayPosition(y);
      // Scroll to today after a brief delay to ensure layout is complete
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: y, animated: false });
        setHasScrolledToToday(true);
      }, 100);
    }
  };

  const formatDateHeader = (date: Date) => {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    return {
      dayName: dayNames[date.getDay()],
      dayNumber: date.getDate(),
      monthName: monthNames[date.getMonth()],
    };
  };

  const formatMeetingTime = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const isToday = date.toDateString() === today.toDateString();
    const isTomorrow = date.toDateString() === tomorrow.toDateString();

    if (isToday) {
      return `Today, ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
    } else if (isTomorrow) {
      return `Tomorrow, ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      });
    }
  };

  const getMeetingIcon = (meetingType: string) => {
    switch (meetingType) {
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

  const getMeetingTypeLabel = (meetingType: string) => {
    switch (meetingType) {
      case 'video':
        return 'Video Call';
      case 'in_person':
        return 'In Person';
      case 'hybrid':
        return 'Hybrid';
      default:
        return meetingType;
    }
  };

  const datesList = generateDatesList();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Calendar</Text>
        <TouchableOpacity
          style={styles.createButton}
          onPress={onCreateMeeting}
        >
          <Ionicons name="add-circle" size={32} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={loadMeetings}
            tintColor={colors.primary}
          />
        }
      >
        {datesList.map((dateItem, index) => {
          const { date, isToday: isTodayDate } = dateItem;
          const dateMeetings = getMeetingsForDate(date);
          const dateHeader = formatDateHeader(date);
          const isPastDate = date < new Date(new Date().setHours(0, 0, 0, 0));

          return (
            <View
              key={date.toISOString()}
              style={[styles.dateSection, isPastDate && styles.pastDateSection]}
              onLayout={(event) => {
                if (isTodayDate) {
                  handleDateLayout(index, event.nativeEvent.layout.y, true);
                }
              }}
            >
              {/* Date Header */}
              <View style={styles.dateHeaderContainer}>
                <View style={styles.dateLeftSection}>
                  <Text style={[styles.dayName, isTodayDate && styles.todayDayName]}>
                    {dateHeader.dayName.substring(0, 3).toUpperCase()}
                  </Text>
                  <View style={[styles.dayNumberContainer, isTodayDate && styles.todayDayNumberContainer]}>
                    <Text style={[styles.dayNumber, isTodayDate && styles.todayDayNumber]}>
                      {dateHeader.dayNumber}
                    </Text>
                  </View>
                </View>

                <View style={styles.dateRightSection}>
                  {dateMeetings.length === 0 ? (
                    <View style={styles.emptyDateLine} />
                  ) : (
                    <View style={styles.meetingsContainer}>
                      {dateMeetings.map((item: any) => {
                        const meeting = item.meeting;
                        const isUpcoming = new Date(meeting.scheduled_time) >= new Date();
                        const meetingTime = new Date(meeting.scheduled_time);
                        const timeString = meetingTime.toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit'
                        });

                        return (
                          <TouchableOpacity
                            key={meeting.id}
                            style={styles.meetingItem}
                            onPress={() => onOpenMeeting && onOpenMeeting(meeting)}
                            activeOpacity={0.7}
                          >
                            <View style={[styles.meetingColorBar, { backgroundColor: meeting.meeting_type === 'in_person' ? '#10b981' : meeting.meeting_type === 'hybrid' ? '#f59e0b' : colors.primary }]} />
                            <View style={styles.meetingContent}>
                              <View style={styles.meetingTopRow}>
                                <Ionicons
                                  name={getMeetingIcon(meeting.meeting_type) as any}
                                  size={16}
                                  color={meeting.meeting_type === 'in_person' ? '#10b981' : meeting.meeting_type === 'hybrid' ? '#f59e0b' : colors.primary}
                                  style={{ marginRight: 6 }}
                                />
                                <Text style={styles.meetingTitle} numberOfLines={1}>
                                  {meeting.title}
                                </Text>
                                {meeting.is_kickoff && (
                                  <View style={styles.kickoffBadge}>
                                    <Text style={styles.kickoffBadgeText}>KICKOFF</Text>
                                  </View>
                                )}
                              </View>
                              <View style={styles.meetingBottomRow}>
                                <Text style={styles.meetingTimeText}>{timeString}</Text>
                                <Text style={styles.meetingDivider}>•</Text>
                                <Text style={styles.meetingTypeText}>{getMeetingTypeLabel(meeting.meeting_type)}</Text>
                                {meeting.location && (
                                  <>
                                    <Text style={styles.meetingDivider}>•</Text>
                                    <Text style={styles.meetingLocationText} numberOfLines={1}>{meeting.location}</Text>
                                  </>
                                )}
                              </View>
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
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
  headerTitle: {
    fontSize: typography.fontSize['3xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
  },
  createButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  dateSection: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  pastDateSection: {
    opacity: 0.7,
  },
  dateHeaderContainer: {
    flexDirection: 'row',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  dateLeftSection: {
    width: 60,
    alignItems: 'center',
    paddingTop: spacing.xs,
  },
  dayName: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    letterSpacing: 0.5,
  },
  todayDayName: {
    color: colors.primary,
  },
  dayNumberContainer: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  todayDayNumberContainer: {
    backgroundColor: colors.primary,
  },
  dayNumber: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.medium,
    color: colors.textPrimary,
  },
  todayDayNumber: {
    color: colors.white,
    fontWeight: typography.fontWeight.bold,
  },
  dateRightSection: {
    flex: 1,
    justifyContent: 'center',
  },
  emptyDateLine: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginVertical: spacing.lg,
  },
  meetingsContainer: {
    gap: spacing.sm,
  },
  meetingItem: {
    flexDirection: 'row',
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.base,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  meetingColorBar: {
    width: 4,
    backgroundColor: colors.primary,
  },
  meetingContent: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  meetingTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  meetingTitle: {
    flex: 1,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    marginRight: spacing.sm,
  },
  kickoffBadge: {
    backgroundColor: colors.warning,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  kickoffBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.white,
  },
  meetingBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  meetingTimeText: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    fontWeight: typography.fontWeight.medium,
  },
  meetingDivider: {
    fontSize: typography.fontSize.sm,
    color: colors.textTertiary,
    marginHorizontal: spacing.xs,
  },
  meetingPursuitText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  meetingTypeText: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    fontWeight: typography.fontWeight.medium,
  },
  meetingLocationText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.textTertiary,
  },
});
