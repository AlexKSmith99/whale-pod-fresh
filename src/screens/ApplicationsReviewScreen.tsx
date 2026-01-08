import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Image, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { applicationService } from '../services/applicationService';
import { notificationService } from '../services/notificationService';
import { supabase } from '../config/supabase';
import { useAuth } from '../contexts/AuthContext';
import UserProfileScreen from './UserProfileScreen';

interface Props {
  pursuitId: string;
  pursuit?: any;
  onBack: () => void;
  onScheduleInterview?: (applicationId: string, applicantId: string, applicantName: string) => void;
}

export default function ApplicationsReviewScreen({ pursuitId, pursuit, onBack, onScheduleInterview }: Props) {
  const { user } = useAuth();
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedReviewedId, setExpandedReviewedId] = useState<string | null>(null);
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const handleViewProfile = (userId: string) => {
    setSelectedUserId(userId);
    setShowUserProfile(true);
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
    const applicantName = app.applicant?.name || 'the applicant';

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

              const creatorName = creatorProfile?.name || 'The pod creator';
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
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Applications</Text>
        <Text style={styles.subtitle}>{pendingApps.length} pending</Text>
      </View>

      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          {applications.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>📭</Text>
              <Text style={styles.emptyText}>No applications yet</Text>
            </View>
          ) : (
            <>
              {pendingApps.length > 0 && (
                <>
                  <Text style={styles.sectionTitle}>Pending ({pendingApps.length})</Text>
                  {pendingApps.map((app) => (
                    <View key={app.id} style={styles.appCard}>
                      <TouchableOpacity
                        style={styles.appHeader}
                        onPress={() => app.applicant_id && handleViewProfile(app.applicant_id)}
                      >
                        {app.applicant?.profile_picture ? (
                          <Image source={{ uri: app.applicant.profile_picture }} style={styles.avatarImage} />
                        ) : (
                          <View style={styles.avatar}>
                            <Text style={styles.avatarText}>
                              {app.applicant?.name?.charAt(0).toUpperCase() || '👤'}
                            </Text>
                          </View>
                        )}
                        <View style={styles.appInfo}>
                          <Text style={styles.appName}>{app.applicant?.name || 'Applicant'}</Text>
                          <Text style={styles.appDate}>
                            Applied {new Date(app.created_at).toLocaleDateString()}
                          </Text>
                          {app.status === 'interview_pending' && (
                            <View style={styles.interviewStatusBadge}>
                              <Text style={styles.interviewStatusText}>⏳ Awaiting time proposals</Text>
                            </View>
                          )}
                          {app.status === 'interview_times_submitted' && (
                            <View style={[styles.interviewStatusBadge, styles.interviewStatusReview]}>
                              <Text style={styles.interviewStatusText}>📅 Times proposed - review needed</Text>
                            </View>
                          )}
                          {app.status === 'interview_scheduled' && (
                            <View style={[styles.interviewStatusBadge, styles.interviewStatusScheduled]}>
                              <Text style={styles.interviewStatusText}>✓ Interview scheduled</Text>
                            </View>
                          )}
                          <Text style={styles.viewProfileLink}>View profile →</Text>
                        </View>
                      </TouchableOpacity>

                      <View style={styles.answersSection}>
                        {app.answers.map((answer: any, index: number) => (
                          <View key={index} style={styles.answerBlock}>
                            <Text style={styles.answerQuestion}>{answer.question}</Text>
                            <Text style={styles.answerText}>{answer.answer}</Text>
                          </View>
                        ))}
                      </View>

                      {/* Resume Attachment */}
                      {app.resume_url && (
                        <TouchableOpacity
                          style={styles.resumeAttachment}
                          onPress={() => Linking.openURL(app.resume_url)}
                        >
                          <View style={styles.resumeIconContainer}>
                            <Ionicons name="document-text" size={20} color="#8b5cf6" />
                          </View>
                          <View style={styles.resumeInfo}>
                            <Text style={styles.resumeLabel}>📎 Resume Attached</Text>
                            <Text style={styles.resumeFilename} numberOfLines={1}>
                              {app.resume_filename || 'View Resume'}
                            </Text>
                          </View>
                          <Ionicons name="open-outline" size={18} color="#8b5cf6" />
                        </TouchableOpacity>
                      )}

                      <View style={styles.actionButtons}>
                        {pursuit?.requires_interview && (() => {
                          const buttonState = getInterviewButtonState(app.status);
                          return (
                            <TouchableOpacity
                              style={[
                                styles.interviewButton,
                                buttonState.style === 'sent' && styles.interviewButtonSent,
                                buttonState.style === 'review' && styles.interviewButtonReview,
                                buttonState.style === 'scheduled' && styles.interviewButtonScheduled,
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
                                buttonState.disabled && styles.interviewButtonTextDisabled,
                              ]}>
                                {buttonState.text}
                              </Text>
                            </TouchableOpacity>
                          );
                        })()}
                        <TouchableOpacity
                          style={styles.acceptButton}
                          onPress={() => handleAccept(app.id, app.applicant?.name || 'this applicant')}
                        >
                          <Text style={styles.acceptButtonText}>✓ Accept</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.rejectButton}
                          onPress={() => handleReject(app.id)}
                        >
                          <Text style={styles.rejectButtonText}>✕ Decline</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </>
              )}

              {reviewedApps.length > 0 && (
                <>
                  <Text style={styles.sectionTitle}>Reviewed ({reviewedApps.length})</Text>
                  {reviewedApps.map((app) => (
                    <View key={app.id} style={styles.appCard}>
                      <TouchableOpacity
                        style={styles.appHeader}
                        onPress={() => app.applicant_id && handleViewProfile(app.applicant_id)}
                      >
                        {app.applicant?.profile_picture ? (
                          <Image source={{ uri: app.applicant.profile_picture }} style={[styles.avatarImage, app.status === 'accepted' ? styles.avatarAcceptedBorder : styles.avatarDeclinedBorder]} />
                        ) : (
                          <View style={[
                            styles.avatar,
                            app.status === 'accepted' ? styles.avatarAccepted : styles.avatarDeclined
                          ]}>
                            <Text style={styles.avatarText}>
                              {app.applicant?.name?.charAt(0).toUpperCase() || '👤'}
                            </Text>
                          </View>
                        )}
                        <View style={styles.appInfo}>
                          <Text style={styles.appName}>{app.applicant?.name || 'Applicant'}</Text>
                          <View style={[
                            styles.statusBadge,
                            app.status === 'accepted' ? styles.statusAccepted : styles.statusDeclined
                          ]}>
                            <Text style={styles.statusText}>
                              {app.status === 'accepted' ? '✓ Accepted' : '✕ Declined'}
                            </Text>
                          </View>
                          <Text style={styles.viewProfileLink}>View profile →</Text>
                        </View>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.expandButton}
                        onPress={() => setExpandedReviewedId(expandedReviewedId === app.id ? null : app.id)}
                      >
                        <Text style={styles.expandIcon}>
                          {expandedReviewedId === app.id ? '▲ Hide answers' : '▼ Show answers'}
                        </Text>
                      </TouchableOpacity>

                      {expandedReviewedId === app.id && (
                        <View style={styles.answersSection}>
                          <Text style={styles.viewAnswersLabel}>Application Answers</Text>
                          {app.answers.map((answer: any, index: number) => (
                            <View key={index} style={styles.answerBlock}>
                              <Text style={styles.answerQuestion}>{answer.question}</Text>
                              <Text style={styles.answerText}>{answer.answer}</Text>
                            </View>
                          ))}
                          {/* Resume Attachment for reviewed apps */}
                          {app.resume_url && (
                            <TouchableOpacity
                              style={styles.resumeAttachment}
                              onPress={() => Linking.openURL(app.resume_url)}
                            >
                              <View style={styles.resumeIconContainer}>
                                <Ionicons name="document-text" size={20} color="#8b5cf6" />
                              </View>
                              <View style={styles.resumeInfo}>
                                <Text style={styles.resumeLabel}>📎 Resume Attached</Text>
                                <Text style={styles.resumeFilename} numberOfLines={1}>
                                  {app.resume_filename || 'View Resume'}
                                </Text>
                              </View>
                              <Ionicons name="open-outline" size={18} color="#8b5cf6" />
                            </TouchableOpacity>
                          )}
                          <Text style={styles.appDateReviewed}>
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
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { 
    backgroundColor: '#fff', 
    padding: 20, 
    paddingTop: 60, 
    borderBottomWidth: 1, 
    borderBottomColor: '#eee',
  },
  backButton: { marginBottom: 10 },
  backText: { fontSize: 16, color: '#0ea5e9', fontWeight: '600' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#333' },
  subtitle: { fontSize: 14, color: '#666', marginTop: 4 },
  scrollView: { flex: 1 },
  content: { padding: 20, paddingBottom: 100 },
  empty: { alignItems: 'center', paddingVertical: 80 },
  emptyEmoji: { fontSize: 64, marginBottom: 20 },
  emptyText: { fontSize: 18, color: '#999', fontWeight: '600' },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 16, marginTop: 8 },
  appCard: { 
    backgroundColor: '#fff', 
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
    backgroundColor: '#0ea5e9', 
    justifyContent: 'center', 
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: { fontSize: 24, color: '#fff', fontWeight: 'bold' },
  avatarImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  avatarAcceptedBorder: { borderWidth: 3, borderColor: '#10b981' },
  avatarDeclinedBorder: { borderWidth: 3, borderColor: '#ef4444' },
  appInfo: { flex: 1 },
  appName: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 4 },
  appDate: { fontSize: 12, color: '#999' },
  viewProfileLink: { fontSize: 12, color: '#0ea5e9', fontWeight: '600', marginTop: 4 },
  interviewStatusBadge: {
    backgroundColor: '#f3e8ff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  interviewStatusReview: {
    backgroundColor: '#fef3c7',
  },
  interviewStatusScheduled: {
    backgroundColor: '#d1fae5',
  },
  interviewStatusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6b7280',
  },
  statusBadge: { 
    alignSelf: 'flex-start',
    paddingHorizontal: 10, 
    paddingVertical: 4, 
    borderRadius: 12,
    marginTop: 4,
  },
  statusAccepted: { backgroundColor: '#d1fae5' },
  statusDeclined: { backgroundColor: '#fee2e2' },
  statusText: { fontSize: 12, fontWeight: 'bold', color: '#333' },
  answersSection: { marginBottom: 16 },
  answerBlock: { marginBottom: 12 },
  answerQuestion: { fontSize: 13, fontWeight: '600', color: '#333', marginBottom: 4 },
  answerText: { fontSize: 14, color: '#666', lineHeight: 20 },
  // Resume attachment styles
  resumeAttachment: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f3ff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#ddd6fe',
  },
  resumeIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#ede9fe',
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
    color: '#8b5cf6',
    marginBottom: 2,
  },
  resumeFilename: {
    fontSize: 12,
    color: '#6b7280',
  },
  actionButtons: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  interviewButton: {
    flex: 1,
    backgroundColor: '#8b5cf6',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    minWidth: '100%',
    marginBottom: 8,
  },
  interviewButtonSent: {
    backgroundColor: '#9ca3af',
  },
  interviewButtonReview: {
    backgroundColor: '#f59e0b',
  },
  interviewButtonScheduled: {
    backgroundColor: '#10b981',
  },
  interviewButtonText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  interviewButtonTextDisabled: { opacity: 0.9 },
  acceptButton: { 
    flex: 1, 
    backgroundColor: '#10b981', 
    borderRadius: 8, 
    padding: 12, 
    alignItems: 'center',
  },
  acceptButtonText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  rejectButton: {
    flex: 1,
    backgroundColor: '#ef4444',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  rejectButtonText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  avatarAccepted: { backgroundColor: '#10b981' },
  avatarDeclined: { backgroundColor: '#ef4444' },
  expandButton: {
    paddingVertical: 8,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    marginTop: 8,
  },
  expandIcon: { fontSize: 12, color: '#0ea5e9', fontWeight: '600' },
  viewAnswersLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0ea5e9',
    marginBottom: 12,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 16,
  },
  appDateReviewed: {
    fontSize: 12,
    color: '#999',
    marginTop: 12,
    fontStyle: 'italic',
  },
});
