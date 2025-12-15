import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Image, Modal, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
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
import PodChatScreen from './PodChatScreen';

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
  initialSubScreen?: string | null;
}

export default function PursuitDetailScreen({ pursuit, onBack, onDelete, onEdit, isOwner, onViewProfile, onSendMessage, onOpenTeamBoard, initialSubScreen }: Props) {
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
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [initialKickoffDate, setInitialKickoffDate] = useState<Date | null>(null);

  // Edit team members state
  const [showEditTeamModal, setShowEditTeamModal] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<any>(null);
  const [showRemovalForm, setShowRemovalForm] = useState(false);
  const [removalReason, setRemovalReason] = useState('');
  const [shareWithMember, setShareWithMember] = useState(false);
  const [removingMember, setRemovingMember] = useState(false);

  // Leave Pod state (for team members)
  const [showLeavePodModal, setShowLeavePodModal] = useState(false);
  const [leaveReason, setLeaveReason] = useState('');
  const [shareWithLeader, setShareWithLeader] = useState(false);
  const [leavingPod, setLeavingPod] = useState(false);

  // Pod Chat state
  const [showPodChat, setShowPodChat] = useState(false);

  // Handle initial sub-screen navigation from notifications
  useEffect(() => {
    if (initialSubScreen === 'applications') {
      setShowApplicationsReview(true);
    } else if (initialSubScreen === 'kickoff') {
      setShowKickoffScheduling(true);
    }
  }, [initialSubScreen]);

  useEffect(() => {
    checkIfApplied();
    loadCreatorProfile();
    loadNextMeeting();
    checkKickoffEligibility();
    checkProposalStatus();
    checkTeamMembership();
    loadTeamMembers();
    loadInitialKickoffDate();
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

  const loadTeamMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('team_members')
        .select(`
          user_id,
          status,
          user:profiles!user_id(
            id,
            name,
            email,
            profile_picture
          )
        `)
        .eq('pursuit_id', pursuit.id)
        .in('status', ['active', 'accepted']);

      if (error) throw error;

      setTeamMembers(data || []);
    } catch (error) {
      console.error('Error loading team members:', error);
    }
  };

  const loadInitialKickoffDate = async () => {
    try {
      // Get the kickoff meeting for this pursuit to find when it was originally kicked off
      const { data, error } = await supabase
        .from('meetings')
        .select('scheduled_time')
        .eq('pursuit_id', pursuit.id)
        .eq('is_kickoff', true)
        .order('scheduled_time', { ascending: true })
        .limit(1)
        .single();

      if (error) {
        // No kickoff meeting found - that's OK for pursuits not yet kicked off
        if (error.code !== 'PGRST116') {
          console.error('Error loading kickoff date:', error);
        }
        return;
      }

      if (data?.scheduled_time) {
        setInitialKickoffDate(new Date(data.scheduled_time));
      }
    } catch (error) {
      console.error('Error loading initial kickoff date:', error);
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

  const handleRemoveMemberConfirm = (member: any) => {
    const memberName = member.user?.name || member.user?.email || 'this member';
    Alert.alert(
      `Remove ${memberName} from the Pod?`,
      '',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes',
          onPress: () => {
            setMemberToRemove(member);
            setShowRemovalForm(true);
          }
        }
      ]
    );
  };

  const handleRemoveMember = async () => {
    if (!memberToRemove || removalReason.length < 50) {
      Alert.alert('Error', 'Please provide a reason with at least 50 characters');
      return;
    }

    setRemovingMember(true);
    try {
      // Update member status to 'removed'
      const { error: updateError } = await supabase
        .from('team_members')
        .update({
          status: 'removed'
        })
        .eq('pursuit_id', pursuit.id)
        .eq('user_id', memberToRemove.user_id);

      if (updateError) throw updateError;

      // Update pursuit member count
      const { error: countError } = await supabase
        .from('pursuits')
        .update({ current_members_count: (pursuit.current_members_count || 1) - 1 })
        .eq('id', pursuit.id);

      if (countError) {
        console.error('Error updating member count:', countError);
      }

      // Send notification if share with member is checked
      if (shareWithMember) {
        try {
          await notificationService.sendPushNotification(
            [memberToRemove.user_id],
            `Removed from ${pursuit.title}`,
            `You have been removed from this pod by the creator.`,
            {
              type: 'member_removed',
              pursuitId: pursuit.id,
              pursuitTitle: pursuit.title,
              removalReason: removalReason,
              removedAt: new Date().toISOString()
            },
            'member_removed',
            pursuit.id,
            'pursuit'
          );
        } catch (notifError) {
          console.error('Error sending removal notification:', notifError);
        }
      }

      Alert.alert('Member Removed', `${memberToRemove.user?.name || 'Member'} has been removed from the pod.`);

      // Reset state
      setMemberToRemove(null);
      setShowRemovalForm(false);
      setRemovalReason('');
      setShareWithMember(false);
      setShowEditTeamModal(false);

      // Reload team members
      loadTeamMembers();
    } catch (error: any) {
      console.error('Error removing member:', error);
      Alert.alert('Error', error.message || 'Failed to remove member');
    } finally {
      setRemovingMember(false);
    }
  };

  const handleLeavePod = async () => {
    if (!user || leaveReason.length < 50) {
      Alert.alert('Error', 'Please provide a reason with at least 50 characters');
      return;
    }

    setLeavingPod(true);
    try {
      // Update member status to 'removed' (left)
      const { data: updateData, error: updateError } = await supabase
        .from('team_members')
        .update({
          status: 'removed'
        })
        .eq('pursuit_id', pursuit.id)
        .eq('user_id', user.id)
        .select();

      if (updateError) throw updateError;

      if (!updateData || updateData.length === 0) {
        Alert.alert('Error', 'Failed to leave pod. Please try again.');
        setLeavingPod(false);
        return;
      }

      // Update pursuit member count
      const { error: countError } = await supabase
        .from('pursuits')
        .update({ current_members_count: Math.max((pursuit.current_members_count || 1) - 1, 0) })
        .eq('id', pursuit.id);

      if (countError) {
        console.error('Error updating member count:', countError);
      }

      // Send notification to creator if share with leader is checked
      if (shareWithLeader) {
        try {
          const userName = user.name || user.email || 'A team member';
          await notificationService.sendPushNotification(
            [pursuit.creator_id],
            `${userName} left ${pursuit.title}`,
            `A team member has left your pod.`,
            {
              type: 'member_left',
              pursuitId: pursuit.id,
              pursuitTitle: pursuit.title,
              memberName: userName,
              leaveReason: leaveReason,
              leftAt: new Date().toISOString()
            },
            'member_left',
            pursuit.id,
            'pursuit'
          );
        } catch (notifError) {
          console.error('Error sending leave notification:', notifError);
        }
      }

      Alert.alert(
        'Left Pod',
        `You have left ${pursuit.title}.`,
        [{ text: 'OK', onPress: () => onBack() }]
      );

      // Reset state
      setShowLeavePodModal(false);
      setLeaveReason('');
      setShareWithLeader(false);
    } catch (error: any) {
      console.error('Error leaving pod:', error);
      Alert.alert('Error', error.message || 'Failed to leave pod');
    } finally {
      setLeavingPod(false);
    }
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
          setSelectedMemberId(null);
          onSendMessage(params.partnerId, params.partnerEmail || 'User');
        }
      },
      goBack: () => {
        setShowUserProfile(false);
        setSelectedMemberId(null);
      },
      replace: (screen: string) => {
        if (screen === 'Profile') {
          setShowUserProfile(false);
          setSelectedMemberId(null);
        }
      },
    };

    return (
      <UserProfileScreen
        route={{ params: { userId: selectedMemberId || pursuit.creator_id } }}
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

  if (showPodChat) {
    return (
      <PodChatScreen
        pursuitId={pursuit.id}
        pursuitTitle={pursuit.title}
        podPicture={pursuit.default_picture}
        onBack={() => setShowPodChat(false)}
      />
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleRow}>
          <Text style={styles.title}>{pursuit.title}</Text>
          {pursuit.default_picture && (
            <Image
              source={{ uri: pursuit.default_picture }}
              style={styles.headerPodPicture}
            />
          )}
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.creatorSection}>
          <Text style={styles.sectionTitle}>Created By</Text>
          <TouchableOpacity
            style={styles.creatorCard}
            onPress={() => {
              setSelectedMemberId(pursuit.creator_id);
              setShowUserProfile(true);
            }}
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

        {/* Team Members Section */}
        {teamMembers.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Team Members ({teamMembers.length})</Text>
              {isOwner && (
                <TouchableOpacity
                  style={styles.editTeamButton}
                  onPress={() => setShowEditTeamModal(true)}
                >
                  <Text style={styles.editTeamButtonText}>Edit</Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.membersGrid}>
              {teamMembers.map((member: any) => (
                <TouchableOpacity
                  key={member.user_id}
                  style={styles.memberCard}
                  onPress={() => {
                    setSelectedMemberId(member.user_id);
                    setShowUserProfile(true);
                  }}
                >
                  {member.user?.profile_picture ? (
                    <Image
                      source={{ uri: member.user.profile_picture }}
                      style={styles.memberImage}
                    />
                  ) : (
                    <View style={styles.memberAvatar}>
                      <Text style={styles.memberAvatarText}>
                        {member.user?.name?.charAt(0).toUpperCase() || '?'}
                      </Text>
                    </View>
                  )}
                  <Text style={styles.memberName} numberOfLines={2}>
                    {member.user?.name || member.user?.email || 'Team Member'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

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
          {initialKickoffDate && pursuit.status === 'active' && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>🚀 Initial Kick-Off:</Text>
              <Text style={styles.detailValue}>
                {initialKickoffDate.toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                })}
              </Text>
            </View>
          )}
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
            {pursuit.decision_system === 'admin_has_ultimate_say'
              ? 'Admin has full control'
              : pursuit.decision_system.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}
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
              style={styles.podChatButton}
              onPress={() => setShowPodChat(true)}
            >
              <Text style={styles.podChatButtonText}>💬 Pod Chat</Text>
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
            {isTeamMember ? (
              // Team member actions
              <View style={styles.teamMemberActions}>
                {onOpenTeamBoard && (
                  <TouchableOpacity
                    style={styles.teamBoardButtonMember}
                    onPress={() => onOpenTeamBoard(pursuit.id)}
                  >
                    <Text style={styles.teamBoardButtonText}>📋 Team Board</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.podChatButtonMember}
                  onPress={() => setShowPodChat(true)}
                >
                  <Text style={styles.podChatButtonText}>💬 Pod Chat</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.leavePodButton}
                  onPress={() => setShowLeavePodModal(true)}
                >
                  <Text style={styles.leavePodButtonText}>🚪 Leave Pod</Text>
                </TouchableOpacity>
              </View>
            ) : hasApplied ? (
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

      {/* Edit Team Members Modal */}
      <Modal
        visible={showEditTeamModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setShowEditTeamModal(false);
          setMemberToRemove(null);
          setShowRemovalForm(false);
          setRemovalReason('');
          setShareWithMember(false);
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {showRemovalForm ? 'Remove Member' : 'Edit Team Members'}
              </Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => {
                  setShowEditTeamModal(false);
                  setMemberToRemove(null);
                  setShowRemovalForm(false);
                  setRemovalReason('');
                  setShareWithMember(false);
                }}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {!showRemovalForm ? (
              // Team members list with remove buttons
              <ScrollView style={styles.modalContent}>
                {teamMembers.map((member: any) => (
                  <View key={member.user_id} style={styles.editMemberCard}>
                    <View style={styles.editMemberInfo}>
                      {member.user?.profile_picture ? (
                        <Image
                          source={{ uri: member.user.profile_picture }}
                          style={styles.editMemberImage}
                        />
                      ) : (
                        <View style={styles.editMemberAvatar}>
                          <Text style={styles.editMemberAvatarText}>
                            {member.user?.name?.charAt(0).toUpperCase() || '?'}
                          </Text>
                        </View>
                      )}
                      <View style={styles.editMemberDetails}>
                        <Text style={styles.editMemberName}>
                          {member.user?.name || 'Team Member'}
                        </Text>
                        <Text style={styles.editMemberEmail}>
                          {member.user?.email}
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={styles.removeButton}
                      onPress={() => handleRemoveMemberConfirm(member)}
                    >
                      <Text style={styles.removeButtonText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
                {teamMembers.length === 0 && (
                  <Text style={styles.noMembersText}>No team members yet</Text>
                )}
              </ScrollView>
            ) : (
              // Removal form
              <ScrollView style={styles.modalContent}>
                <View style={styles.removalForm}>
                  <Text style={styles.removalMemberName}>
                    Removing: {memberToRemove?.user?.name || memberToRemove?.user?.email}
                  </Text>

                  <Text style={styles.removalLabel}>Reason for Removal</Text>
                  <Text style={styles.removalSubLabel}>
                    Please explain why you are removing this member (50 character minimum)
                  </Text>
                  <TextInput
                    style={styles.removalInput}
                    value={removalReason}
                    onChangeText={setRemovalReason}
                    placeholder="Enter reason for removal..."
                    multiline
                    numberOfLines={4}
                    spellCheck={true}
                    autoCorrect={true}
                  />
                  <Text style={[
                    styles.characterCount,
                    removalReason.length < 50 && styles.characterCountError
                  ]}>
                    {removalReason.length}/50 characters minimum
                  </Text>

                  <TouchableOpacity
                    style={styles.checkboxRow}
                    onPress={() => setShareWithMember(!shareWithMember)}
                  >
                    <View style={[styles.checkbox, shareWithMember && styles.checkboxChecked]}>
                      {shareWithMember && <Text style={styles.checkboxMark}>✓</Text>}
                    </View>
                    <Text style={styles.checkboxLabel}>Share with the member?</Text>
                  </TouchableOpacity>
                  <Text style={styles.checkboxHint}>
                    If checked, the member will receive a notification with your reason
                  </Text>

                  <View style={styles.removalButtons}>
                    <TouchableOpacity
                      style={styles.cancelRemovalButton}
                      onPress={() => {
                        setMemberToRemove(null);
                        setShowRemovalForm(false);
                        setRemovalReason('');
                        setShareWithMember(false);
                      }}
                    >
                      <Text style={styles.cancelRemovalText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.confirmRemovalButton,
                        (removalReason.length < 50 || removingMember) && styles.buttonDisabled
                      ]}
                      onPress={handleRemoveMember}
                      disabled={removalReason.length < 50 || removingMember}
                    >
                      <Text style={styles.confirmRemovalText}>
                        {removingMember ? 'Removing...' : 'Remove Member'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </ScrollView>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Leave Pod Modal */}
      <Modal
        visible={showLeavePodModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setShowLeavePodModal(false);
          setLeaveReason('');
          setShareWithLeader(false);
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Leave Pod</Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => {
                  setShowLeavePodModal(false);
                  setLeaveReason('');
                  setShareWithLeader(false);
                }}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              <View style={styles.removalForm}>
                <Text style={styles.leavePodTitle}>
                  Are you sure you want to leave "{pursuit.title}"?
                </Text>

                <Text style={styles.removalLabel}>Reason for Leaving</Text>
                <Text style={styles.removalSubLabel}>
                  Please explain why you are leaving this pod (50 character minimum)
                </Text>
                <TextInput
                  style={styles.removalInput}
                  value={leaveReason}
                  onChangeText={setLeaveReason}
                  placeholder="Enter reason for leaving..."
                  multiline
                  numberOfLines={4}
                  spellCheck={true}
                  autoCorrect={true}
                />
                <Text style={[
                  styles.characterCount,
                  leaveReason.length < 50 && styles.characterCountError
                ]}>
                  {leaveReason.length}/50 characters minimum
                </Text>

                <TouchableOpacity
                  style={styles.checkboxRow}
                  onPress={() => setShareWithLeader(!shareWithLeader)}
                >
                  <View style={[styles.checkbox, shareWithLeader && styles.checkboxChecked]}>
                    {shareWithLeader && <Text style={styles.checkboxMark}>✓</Text>}
                  </View>
                  <Text style={styles.checkboxLabel}>Share with the leader?</Text>
                </TouchableOpacity>
                <Text style={styles.checkboxHint}>
                  If checked, the pod creator will receive a notification with your reason
                </Text>

                <View style={styles.removalButtons}>
                  <TouchableOpacity
                    style={styles.cancelRemovalButton}
                    onPress={() => {
                      setShowLeavePodModal(false);
                      setLeaveReason('');
                      setShareWithLeader(false);
                    }}
                  >
                    <Text style={styles.cancelRemovalText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.confirmLeaveButton,
                      (leaveReason.length < 50 || leavingPod) && styles.buttonDisabled
                    ]}
                    onPress={handleLeavePod}
                    disabled={leaveReason.length < 50 || leavingPod}
                  >
                    <Text style={styles.confirmLeaveText}>
                      {leavingPod ? 'Leaving...' : 'Leave Pod'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { backgroundColor: '#fff', padding: 20, paddingTop: 60, borderBottomWidth: 1, borderBottomColor: '#eee' },
  backButton: { marginBottom: 10 },
  backText: { fontSize: 16, color: '#0ea5e9', fontWeight: '600' },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { fontSize: 24, fontWeight: 'bold', color: '#333', flex: 1 },
  headerPodPicture: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginLeft: 12,
  },
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
  podChatButton: { backgroundColor: '#6366f1', borderRadius: 8, padding: 16, alignItems: 'center' },
  podChatButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
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
  membersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
  },
  memberCard: {
    width: '30%',
    minWidth: 100,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  memberImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginBottom: 8,
  },
  memberAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#10b981',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  memberAvatarText: {
    fontSize: 24,
    color: '#fff',
    fontWeight: 'bold',
  },
  memberName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  // Section header with Edit button
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  editTeamButton: {
    backgroundColor: '#0ea5e9',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  editTeamButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  modalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseText: {
    fontSize: 18,
    color: '#666',
  },
  modalContent: {
    padding: 20,
  },
  // Edit member card styles
  editMemberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  editMemberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  editMemberImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  editMemberAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#10b981',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  editMemberAvatarText: {
    fontSize: 20,
    color: '#fff',
    fontWeight: 'bold',
  },
  editMemberDetails: {
    flex: 1,
  },
  editMemberName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  editMemberEmail: {
    fontSize: 13,
    color: '#666',
  },
  removeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  noMembersText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    paddingVertical: 20,
  },
  // Removal form styles
  removalForm: {
    paddingBottom: 20,
  },
  removalMemberName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ef4444',
    marginBottom: 20,
    textAlign: 'center',
  },
  removalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  removalSubLabel: {
    fontSize: 13,
    color: '#666',
    marginBottom: 12,
  },
  removalInput: {
    backgroundColor: '#f9f9f9',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  characterCount: {
    fontSize: 12,
    color: '#10b981',
    textAlign: 'right',
    marginTop: 4,
    marginBottom: 20,
  },
  characterCountError: {
    color: '#ef4444',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#ddd',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#0ea5e9',
    borderColor: '#0ea5e9',
  },
  checkboxMark: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  checkboxLabel: {
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
  },
  checkboxHint: {
    fontSize: 12,
    color: '#666',
    marginLeft: 36,
    marginBottom: 24,
  },
  removalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelRemovalButton: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  cancelRemovalText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  confirmRemovalButton: {
    flex: 1,
    backgroundColor: '#ef4444',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  confirmRemovalText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  // Team member actions styles
  teamMemberActions: {
    marginTop: 20,
    gap: 12,
  },
  teamBoardButtonMember: {
    backgroundColor: '#8b5cf6',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  podChatButtonMember: {
    backgroundColor: '#6366f1',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  leavePodButton: {
    backgroundColor: '#ef4444',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  leavePodButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  leavePodTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  confirmLeaveButton: {
    flex: 1,
    backgroundColor: '#ef4444',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  confirmLeaveText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
});
