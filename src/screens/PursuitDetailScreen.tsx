import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Image } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { applicationService } from '../services/applicationService';
import { pursuitService } from '../services/pursuitService';
import { kickoffService } from '../services/kickoffService';
import { notificationService } from '../services/notificationService';
import { supabase } from '../config/supabase';
import ApplicationScreen from './ApplicationScreen';
import ApplicationsReviewScreen from './ApplicationsReviewScreen';
import UserProfileScreen from './UserProfileScreen';

interface Props {
  pursuit: any;
  onBack: () => void;
  onDelete?: () => void;
  onEdit?: (pursuit: any) => void;
  isOwner: boolean;
  onViewProfile?: (userId: string, userEmail: string) => void;
  onSendMessage?: (userId: string, userEmail: string) => void;
  onOpenTeamBoard?: (pursuitId: string) => void;
  onOpenMeetingNotes?: (pursuitId: string) => void;
  onOpenCreatorTimeSelection?: (pursuit: any) => void;
}

export default function PursuitDetailScreen({ pursuit, onBack, onDelete, onEdit, isOwner, onViewProfile, onSendMessage, onOpenTeamBoard, onOpenCreatorTimeSelection }: Props) {
  const { user } = useAuth();
  const [showApplicationForm, setShowApplicationForm] = useState(false);
  const [showApplicationsReview, setShowApplicationsReview] = useState(false);
  const [hasApplied, setHasApplied] = useState(false);
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [creatorProfile, setCreatorProfile] = useState<any>(null);
  const [acceptedMembersCount, setAcceptedMembersCount] = useState(0);
  const [minTeammatesReached, setMinTeammatesReached] = useState(false);

  useEffect(() => {
    checkIfApplied();
    loadCreatorProfile();
    if (isOwner) {
      checkMinimumTeammates();
    }
  }, []);

  const checkIfApplied = async () => {
    if (user && !isOwner) {
      const applied = await applicationService.hasUserApplied(pursuit.id, user.id);
      setHasApplied(applied);
    }
  };

  const checkMinimumTeammates = async () => {
    try {
      const count = await pursuitService.getAcceptedMembersCount(pursuit.id);
      setAcceptedMembersCount(count);

      // +1 to include the creator
      const totalMembers = count + 1;
      setMinTeammatesReached(totalMembers >= pursuit.team_size_min);
    } catch (error) {
      console.error('Error checking team members:', error);
    }
  };

  const loadCreatorProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('name, profile_picture, email')
        .eq('id', pursuit.creator_id)
        .single();

      if (error) throw error;
      setCreatorProfile(data);
    } catch (error) {
      console.error('Error loading creator profile:', error);
    }
  };

  const handleScheduleKickoff = async () => {
    try {
      // Get all accepted team members
      const members = await kickoffService.requestTimeSlots(pursuit.id, user!.id);

      // Get member IDs
      const memberIds = members.map(m => m.user_id);

      // Notify all team members to propose time slots
      await notificationService.notifyTimeSlotRequest(
        pursuit.id,
        memberIds,
        pursuit.title
      );

      Alert.alert(
        '✅ Time Slot Request Sent!',
        `All ${memberIds.length} team members have been notified to propose their available time slots. You can now view proposals as they come in and select the best time.`,
        [
          {
            text: 'View Proposals',
            onPress: () => {
              if (onOpenCreatorTimeSelection) {
                onOpenCreatorTimeSelection(pursuit);
              }
            },
          },
          {
            text: 'Later',
            style: 'cancel',
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  if (showUserProfile && onViewProfile && onSendMessage) {
    return (
      <UserProfileScreen
        userId={pursuit.creator_id}
        userEmail={creatorProfile?.email || "Creator"}
        onBack={() => setShowUserProfile(false)}
        onSendMessage={(userId, userEmail) => {
          setShowUserProfile(false);
          onSendMessage(userId, userEmail);
        }}
      />
    );
  }

  if (showApplicationForm) {
    return (
      <ApplicationScreen
        pursuit={pursuit}
        onBack={() => setShowApplicationForm(false)}
        onSubmitted={() => {
          setShowApplicationForm(false);
          setHasApplied(true);
        }}
      />
    );
  }

  if (showApplicationsReview) {
    return (
      <ApplicationsReviewScreen
        pursuitId={pursuit.id}
        onBack={() => setShowApplicationsReview(false)}
      />
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{pursuit.title}</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.creatorSection}>
          <Text style={styles.sectionTitle}>Created By</Text>
          <TouchableOpacity 
            style={styles.creatorCard}
            onPress={() => setShowUserProfile(true)}
          >
            {creatorProfile?.profile_picture ? (
              <Image source={{ uri: creatorProfile.profile_picture }} style={styles.creatorImage} />
            ) : (
              <View style={styles.creatorAvatar}>
                <Text style={styles.creatorAvatarText}>
                  {creatorProfile?.name?.charAt(0).toUpperCase() || '?'}
                </Text>
              </View>
            )}
            <View style={styles.creatorInfo}>
              <Text style={styles.creatorName}>{creatorProfile?.name || 'Loading...'}</Text>
              <Text style={styles.viewProfileText}>Tap to view profile →</Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.description}>{pursuit.description}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Details</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>📍 Location:</Text>
            <Text style={styles.detailValue}>{pursuit.location}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>📅 Meeting Cadence:</Text>
            <Text style={styles.detailValue}>{pursuit.meeting_cadence}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>👥 Team Size:</Text>
            <Text style={styles.detailValue}>
              {pursuit.current_members_count}/{pursuit.team_size_max} members
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Status:</Text>
            <Text style={styles.detailValue}>
              {pursuit.status === 'awaiting_kickoff' ? '🟡 Awaiting Kickoff' : '🟢 Active'}
            </Text>
          </View>
        </View>

        {pursuit.pursuit_types && pursuit.pursuit_types.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pursuit Types</Text>
            <View style={styles.tagContainer}>
              {pursuit.pursuit_types.map((type: string, i: number) => (
                <View key={i} style={styles.tag}>
                  <Text style={styles.tagText}>{type}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Decision System</Text>
          <Text style={styles.detailValue}>
            {pursuit.decision_system.replace(/_/g, ' ').toUpperCase()}
          </Text>
        </View>

        {isOwner && onOpenTeamBoard && (
          <View style={styles.ownerActions}>
            {pursuit.status === 'awaiting_kickoff' && minTeammatesReached && (
              <TouchableOpacity
                style={styles.scheduleKickoffButton}
                onPress={handleScheduleKickoff}
              >
                <Text style={styles.scheduleKickoffButtonText}>
                  🎉 Schedule Kick-Off Meeting
                </Text>
                <Text style={styles.scheduleKickoffSubtext}>
                  {acceptedMembersCount + 1}/{pursuit.team_size_min} minimum teammates ready!
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => onEdit && onEdit(pursuit)}
            >
              <Text style={styles.editButtonText}>✏️ Edit Pursuit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.teamBoardButton}
              onPress={() => onOpenTeamBoard(pursuit.id)}
            >
              <Text style={styles.teamBoardButtonText}>📋 Team Board</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.reviewButton}
              onPress={() => setShowApplicationsReview(true)}
            >
              <Text style={styles.reviewButtonText}>📋 Review Applications</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.deleteButton} onPress={onDelete}>
              <Text style={styles.deleteButtonText}>🗑️ Delete Pursuit</Text>
            </TouchableOpacity>
          </View>
        )}

        {!isOwner && (
          <>
            {hasApplied ? (
              <View style={styles.appliedBadge}>
                <Text style={styles.appliedText}>✓ Application Submitted</Text>
              </View>
            ) : (
              <TouchableOpacity 
                style={styles.applyButton}
                onPress={() => setShowApplicationForm(true)}
              >
                <Text style={styles.applyButtonText}>🚀 Apply to Join</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { backgroundColor: '#fff', padding: 20, paddingTop: 60, borderBottomWidth: 1, borderBottomColor: '#eee' },
  backButton: { marginBottom: 10 },
  backText: { fontSize: 16, color: '#0ea5e9', fontWeight: '600' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#333' },
  content: { padding: 20, paddingBottom: 100 },
  creatorSection: { marginBottom: 15 },
  creatorCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  creatorImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  creatorAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#0ea5e9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  creatorAvatarText: { fontSize: 24, color: '#fff', fontWeight: 'bold' },
  creatorInfo: { flex: 1 },
  creatorName: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 4 },
  viewProfileText: { fontSize: 13, color: '#0ea5e9', fontWeight: '600' },
  section: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 15, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 12 },
  description: { fontSize: 15, color: '#666', lineHeight: 22 },
  detailRow: { marginBottom: 10 },
  detailLabel: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 4 },
  detailValue: { fontSize: 14, color: '#666' },
  tagContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { backgroundColor: '#e0f2fe', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  tagText: { color: '#0369a1', fontSize: 13, fontWeight: '500' },
  ownerActions: { marginTop: 20, gap: 12 },
  scheduleKickoffButton: {
    backgroundColor: '#10b981',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  scheduleKickoffButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: 'bold',
  },
  scheduleKickoffSubtext: {
    color: '#fff',
    fontSize: 13,
    marginTop: 4,
    opacity: 0.9,
  },
  editButton: { backgroundColor: '#f59e0b', borderRadius: 8, padding: 16, alignItems: 'center' },
  editButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  teamBoardButton: { backgroundColor: '#8b5cf6', borderRadius: 8, padding: 16, alignItems: 'center' },
  teamBoardButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  reviewButton: { backgroundColor: '#0ea5e9', borderRadius: 8, padding: 16, alignItems: 'center' },
  reviewButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  deleteButton: { backgroundColor: '#ef4444', borderRadius: 8, padding: 16, alignItems: 'center' },
  deleteButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  applyButton: { backgroundColor: '#10b981', borderRadius: 12, padding: 18, alignItems: 'center', marginTop: 20, shadowColor: '#10b981', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  applyButtonText: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
  appliedBadge: { backgroundColor: '#d1fae5', borderRadius: 12, padding: 18, alignItems: 'center', marginTop: 20, borderWidth: 2, borderColor: '#10b981' },
  appliedText: { color: '#10b981', fontSize: 17, fontWeight: 'bold' },
});
