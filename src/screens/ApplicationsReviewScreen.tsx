import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Image, Linking, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { applicationService } from '../services/applicationService';
import { notificationService } from '../services/notificationService';
import { supabase } from '../config/supabase';
import { useAuth } from '../contexts/AuthContext';
import UserProfileScreen from './UserProfileScreen';
import WriteReviewScreen from './WriteReviewScreen';
import { colors as legacyColors, typography, spacing } from '../theme/designSystem';
import { useTheme } from '../theme/ThemeContext';
import { getThemedStyles } from '../theme/themedStyles';
import GrainTexture from '../components/ui/GrainTexture';

interface Props {
  pursuitId: string;
  pursuit?: any;
  onBack: () => void;
  onScheduleInterview?: (applicationId: string, applicantId: string, applicantName: string) => void;
}

export default function ApplicationsReviewScreen({ pursuitId, pursuit, onBack, onScheduleInterview }: Props) {
  const { user } = useAuth();
  const { theme, isNewTheme } = useTheme();
  const colors = theme.colors;
  const themedStyles = getThemedStyles(colors, isNewTheme);

  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedReviewedId, setExpandedReviewedId] = useState<string | null>(null);
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // Write review state
  const [showWriteReview, setShowWriteReview] = useState(false);
  const [revieweeInfo, setRevieweeInfo] = useState<{
    revieweeId: string;
    revieweeName: string;
    revieweePhoto?: string;
  } | null>(null);

  const handleViewProfile = (userId: string) => {
    setSelectedUserId(userId);
    setShowUserProfile(true);
  };

  const handleWriteReview = (revieweeId: string, revieweeName: string, revieweePhoto?: string) => {
    setRevieweeInfo({ revieweeId, revieweeName, revieweePhoto });
    setShowWriteReview(true);
  };

  useEffect(() => {
    loadApplications();
  }, []);

  const loadApplications = async () => {
    try {
      const data = await applicationService.getApplicationsForPursuit(pursuitId);
      setApplications(data);
    } catch (error) {
      console.error('Error loading applications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (applicationId: string, applicantEmail: string) => {
    Alert.alert(
      'Accept Application',
      `Accept ${applicantEmail}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept',
          onPress: async () => {
            try {
              await applicationService.acceptApplication(applicationId);
              Alert.alert('✅ Accepted!', 'Application accepted');
              loadApplications();
            } catch (error: any) {
              Alert.alert('Error', error.message);
            }
          },
        },
      ]
    );
  };

  const handleReject = async (applicationId: string) => {
    Alert.alert(
      'Decline Application',
      'Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: async () => {
            try {
              await applicationService.rejectApplication(applicationId);
              Alert.alert('Application declined');
              loadApplications();
            } catch (error: any) {
              Alert.alert('Error', error.message);
            }
          },
        },
      ]
    );
  };

  const handleScheduleInterview = async (app: any) => {
    const applicantName = app.applicant?.name || app.applicant?.email?.split('@')[0] || 'the applicant';

    Alert.alert(
      'Schedule Interview',
      `Request ${applicantName} to propose interview times?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send Request',
          onPress: async () => {
            try {
              console.log('📋 Schedule Interview - App data:', {
                appId: app.id,
                applicantId: app.applicant_id,
                pursuitId,
                pursuitTitle: pursuit?.title,
              });

              // Update application status to 'interview_pending'
              const { error } = await supabase
                .from('pursuit_applications')
                .update({ status: 'interview_pending' })
                .eq('id', app.id);

              if (error) throw error;
              console.log('✅ Application status updated to interview_pending');

              // Get creator's profile for notification
              const { data: creatorProfile } = await supabase
                .from('profiles')
                .select('name, email')
                .eq('id', user!.id)
                .single();

              const creatorName = creatorProfile?.name || creatorProfile?.email?.split('@')[0] || 'The creator';
              console.log('📤 Sending notification to applicant:', app.applicant_id, 'from creator:', creatorName);

              // Send notification to applicant to propose interview times
              await notificationService.notifyInterviewSchedulingRequested(
                app.applicant_id,
                app.id,
                pursuitId,
                pursuit?.title || 'Pursuit',
                creatorName
              );

              console.log('✅ Notification sent successfully');
              Alert.alert('Request Sent!', `${applicantName} will be notified to propose interview times.`);
              loadApplications();
            } catch (error: any) {
              console.error('Error scheduling interview:', error);
              Alert.alert('Error', error.message || 'Failed to send interview request');
            }
          },
        },
      ]
    );
  };

  // Include applications with interview in progress in the pending section
  const pendingApps = applications.filter(a =>
    a.status === 'pending' ||
    a.status === 'interview_pending' ||
    a.status === 'interview_times_submitted' ||
    a.status === 'interview_scheduled'
  );
  const reviewedApps = applications.filter(a => a.status === 'accepted' || a.status === 'declined');

  // Helper to get interview button state
  const getInterviewButtonState = (status: string) => {
    switch (status) {
      case 'interview_pending':
        return { text: '✓ Interview Time Proposal Sent', disabled: true, style: 'sent' };
      case 'interview_times_submitted':
        return { text: '📅 Review Proposed Times', disabled: false, style: 'review' };
      case 'interview_scheduled':
        return { text: '✓ Interview Scheduled', disabled: true, style: 'scheduled' };
      default:
        return { text: '🎤 Schedule Interview', disabled: false, style: 'default' };
    }
  };

  // Dynamic accent color for purple elements
  const accentPurple = isNewTheme ? colors.primary : '#8b5cf6';
  const accentPurpleLight = isNewTheme ? colors.primaryLight : '#f5f3ff';
  const accentPurpleBorder = isNewTheme ? colors.primary : '#ddd6fe';

  // Show write review screen
  if (showWriteReview && revieweeInfo) {
    return (
      <WriteReviewScreen
        route={{ params: revieweeInfo }}
        navigation={{
          goBack: () => {
            setShowWriteReview(false);
            setRevieweeInfo(null);
          },
        }}
      />
    );
  }

  // Show user profile screen
  if (showUserProfile && selectedUserId) {
    const navigation = {
      navigate: () => {},
      goBack: () => {
        setShowUserProfile(false);
        setSelectedUserId(null);
      },
      replace: () => {
        setShowUserProfile(false);
        setSelectedUserId(null);
      },
    };

    return (
      <UserProfileScreen
        route={{ params: { userId: selectedUserId } }}
        navigation={navigation}
        onWriteReview={handleWriteReview}
      />
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isNewTheme ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      {isNewTheme && <GrainTexture opacity={0.06} />}

      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={[styles.backText, { color: isNewTheme ? colors.accentGreen : '#0ea5e9' }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: isNewTheme ? colors.accentGreen : colors.textPrimary, fontFamily: isNewTheme ? 'NothingYouCouldDo_400Regular' : undefined }]}>Applications</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>{pendingApps.length} pending</Text>
      </View>

      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          {applications.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>📭</Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>No applications yet</Text>
            </View>
          ) : (
            <>
              {pendingApps.length > 0 && (
                <>
                  <Text style={[styles.sectionTitle, { color: colors.textPrimary, fontFamily: isNewTheme ? 'Aboreto_400Regular' : undefined }]}>Pending ({pendingApps.length})</Text>
                  {pendingApps.map((app) => (
                    <View key={app.id} style={[styles.appCard, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: isNewTheme ? 1 : 0 }]}>
                      <TouchableOpacity
                        style={styles.appHeader}
                        onPress={() => app.applicant_id && handleViewProfile(app.applicant_id)}
                      >
                        {app.applicant?.profile_picture ? (
                          <Image source={{ uri: app.applicant.profile_picture }} style={styles.avatarImage} />
                        ) : (
                          <View style={[styles.avatar, { backgroundColor: isNewTheme ? colors.accentGreen : '#0ea5e9' }]}>
                            <Text style={[styles.avatarText, { color: isNewTheme ? colors.background : '#fff' }]}>
                              {app.applicant?.name?.charAt(0).toUpperCase() || '👤'}
                            </Text>
                          </View>
                        )}
                        <View style={styles.appInfo}>
                          <Text style={[styles.appName, { color: colors.textPrimary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>{app.applicant?.name || 'Applicant'}</Text>
                          <Text style={[styles.appDate, { color: colors.textTertiary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>
                            Applied {new Date(app.created_at).toLocaleDateString()}
                          </Text>
                          {app.status === 'interview_pending' && (
                            <View style={[styles.interviewStatusBadge, { backgroundColor: isNewTheme ? colors.primaryLight : '#f3e8ff' }]}>
                              <Text style={[styles.interviewStatusText, { color: colors.textSecondary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>⏳ Awaiting time proposals</Text>
                            </View>
                          )}
                          {app.status === 'interview_times_submitted' && (
                            <View style={[styles.interviewStatusBadge, styles.interviewStatusReview, { backgroundColor: isNewTheme ? colors.warningLight : '#fef3c7' }]}>
                              <Text style={[styles.interviewStatusText, { color: colors.textSecondary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>📅 Times proposed - review needed</Text>
                            </View>
                          )}
                          {app.status === 'interview_scheduled' && (
                            <View style={[styles.interviewStatusBadge, styles.interviewStatusScheduled, { backgroundColor: isNewTheme ? colors.successLight : '#d1fae5' }]}>
                              <Text style={[styles.interviewStatusText, { color: colors.textSecondary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>✓ Interview scheduled</Text>
                            </View>
                          )}
                          <Text style={[styles.viewProfileLink, { color: isNewTheme ? colors.accentGreen : '#0ea5e9', fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>View profile →</Text>
                        </View>
                      </TouchableOpacity>

                      <View style={styles.answersSection}>
                        {app.answers.map((answer: any, index: number) => (
                          <View key={index} style={styles.answerBlock}>
                            <Text style={[styles.answerQuestion, { color: colors.textPrimary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>{answer.question}</Text>
                            <Text style={[styles.answerText, { color: colors.textSecondary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>{answer.answer}</Text>
                          </View>
                        ))}
                      </View>

                      {/* Resume Attachment */}
                      {app.resume_url && (
                        <TouchableOpacity
                          style={[styles.resumeAttachment, { backgroundColor: accentPurpleLight, borderColor: accentPurpleBorder }]}
                          onPress={() => Linking.openURL(app.resume_url)}
                        >
                          <View style={[styles.resumeIconContainer, { backgroundColor: isNewTheme ? colors.surfaceAlt : '#ede9fe' }]}>
                            <Ionicons name="document-text" size={20} color={accentPurple} />
                          </View>
                          <View style={styles.resumeInfo}>
                            <Text style={[styles.resumeLabel, { color: accentPurple, fontFamily: isNewTheme ? 'Aboreto_400Regular' : undefined }]}>📎 Resume Attached</Text>
                            <Text style={[styles.resumeFilename, { color: colors.textSecondary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]} numberOfLines={1}>
                              {app.resume_filename || 'View Resume'}
                            </Text>
                          </View>
                          <Ionicons name="open-outline" size={18} color={accentPurple} />
                        </TouchableOpacity>
                      )}

                      <View style={styles.actionButtons}>
                        {pursuit?.requires_interview && (() => {
                          const buttonState = getInterviewButtonState(app.status);
                          return (
                            <TouchableOpacity
                              style={[
                                styles.interviewButton,
                                { backgroundColor: accentPurple },
                                buttonState.style === 'sent' && [styles.interviewButtonSent, { backgroundColor: colors.disabled }],
                                buttonState.style === 'review' && [styles.interviewButtonReview, { backgroundColor: colors.warning }],
                                buttonState.style === 'scheduled' && [styles.interviewButtonScheduled, { backgroundColor: colors.success }],
                              ]}
                              onPress={() => {
                                if (buttonState.style === 'review' && onScheduleInterview) {
                                  // Navigate to review proposed times
                                  onScheduleInterview(app.id, app.applicant_id, app.applicant?.name || 'Applicant');
                                } else if (!buttonState.disabled) {
                                  handleScheduleInterview(app);
                                }
                              }}
                              disabled={buttonState.disabled}
                            >
                              <Text style={[
                                styles.interviewButtonText,
                                { color: isNewTheme ? colors.background : '#fff', fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined },
                                buttonState.disabled && styles.interviewButtonTextDisabled,
                              ]}>
                                {buttonState.text}
                              </Text>
                            </TouchableOpacity>
                          );
                        })()}
                        <TouchableOpacity
                          style={[styles.acceptButton, { backgroundColor: colors.success }]}
                          onPress={() => handleAccept(app.id, app.applicant?.name || 'this applicant')}
                        >
                          <Text style={[styles.acceptButtonText, { color: isNewTheme ? colors.background : '#fff', fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>✓ Accept</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.rejectButton, { backgroundColor: colors.error }]}
                          onPress={() => handleReject(app.id)}
                        >
                          <Text style={[styles.rejectButtonText, { color: isNewTheme ? colors.background : '#fff', fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>✕ Decline</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </>
              )}

              {reviewedApps.length > 0 && (
                <>
                  <Text style={[styles.sectionTitle, { color: colors.textPrimary, fontFamily: isNewTheme ? 'Aboreto_400Regular' : undefined }]}>Reviewed ({reviewedApps.length})</Text>
                  {reviewedApps.map((app) => (
                    <View key={app.id} style={[styles.appCard, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: isNewTheme ? 1 : 0 }]}>
                      <TouchableOpacity
                        style={styles.appHeader}
                        onPress={() => app.applicant_id && handleViewProfile(app.applicant_id)}
                      >
                        {app.applicant?.profile_picture ? (
                          <Image source={{ uri: app.applicant.profile_picture }} style={[styles.avatarImage, app.status === 'accepted' ? { borderWidth: 3, borderColor: colors.success } : { borderWidth: 3, borderColor: colors.error }]} />
                        ) : (
                          <View style={[
                            styles.avatar,
                            { backgroundColor: app.status === 'accepted' ? colors.success : colors.error }
                          ]}>
                            <Text style={[styles.avatarText, { color: isNewTheme ? colors.background : '#fff' }]}>
                              {app.applicant?.name?.charAt(0).toUpperCase() || '👤'}
                            </Text>
                          </View>
                        )}
                        <View style={styles.appInfo}>
                          <Text style={[styles.appName, { color: colors.textPrimary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>{app.applicant?.name || 'Applicant'}</Text>
                          <View style={[
                            styles.statusBadge,
                            { backgroundColor: app.status === 'accepted' ? colors.successLight : colors.errorLight }
                          ]}>
                            <Text style={[styles.statusText, { color: colors.textPrimary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>
                              {app.status === 'accepted' ? '✓ Accepted' : '✕ Declined'}
                            </Text>
                          </View>
                          <Text style={[styles.viewProfileLink, { color: isNewTheme ? colors.accentGreen : '#0ea5e9', fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>View profile →</Text>
                        </View>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.expandButton, { borderTopColor: colors.border }]}
                        onPress={() => setExpandedReviewedId(expandedReviewedId === app.id ? null : app.id)}
                      >
                        <Text style={[styles.expandIcon, { color: isNewTheme ? colors.accentGreen : '#0ea5e9', fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>
                          {expandedReviewedId === app.id ? '▲ Hide answers' : '▼ Show answers'}
                        </Text>
                      </TouchableOpacity>

                      {expandedReviewedId === app.id && (
                        <View style={styles.answersSection}>
                          <Text style={[styles.viewAnswersLabel, { color: isNewTheme ? colors.accentGreen : '#0ea5e9', borderTopColor: colors.border, fontFamily: isNewTheme ? 'Aboreto_400Regular' : undefined }]}>Application Answers</Text>
                          {app.answers.map((answer: any, index: number) => (
                            <View key={index} style={styles.answerBlock}>
                              <Text style={[styles.answerQuestion, { color: colors.textPrimary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>{answer.question}</Text>
                              <Text style={[styles.answerText, { color: colors.textSecondary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>{answer.answer}</Text>
                            </View>
                          ))}
                          {/* Resume Attachment for reviewed apps */}
                          {app.resume_url && (
                            <TouchableOpacity
                              style={[styles.resumeAttachment, { backgroundColor: accentPurpleLight, borderColor: accentPurpleBorder }]}
                              onPress={() => Linking.openURL(app.resume_url)}
                            >
                              <View style={[styles.resumeIconContainer, { backgroundColor: isNewTheme ? colors.surfaceAlt : '#ede9fe' }]}>
                                <Ionicons name="document-text" size={20} color={accentPurple} />
                              </View>
                              <View style={styles.resumeInfo}>
                                <Text style={[styles.resumeLabel, { color: accentPurple, fontFamily: isNewTheme ? 'Aboreto_400Regular' : undefined }]}>📎 Resume Attached</Text>
                                <Text style={[styles.resumeFilename, { color: colors.textSecondary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]} numberOfLines={1}>
                                  {app.resume_filename || 'View Resume'}
                                </Text>
                              </View>
                              <Ionicons name="open-outline" size={18} color={accentPurple} />
                            </TouchableOpacity>
                          )}
                          <Text style={[styles.appDateReviewed, { color: colors.textTertiary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>
                            Applied {new Date(app.created_at).toLocaleDateString()}
                          </Text>
                        </View>
                      )}
                    </View>
                  ))}
                </>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
  },
  backButton: { marginBottom: 10 },
  backText: { fontSize: 16, fontWeight: '600' },
  title: { fontSize: 24, fontWeight: 'bold' },
  subtitle: { fontSize: 14, marginTop: 4 },
  scrollView: { flex: 1 },
  content: { padding: 20, paddingBottom: 100 },
  empty: { alignItems: 'center', paddingVertical: 80 },
  emptyEmoji: { fontSize: 64, marginBottom: 20 },
  emptyText: { fontSize: 18, fontWeight: '600' },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16, marginTop: 8 },
  appCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  appHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: { fontSize: 24, fontWeight: 'bold' },
  avatarImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  appInfo: { flex: 1 },
  appName: { fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  appDate: { fontSize: 12 },
  viewProfileLink: { fontSize: 12, fontWeight: '600', marginTop: 4 },
  interviewStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  interviewStatusReview: {},
  interviewStatusScheduled: {},
  interviewStatusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 4,
  },
  statusText: { fontSize: 12, fontWeight: 'bold' },
  answersSection: { marginBottom: 16 },
  answerBlock: { marginBottom: 12 },
  answerQuestion: { fontSize: 13, fontWeight: '600', marginBottom: 4 },
  answerText: { fontSize: 14, lineHeight: 20 },
  // Resume attachment styles
  resumeAttachment: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
  },
  resumeIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  resumeInfo: {
    flex: 1,
  },
  resumeLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  resumeFilename: {
    fontSize: 12,
  },
  actionButtons: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  interviewButton: {
    flex: 1,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    minWidth: '100%',
    marginBottom: 8,
  },
  interviewButtonSent: {},
  interviewButtonReview: {},
  interviewButtonScheduled: {},
  interviewButtonText: { fontSize: 15, fontWeight: 'bold' },
  interviewButtonTextDisabled: { opacity: 0.9 },
  acceptButton: {
    flex: 1,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  acceptButtonText: { fontSize: 15, fontWeight: 'bold' },
  rejectButton: {
    flex: 1,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  rejectButtonText: { fontSize: 15, fontWeight: 'bold' },
  expandButton: {
    paddingVertical: 8,
    alignItems: 'center',
    borderTopWidth: 1,
    marginTop: 8,
  },
  expandIcon: { fontSize: 12, fontWeight: '600' },
  viewAnswersLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 12,
    marginTop: 8,
    borderTopWidth: 1,
    paddingTop: 16,
  },
  appDateReviewed: {
    fontSize: 12,
    marginTop: 12,
    fontStyle: 'italic',
  },
});
