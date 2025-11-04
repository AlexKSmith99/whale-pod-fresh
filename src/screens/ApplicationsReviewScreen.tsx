import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Image } from 'react-native';
import { applicationService } from '../services/applicationService';

interface Props {
  pursuitId: string;
  onBack: () => void;
  onViewProfile?: (userId: string) => void;
}

export default function ApplicationsReviewScreen({ pursuitId, onBack, onViewProfile }: Props) {
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

  const pendingApps = applications.filter(a => a.status === 'pending');
  const reviewedApps = applications.filter(a => a.status !== 'pending');

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
                      <View style={styles.appHeader}>
                        <TouchableOpacity
                          onPress={() => onViewProfile?.(app.applicant?.id)}
                          style={styles.avatarContainer}
                        >
                          {app.applicant?.profile_picture ? (
                            <Image
                              source={{ uri: app.applicant.profile_picture }}
                              style={styles.avatar}
                            />
                          ) : (
                            <View style={styles.avatarPlaceholder}>
                              <Text style={styles.avatarPlaceholderText}>
                                {app.applicant?.name?.charAt(0).toUpperCase() || '?'}
                              </Text>
                            </View>
                          )}
                        </TouchableOpacity>
                        <View style={styles.appInfo}>
                          <TouchableOpacity onPress={() => onViewProfile?.(app.applicant?.id)}>
                            <Text style={styles.appName}>{app.applicant?.name || 'Unknown'}</Text>
                          </TouchableOpacity>
                          <Text style={styles.appDate}>
                            Applied {new Date(app.created_at).toLocaleDateString()}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.answersSection}>
                        {app.answers.map((answer: any, index: number) => (
                          <View key={index} style={styles.answerBlock}>
                            <Text style={styles.answerQuestion}>{answer.question}</Text>
                            <Text style={styles.answerText}>{answer.answer}</Text>
                          </View>
                        ))}
                      </View>

                      <View style={styles.actionButtons}>
                        <TouchableOpacity
                          style={styles.acceptButton}
                          onPress={() => handleAccept(app.id, app.applicant?.email)}
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
                      <View style={styles.appHeader}>
                        <TouchableOpacity
                          onPress={() => onViewProfile?.(app.applicant?.id)}
                          style={styles.avatarContainer}
                        >
                          {app.applicant?.profile_picture ? (
                            <Image
                              source={{ uri: app.applicant.profile_picture }}
                              style={styles.avatar}
                            />
                          ) : (
                            <View style={styles.avatarPlaceholder}>
                              <Text style={styles.avatarPlaceholderText}>
                                {app.applicant?.name?.charAt(0).toUpperCase() || '?'}
                              </Text>
                            </View>
                          )}
                        </TouchableOpacity>
                        <View style={styles.appInfo}>
                          <TouchableOpacity onPress={() => onViewProfile?.(app.applicant?.id)}>
                            <Text style={styles.appName}>{app.applicant?.name || 'Unknown'}</Text>
                          </TouchableOpacity>
                          <View style={[
                            styles.statusBadge,
                            app.status === 'accepted' ? styles.statusAccepted : styles.statusDeclined
                          ]}>
                            <Text style={styles.statusText}>
                              {app.status === 'accepted' ? '✓ Accepted' : '✕ Declined'}
                            </Text>
                          </View>
                        </View>
                      </View>
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
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#0ea5e9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarPlaceholderText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  appInfo: { flex: 1 },
  appName: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 4 },
  appDate: { fontSize: 12, color: '#999' },
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
  actionButtons: { flexDirection: 'row', gap: 10 },
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
});
