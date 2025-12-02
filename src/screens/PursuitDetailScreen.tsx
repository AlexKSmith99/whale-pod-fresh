import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Image } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { applicationService } from '../services/applicationService';
import { meetingService } from '../services/meetingService';
import { notificationService } from '../services/notificationService';
import { supabase } from '../config/supabase';
import ApplicationScreen from './ApplicationScreen';
import ApplicationsReviewScreen from './ApplicationsReviewScreen';
import UserProfileScreen from './UserProfileScreen';
import TimeSlotProposalScreen from './TimeSlotProposalScreen';
import KickoffSchedulingScreen from './KickoffSchedulingScreen';

interface Props {
  pursuit: any;
  onBack: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
  isOwner: boolean;
  onViewProfile?: (userId: string, userEmail: string) => void;
  onSendMessage?: (userId: string, userEmail: string) => void;
  onOpenTeamBoard?: (pursuitId: string) => void;
  onOpenMeetingNotes?: (pursuitId: string) => void;
}

export default function PursuitDetailScreen({ pursuit, onBack, onDelete, onEdit, isOwner, onViewProfile, onSendMessage, onOpenTeamBoard }: Props) {
  const { user } = useAuth();
  const [showApplicationForm, setShowApplicationForm] = useState(false);
  const [showApplicationsReview, setShowApplicationsReview] = useState(false);
  const [hasApplied, setHasApplied] = useState(false);
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [creatorProfile, setCreatorProfile] = useState<any>(null);
  const [nextMeeting, setNextMeeting] = useState<any>(null);
  const [canActivateKickoff, setCanActivateKickoff] = useState(false);
  const [showTimeSlotProposal, setShowTimeSlotProposal] = useState(false);
  const [hasSubmittedProposal, setHasSubmittedProposal] = useState(false);
  const [showKickoffScheduling, setShowKickoffScheduling] = useState(false);
  const [isTeamMember, setIsTeamMember] = useState(false);

  useEffect(() => {
    checkIfApplied();
    loadCreatorProfile();
    loadNextMeeting();
    checkKickoffEligibility();
    checkProposalStatus();
    checkTeamMembership();
  }, []);

  const checkIfApplied = async () => {
    if (user && !isOwner) {
      const applied = await applicationService.hasUserApplied(pursuit.id, user.id);
      setHasApplied(applied);
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

  const loadNextMeeting = async () => {
    try {
      const meeting = await meetingService.getNextPursuitMeeting(pursuit.id);
      setNextMeeting(meeting);
    } catch (error) {
      console.error('Error loading next meeting:', error);
    }
  };

  const checkKickoffEligibility = () => {
    // Can activate kickoff if:
    // 1. User is the owner
    // 2. Status is 'awaiting_kickoff'
    // 3. Current members >= minimum team size
    const minSize = pursuit.team_size_min || 2;
    const eligible = isOwner &&
                     pursuit.status === 'awaiting_kickoff' &&
                     pursuit.current_members_count >= minSize;
    setCanActivateKickoff(eligible);
  };

  const checkProposalStatus = async () => {
    if (!user || isOwner) return;

    try {
      const proposals = await meetingService.getKickoffProposals(pursuit.id);
      const userProposal = proposals?.find((p: any) => p.user_id === user.id);
      setHasSubmittedProposal(!!userProposal);
    } catch (error) {
      console.error('Error checking proposal status:', error);
    }
  };

  const checkTeamMembership = async () => {
    if (!user || isOwner) return;

    try {
      const { data, error } = await supabase
        .from('team_members')
        .select('status')
        .eq('pursuit_id', pursuit.id)
        .eq('user_id', user.id)
        .in('status', ['active', 'accepted'])
        .single();

      setIsTeamMember(!!data && !error);
    } catch (error) {
      console.error('Error checking team membership:', error);
      setIsTeamMember(false);
    }
  };

  const handleActivateKickoff = async () => {
    Alert.alert(
      'Activate Kickoff',
      `Your team has reached the minimum size (${pursuit.current_members_count}/${pursuit.team_size_min}). Activating kickoff will prompt all team members to propose available meeting times.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Activate',
          onPress: async () => {
            try {
              // Update pursuit status to prompt time slot proposals
              const { error } = await supabase
                .from('pursuits')
                .update({ status: 'collecting_proposals' })
                .eq('id', pursuit.id);

              if (error) throw error;

              // Send notification to all team members (excluding creator)
              try {
                const { data: teamMembers } = await supabase
                  .from('team_members')
                  .select('user_id')
                  .eq('pursuit_id', pursuit.id)
                  .in('status', ['active', 'accepted'])
                  .neq('user_id', user!.id);

                if (teamMembers && teamMembers.length > 0) {
                  const teamMemberIds = teamMembers.map(tm => tm.user_id);
                  const creatorName = user?.name || user?.email || 'The creator';
                  await notificationService.notifyKickoffActivated(
                    teamMemberIds,
                    pursuit.id,
                    pursuit.title,
                    creatorName
                  );
                }
              } catch (notifError) {
                console.error('Error sending kickoff notification:', notifError);
                // Don't throw - notification failure shouldn't block activation
              }

              Alert.alert('Success!', 'Kickoff activated! Team members will be prompted to propose meeting times.');
              onBack(); // Refresh by going back
            } catch (error: any) {
              console.error('Error activating kickoff:', error);
              Alert.alert('Error', error.message || 'Failed to activate kickoff');
            }
          }
        }
      ]
    );
  };

  if (showKickoffScheduling) {
    return (
      <KickoffSchedulingScreen
        pursuitId={pursuit.id}
        pursuitTitle={pursuit.title}
        onClose={() => setShowKickoffScheduling(false)}
        onScheduled={() => {
          setShowKickoffScheduling(false);
          onBack(); // Refresh the pursuit detail
        }}
      />
    );
  }

  if (showTimeSlotProposal) {
    return (
      <TimeSlotProposalScreen
        pursuitId={pursuit.id}
        pursuitTitle={pursuit.title}
        onClose={() => setShowTimeSlotProposal(false)}
        onSubmitted={() => {
          setHasSubmittedProposal(true);
          setShowTimeSlotProposal(false);
        }}
      />
    );
  }

  if (showUserProfile && onViewProfile && onSendMessage) {
    // Create navigation object to match UserProfileScreen expectations
    const navigation = {
      navigate: (screen: string, params?: any) => {
        if (screen === 'Chat' && params?.partnerId) {
          setShowUserProfile(false);
          onSendMessage(params.partnerId, params.partnerEmail || 'User');
        }
      },
      goBack: () => setShowUserProfile(false),
      replace: (screen: string) => {
        if (screen === 'Profile') {
          setShowUserProfile(false);
        }
      },
    };

    return (
      <UserProfileScreen
        route={{ params: { userId: pursuit.creator_id } }}
        navigation={navigation}
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

        {pursuit.pursuit_categories && pursuit.pursuit_categories.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Categories</Text>
            <View style={styles.tagContainer}>
              {pursuit.pursuit_categories.map((category: string, i: number) => (
                <View key={i} style={[styles.tag, styles.categoryTag]}>
                  <Text style={[styles.tagText, styles.categoryTagText]}>{category}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {pursuit.subcategory && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Sub-category</Text>
            <View style={styles.tagContainer}>
              <View style={[styles.tag, styles.subcategoryTag]}>
                <Text style={[styles.tagText, styles.subcategoryTagText]}>{pursuit.subcategory}</Text>
              </View>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Decision System</Text>
          <Text style={styles.detailValue}>
            {pursuit.decision_system.replace(/_/g, ' ').toUpperCase()}
          </Text>
        </View>

        {/* Next Meeting Section */}
        {nextMeeting && (
          <View style={[styles.section, styles.nextMeetingSection]}>
            <Text style={styles.sectionTitle}>📅 Next Meeting</Text>
            <View style={styles.nextMeetingCard}>
              <Text style={styles.nextMeetingTitle}>{nextMeeting.title}</Text>
              <Text style={styles.nextMeetingTime}>
                {new Date(nextMeeting.scheduled_time).toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit'
                })}
              </Text>
              <View style={styles.nextMeetingDetails}>
                <Text style={styles.nextMeetingDetail}>
                  ⏱️ {nextMeeting.duration_minutes} min
                </Text>
                <Text style={styles.nextMeetingDetail}>
                  📍 {nextMeeting.meeting_type === 'video' ? 'Video Call' :
                      nextMeeting.meeting_type === 'in_person' ? 'In Person' : 'Hybrid'}
                </Text>
              </View>
              {nextMeeting.is_kickoff && (
                <View style={styles.kickoffBadge}>
                  <Text style={styles.kickoffBadgeText}>🚀 KICKOFF MEETING</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Activate Kickoff Button */}
        {canActivateKickoff && (
          <TouchableOpacity
            style={styles.activateKickoffButton}
            onPress={handleActivateKickoff}
          >
            <Text style={styles.activateKickoffText}>
              🚀 Activate Kickoff ({pursuit.current_members_count}/{pursuit.team_size_min} members ready)
            </Text>
          </TouchableOpacity>
        )}

        {/* Schedule Kickoff Button (for creator when collecting proposals) */}
        {isOwner && pursuit.status === 'collecting_proposals' && (
          <TouchableOpacity
            style={styles.scheduleKickoffButton}
            onPress={() => setShowKickoffScheduling(true)}
          >
            <Text style={styles.scheduleKickoffText}>
              📅 Review Proposals & Schedule Kickoff
            </Text>
          </TouchableOpacity>
        )}

        {/* Time Slot Proposal Button (for team members) */}
        {!isOwner && isTeamMember && pursuit.status === 'collecting_proposals' && (
          <>
            {hasSubmittedProposal ? (
              <View style={styles.proposalSubmittedBadge}>
                <Text style={styles.proposalSubmittedText}>✓ Time Proposals Submitted</Text>
                <Text style={styles.proposalSubmittedSubtext}>
                  Waiting for team creator to select final time
                </Text>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.proposeTimesButton}
                onPress={() => setShowTimeSlotProposal(true)}
              >
                <Text style={styles.proposeTimesText}>
                  📅 Propose Available Times
                </Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {isOwner && onOpenTeamBoard && (
          <View style={styles.ownerActions}>
            {onEdit && (
              <TouchableOpacity
                style={styles.editButton}
                onPress={onEdit}
              >
                <Text style={styles.editButtonText}>✏️ Edit Pursuit</Text>
              </TouchableOpacity>
            )}
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
  categoryTag: { backgroundColor: '#bae6fd' },
  categoryTagText: { color: '#0c4a6e' },
  subcategoryTag: { backgroundColor: '#ddd6fe' },
  subcategoryTagText: { color: '#5b21b6' },
  ownerActions: { marginTop: 20, gap: 12 },
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
  nextMeetingSection: { backgroundColor: '#f0f9ff', borderWidth: 2, borderColor: '#0ea5e9' },
  nextMeetingCard: { paddingTop: 8 },
  nextMeetingTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 8 },
  nextMeetingTime: { fontSize: 15, color: '#0ea5e9', fontWeight: '600', marginBottom: 12 },
  nextMeetingDetails: { flexDirection: 'row', gap: 16, marginBottom: 12 },
  nextMeetingDetail: { fontSize: 14, color: '#666' },
  kickoffBadge: { backgroundColor: '#f59e0b', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, alignSelf: 'flex-start' },
  kickoffBadgeText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  activateKickoffButton: { backgroundColor: '#f59e0b', borderRadius: 12, padding: 18, alignItems: 'center', marginTop: 20, shadowColor: '#f59e0b', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  activateKickoffText: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
  scheduleKickoffButton: { backgroundColor: '#10b981', borderRadius: 12, padding: 18, alignItems: 'center', marginTop: 20, shadowColor: '#10b981', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  scheduleKickoffText: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
  proposeTimesButton: { backgroundColor: '#0ea5e9', borderRadius: 12, padding: 18, alignItems: 'center', marginTop: 20, shadowColor: '#0ea5e9', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  proposeTimesText: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
  proposalSubmittedBadge: { backgroundColor: '#e0f2fe', borderRadius: 12, padding: 18, alignItems: 'center', marginTop: 20, borderWidth: 2, borderColor: '#0ea5e9' },
  proposalSubmittedText: { color: '#0ea5e9', fontSize: 17, fontWeight: 'bold', marginBottom: 4 },
  proposalSubmittedSubtext: { color: '#0369a1', fontSize: 14 },
});
