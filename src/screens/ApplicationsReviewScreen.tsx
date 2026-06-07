import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Image, Linking, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { applicationService } from '../services/applicationService';
import { notificationService } from '../services/notificationService';
import { supabase } from '../config/supabase';
import { useAuth } from '../contexts/AuthContext';
import UserProfileScreen from './UserProfileScreen';
import { colors as legacyColors, typography, spacing } from '../theme/designSystem';
import { useTheme } from '../theme/ThemeContext';
import { getThemedStyles } from '../theme/themedStyles';
import GrainTexture from '../components/ui/GrainTexture';
import { AppAlert } from '../components/ui/AppAlert';

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

  const handleViewProfile = (userId: string) => {
    setSelectedUserId(userId);
    setShowUserProfile(true);
  };

  const openResume = async (resumePath: string | null | undefined) => {
    if (!resumePath) return;
    // Legacy rows may still hold a full public URL — open directly.
    if (resumePath.startsWith('http://') || resumePath.startsWith('https://')) {
      Linking.openURL(resumePath);
      return;
    }
    // New rows hold an object path; mint a short-lived signed URL.
    const { data, error } = await supabase.storage
      .from('resumes')
      .createSignedUrl(resumePath, 60 * 60);
    if (error || !data?.signedUrl) {
      AppAlert.alert('Could not open resume', error?.message || 'Unknown error');
      return;
    }
    Linking.openURL(data.signedUrl);
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
    AppAlert.alert(
      'Accept Application',
      `Accept ${applicantEmail}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept',
          onPress: async () => {
            try {
              await applicationService.acceptApplication(applicationId);
              AppAlert.alert('✅ Accepted!', 'Application accepted');
              loadApplications();
            } catch (error: any) {
              AppAlert.alert('Error', error.message);
            }
          },
        },
      ]
    );
  };

  const handleReject = async (applicationId: string) => {
    AppAlert.alert(
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
              AppAlert.alert('Application declined');
              loadApplications();
            } catch (error: any) {
              AppAlert.alert('Error', error.message);
            }
          },
        },
      ]
    );
  };

  const handleScheduleInterview = async (app: any) => {
    const applicantName = app.applicant?.name || app.applicant?.email?.split('@')[0] || 'the applicant';

    AppAlert.alert(
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
              AppAlert.alert('Request Sent!', `${applicantName} will be notified to propose interview times.`);
              loadApplications();
            } catch (error: any) {
              console.error('Error scheduling interview:', error);
              AppAlert.alert('Error', error.message || 'Failed to send interview request');
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

  // Dark = lime accent (kill the indigo); light = Carolina blue (discreet primary).
  const accentPurple = isNewTheme ? colors.accentGreen : '#2E6A95';
  const accentPurpleLight = isNewTheme ? 'rgba(200, 255, 107, 0.10)' : 'rgba(75, 156, 211, 0.10)';
  const accentPurpleBorder = isNewTheme ? 'rgba(200, 255, 107, 0.25)' : 'rgba(75, 156, 211, 0.30)';
  // Link/accent color for light mode (replaces the old sky-blue #0ea5e9).
  const linkColor = isNewTheme ? colors.accentGreen : '#2E6A95';

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
      />
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isNewTheme ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      {isNewTheme && <GrainTexture opacity={0.06} />}

      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onBack} style={styles.backButton} activeOpacity={0.6} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={[styles.backText, { color: linkColor, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: isNewTheme ? colors.accentGreen : colors.textPrimary, fontFamily: isNewTheme ? 'Sora_700Bold' : 'PlayfairDisplay_700Bold' }]}>Applications</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>{pendingApps.length} pending</Text>
      </View>

      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          {applications.length === 0 ? (
            <View style={styles.empty}>
              {isNewTheme ? (
                <Ionicons name="mail-outline" size={64} color={colors.textTertiary} style={{ marginBottom: 20 }} />
              ) : (
                <Text style={styles.emptyEmoji}>📭</Text>
              )}
              <Text style={[styles.emptyText, { color: colors.textSecondary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>No applications yet</Text>
            </View>
          ) : (
            <>
              {pendingApps.length > 0 && (
                <>
                  <Text style={[styles.sectionTitle, { color: colors.textPrimary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>Pending ({pendingApps.length})</Text>
                  {pendingApps.map((app) => (
                    <View key={app.id} style={[styles.appCard, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}>
                      <TouchableOpacity
                        style={styles.appHeader}
                        onPress={() => app.applicant_id && handleViewProfile(app.applicant_id)}
                      >
                        {app.applicant?.profile_picture ? (
                          <Image source={{ uri: app.applicant.profile_picture }} style={styles.avatarImage} />
                        ) : (
                          <View style={[styles.avatar, { backgroundColor: isNewTheme ? colors.accentGreen : '#4B9CD3' }]}>
                            <Text style={[styles.avatarText, { color: isNewTheme ? colors.background : '#fff' }]}>
                              {app.applicant?.name?.charAt(0).toUpperCase() || '👤'}
                            </Text>
                          </View>
                        )}
                        <View style={styles.appInfo}>
                          <Text style={[styles.appName, { color: colors.textPrimary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'PlayfairDisplay_700Bold' }]}>{app.applicant?.name || 'Applicant'}</Text>
                          <Text style={[styles.appDate, { color: colors.textTertiary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>
                            Applied {new Date(app.created_at).toLocaleDateString()}
                          </Text>
                          {app.status === 'interview_pending' && (
                            <View style={[styles.interviewStatusBadge, { backgroundColor: isNewTheme ? 'rgba(255,255,255,0.06)' : 'rgba(75, 156, 211, 0.10)' }]}>
                              <Text style={[styles.interviewStatusText, { color: colors.textSecondary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>⏳ Awaiting time proposals</Text>
                            </View>
                          )}
                          {app.status === 'interview_times_submitted' && (
                            <View style={[styles.interviewStatusBadge, styles.interviewStatusReview, { backgroundColor: isNewTheme ? colors.warningLight : '#fef3c7' }]}>
                              <Text style={[styles.interviewStatusText, { color: colors.textSecondary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>📅 Times proposed - review needed</Text>
                            </View>
                          )}
                          {app.status === 'interview_scheduled' && (
                            <View style={[styles.interviewStatusBadge, styles.interviewStatusScheduled, { backgroundColor: isNewTheme ? colors.successLight : '#d1fae5' }]}>
                              <Text style={[styles.interviewStatusText, { color: colors.textSecondary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>✓ Interview scheduled</Text>
                            </View>
                          )}
                          <Text style={[styles.viewProfileLink, { color: linkColor, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>View profile →</Text>
                        </View>
                      </TouchableOpacity>

                      {Array.isArray(app.targeted_roles) && app.targeted_roles.length > 0 && (
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                          <Text style={{ fontSize: 13, color: colors.textSecondary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold', marginRight: 6, alignSelf: 'center' }}>Targeting:</Text>
                          {app.targeted_roles.map((role: string) => (
                            <View key={role} style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: isNewTheme ? colors.surfaceAlt : 'rgba(75, 156, 211, 0.10)' }}>
                              <Text style={{ fontSize: 12, fontWeight: '600', color: linkColor, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }}>{role}</Text>
                            </View>
                          ))}
                        </View>
                      )}

                      <View style={styles.answersSection}>
                        {app.answers.map((answer: any, index: number) => (
                          <View key={index} style={styles.answerBlock}>
                            <Text style={[styles.answerQuestion, { color: colors.textPrimary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>{answer.question}</Text>
                            <Text style={[styles.answerText, { color: colors.textSecondary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>{answer.answer}</Text>
                          </View>
                        ))}
                      </View>

                      {/* Resume Attachment */}
                      {app.resume_url && (
                        <TouchableOpacity
                          style={[styles.resumeAttachment, { backgroundColor: accentPurpleLight, borderColor: accentPurpleBorder }]}
                          onPress={() => openResume(app.resume_url)}
                        >
                          <View style={[styles.resumeIconContainer, { backgroundColor: isNewTheme ? colors.surfaceAlt : 'rgba(75, 156, 211, 0.10)' }]}>
                            <Ionicons name="document-text" size={20} color={accentPurple} />
                          </View>
                          <View style={styles.resumeInfo}>
                            <Text style={[styles.resumeLabel, { color: accentPurple, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>📎 Resume Attached</Text>
                            <Text style={[styles.resumeFilename, { color: colors.textSecondary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'PlayfairDisplay_700Bold' }]} numberOfLines={1}>
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
                              activeOpacity={0.85}
                            >
                              <Text style={[
                                styles.interviewButtonText,
                                { color: isNewTheme ? colors.background : '#fff', fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' },
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
                          activeOpacity={0.85}
                        >
                          <Text style={[styles.acceptButtonText, { color: isNewTheme ? colors.background : '#fff', fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>✓ Accept</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.rejectButton, { backgroundColor: colors.error }]}
                          onPress={() => handleReject(app.id)}
                          activeOpacity={0.85}
                        >
                          <Text style={[styles.rejectButtonText, { color: isNewTheme ? colors.background : '#fff', fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>✕ Decline</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </>
              )}

              {reviewedApps.length > 0 && (
                <>
                  <Text style={[styles.sectionTitle, { color: colors.textPrimary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>Reviewed ({reviewedApps.length})</Text>
                  {reviewedApps.map((app) => (
                    <View key={app.id} style={[styles.appCard, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}>
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
                          <Text style={[styles.appName, { color: colors.textPrimary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'PlayfairDisplay_700Bold' }]}>{app.applicant?.name || 'Applicant'}</Text>
                          <View style={[
                            styles.statusBadge,
                            { backgroundColor: app.status === 'accepted' ? colors.successLight : colors.errorLight }
                          ]}>
                            <Text style={[styles.statusText, { color: colors.textPrimary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>
                              {app.status === 'accepted' ? '✓ Accepted' : '✕ Declined'}
                            </Text>
                          </View>
                          <Text style={[styles.viewProfileLink, { color: linkColor, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>View profile →</Text>
                        </View>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.expandButton, { borderTopColor: colors.border }]}
                        onPress={() => setExpandedReviewedId(expandedReviewedId === app.id ? null : app.id)}
                      >
                        <Text style={[styles.expandIcon, { color: linkColor, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>
                          {expandedReviewedId === app.id ? '▲ Hide answers' : '▼ Show answers'}
                        </Text>
                      </TouchableOpacity>

                      {expandedReviewedId === app.id && (
                        <View style={styles.answersSection}>
                          <Text style={[styles.viewAnswersLabel, { color: linkColor, borderTopColor: colors.border, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>Application Answers</Text>
                          {app.answers.map((answer: any, index: number) => (
                            <View key={index} style={styles.answerBlock}>
                              <Text style={[styles.answerQuestion, { color: colors.textPrimary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>{answer.question}</Text>
                              <Text style={[styles.answerText, { color: colors.textSecondary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>{answer.answer}</Text>
                            </View>
                          ))}
                          {/* Resume Attachment for reviewed apps */}
                          {app.resume_url && (
                            <TouchableOpacity
                              style={[styles.resumeAttachment, { backgroundColor: accentPurpleLight, borderColor: accentPurpleBorder }]}
                              onPress={() => openResume(app.resume_url)}
                            >
                              <View style={[styles.resumeIconContainer, { backgroundColor: isNewTheme ? colors.surfaceAlt : 'rgba(75, 156, 211, 0.10)' }]}>
                                <Ionicons name="document-text" size={20} color={accentPurple} />
                              </View>
                              <View style={styles.resumeInfo}>
                                <Text style={[styles.resumeLabel, { color: accentPurple, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>📎 Resume Attached</Text>
                                <Text style={[styles.resumeFilename, { color: colors.textSecondary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'PlayfairDisplay_700Bold' }]} numberOfLines={1}>
                                  {app.resume_filename || 'View Resume'}
                                </Text>
                              </View>
                              <Ionicons name="open-outline" size={18} color={accentPurple} />
                            </TouchableOpacity>
                          )}
                          <Text style={[styles.appDateReviewed, { color: colors.textTertiary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>
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
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
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
    borderRadius: 999,
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
    borderRadius: 999,
    padding: 12,
    alignItems: 'center',
  },
  acceptButtonText: { fontSize: 15, fontWeight: 'bold' },
  rejectButton: {
    flex: 1,
    borderRadius: 999,
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
