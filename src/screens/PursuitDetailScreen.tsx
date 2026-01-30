import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Image, Modal, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { applicationService } from '../services/applicationService';
import { meetingService } from '../services/meetingService';
import { notificationService } from '../services/notificationService';
import { privacyService } from '../services/privacyService';
import { supabase } from '../config/supabase';
import ApplicationScreen from './ApplicationScreen';
import ApplicationsReviewScreen from './ApplicationsReviewScreen';
import UserProfileScreen from './UserProfileScreen';
import WriteReviewScreen from './WriteReviewScreen';
import TimeSlotProposalScreen from './TimeSlotProposalScreen';
import KickoffSchedulingScreen from './KickoffSchedulingScreen';
import PodChatScreen from './PodChatScreen';
import { colors as legacyColors, typography, spacing } from '../theme/designSystem';
import { useTheme } from '../theme/ThemeContext';
import { getThemedStyles } from '../theme/themedStyles';
import GrainTexture from '../components/ui/GrainTexture';

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
  fromNotifications?: boolean;
  onBackToNotifications?: () => void;
}

export default function PursuitDetailScreen({ pursuit, onBack, onDelete, onEdit, isOwner, onViewProfile, onSendMessage, onOpenTeamBoard, initialSubScreen, fromNotifications, onBackToNotifications }: Props) {
  const { user } = useAuth();
  const { theme, isNewTheme } = useTheme();
  const colors = theme.colors;
  const themedStyles = getThemedStyles(colors, isNewTheme);
  const [showApplicationForm, setShowApplicationForm] = useState(false);
  const [showApplicationsReview, setShowApplicationsReview] = useState(false);
  const [hasApplied, setHasApplied] = useState(false);
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [creatorProfile, setCreatorProfile] = useState<any>(null);
  
  // Write review state
  const [showWriteReview, setShowWriteReview] = useState(false);
  const [revieweeInfo, setRevieweeInfo] = useState<{
    revieweeId: string;
    revieweeName: string;
    revieweePhoto?: string;
  } | null>(null);
  
  const handleWriteReview = (revieweeId: string, revieweeName: string, revieweePhoto?: string) => {
    setRevieweeInfo({ revieweeId, revieweeName, revieweePhoto });
    setShowWriteReview(true);
  };
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
    } else if (initialSubScreen === 'propose_times') {
      setShowTimeSlotProposal(true);
    }
  }, [initialSubScreen]);

  useEffect(() => {
    // Skip loading data while pursuit is still being fetched
    if (pursuit._loading) return;
    
    checkIfApplied();
    loadCreatorProfile();
    loadNextMeeting();
    checkKickoffEligibility();
    checkProposalStatus();
    checkTeamMembership();
    loadTeamMembers();
    loadInitialKickoffDate();
  }, [pursuit._loading]);

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

      // Fetch privacy preferences for each member
      const membersWithPrivacy = await Promise.all(
        (data || []).map(async (member) => {
          const prefs = await privacyService.getPreferences(member.user_id);
          return {
            ...member,
            privacyPrefs: prefs,
          };
        })
      );

      // Filter: Only show members who have roster visibility enabled
      // Exception: Always show to pod creator/owner or fellow team members
      const viewerIsOwner = isOwner;
      const viewerIsTeamMember = isTeamMember || viewerIsOwner;
      
      const filteredMembers = membersWithPrivacy.filter(member => {
        // Always show to self
        if (member.user_id === user?.id) return true;
        // Always show to owner (creator)
        if (viewerIsOwner) return true;
        // Always show to other team members internally
        if (viewerIsTeamMember) return true;
        // For public viewers, check roster visibility setting
        return member.privacyPrefs?.pod_public_roster_listed !== false;
      });

      setTeamMembers(filteredMembers);
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
                  const creatorName = user?.name || user?.email?.split('@')[0] || 'The creator';
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
    const memberName = member.user?.name || 'this member';
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
          // Fetch user's full name from profile
          const { data: profileData } = await supabase
            .from('profiles')
            .select('name')
            .eq('id', user.id)
            .single();

          const userName = profileData?.name || user.email?.split('@')[0] || 'A team member';
          await notificationService.sendPushNotification(
            [pursuit.creator_id],
            `${userName} left ${pursuit.title}`,
            `${userName} has left your pod.`,
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

  // Show loading state while fetching pursuit data
  if (pursuit._loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <StatusBar barStyle={isNewTheme ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
        {isNewTheme && <GrainTexture opacity={0.06} />}
        <ActivityIndicator size="large" color={isNewTheme ? colors.accentGreen : legacyColors.secondary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>Loading...</Text>
      </View>
    );
  }

  if (showKickoffScheduling) {
    return (
      <KickoffSchedulingScreen
        pursuitId={pursuit.id}
        pursuitTitle={pursuit.title}
        onClose={() => {
          if (fromNotifications && onBackToNotifications) {
            onBackToNotifications();
          } else {
            setShowKickoffScheduling(false);
          }
        }}
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
        onClose={() => {
          if (fromNotifications && onBackToNotifications) {
            onBackToNotifications();
          } else {
            setShowTimeSlotProposal(false);
          }
        }}
        onSubmitted={() => {
          setHasSubmittedProposal(true);
          setShowTimeSlotProposal(false);
        }}
      />
    );
  }

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
        onWriteReview={handleWriteReview}
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
        pursuit={pursuit}
        onBack={() => setShowApplicationsReview(false)}
      />
    );
  }

  if (showPodChat) {
    return (
      <KeyboardAvoidingView 
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <PodChatScreen
          pursuitId={pursuit.id}
          pursuitTitle={pursuit.title}
          podPicture={pursuit.default_picture}
          onBack={() => setShowPodChat(false)}
        />
      </KeyboardAvoidingView>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isNewTheme ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      {isNewTheme && <GrainTexture opacity={0.06} />}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={[styles.backText, { color: isNewTheme ? colors.accentGreen : legacyColors.secondary, fontFamily: isNewTheme ? 'Aboreto_400Regular' : undefined, textTransform: isNewTheme ? 'uppercase' : 'none', letterSpacing: isNewTheme ? 1 : 0 }]}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleRow}>
          <Text style={[styles.title, { color: isNewTheme ? colors.accentGreen : colors.textPrimary, fontFamily: 'NothingYouCouldDo_400Regular' }]}>{pursuit.title}</Text>
          {pursuit.default_picture && (
            <Image
              source={{ uri: pursuit.default_picture }}
              style={[styles.headerPodPicture, { borderColor: isNewTheme ? colors.border : undefined, borderWidth: isNewTheme ? 1 : 0 }]}
            />
          )}
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.creatorSection}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary, fontFamily: isNewTheme ? 'Aboreto_400Regular' : undefined, textTransform: isNewTheme ? 'uppercase' : 'none', letterSpacing: isNewTheme ? 1 : 0 }]}>Created By</Text>
          <TouchableOpacity
            style={[styles.creatorCard, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: isNewTheme ? 1 : 0 }]}
            onPress={() => {
              setSelectedMemberId(pursuit.creator_id);
              setShowUserProfile(true);
            }}
          >
            {creatorProfile?.profile_picture ? (
              <Image source={{ uri: creatorProfile.profile_picture }} style={styles.creatorImage} />
            ) : (
              <View style={[styles.creatorAvatar, { backgroundColor: isNewTheme ? colors.accentGreen : legacyColors.secondary }]}>
                <Text style={[styles.creatorAvatarText, { color: isNewTheme ? colors.background : legacyColors.white }]}>
                  {creatorProfile?.name?.charAt(0).toUpperCase() || '?'}
                </Text>
              </View>
            )}
            <View style={styles.creatorInfo}>
              <Text style={[styles.creatorName, { color: colors.textPrimary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>{creatorProfile?.name || 'Loading...'}</Text>
              <Text style={[styles.viewProfileText, { color: isNewTheme ? colors.accentGreen : legacyColors.secondary, fontFamily: isNewTheme ? 'Aboreto_400Regular' : undefined, textTransform: isNewTheme ? 'uppercase' : 'none', letterSpacing: isNewTheme ? 0.5 : 0 }]}>Tap to view profile →</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Team Members Section */}
        {teamMembers.length > 0 && (
          <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: isNewTheme ? 1 : 0 }]}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary, fontFamily: isNewTheme ? 'Aboreto_400Regular' : undefined, textTransform: isNewTheme ? 'uppercase' : 'none', letterSpacing: isNewTheme ? 1 : 0 }]}>Team Members ({teamMembers.length})</Text>
              {isOwner && (
                <TouchableOpacity
                  style={[styles.editTeamButton, { backgroundColor: isNewTheme ? colors.accentGreen : legacyColors.secondary }]}
                  onPress={() => setShowEditTeamModal(true)}
                >
                  <Text style={[styles.editTeamButtonText, { color: isNewTheme ? colors.background : legacyColors.white, fontFamily: isNewTheme ? 'Aboreto_400Regular' : undefined, textTransform: isNewTheme ? 'uppercase' : 'none', letterSpacing: isNewTheme ? 0.5 : 0 }]}>Edit</Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.membersGrid}>
              {teamMembers.map((member: any) => {
                // Check if profile is clickable
                const isSelf = member.user_id === user?.id;
                const isProfileClickable = isSelf || isOwner || isTeamMember ||
                  member.privacyPrefs?.pod_public_roster_profile_clickable !== false;

                if (isProfileClickable) {
                  return (
                    <TouchableOpacity
                      key={member.user_id}
                      style={[styles.memberCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
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
                        <View style={[styles.memberAvatar, { backgroundColor: isNewTheme ? colors.accentGreen : legacyColors.success }]}>
                          <Text style={[styles.memberAvatarText, { color: isNewTheme ? colors.background : legacyColors.white }]}>
                            {member.user?.name?.charAt(0).toUpperCase() || '?'}
                          </Text>
                        </View>
                      )}
                      <Text style={[styles.memberName, { color: colors.textPrimary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]} numberOfLines={2}>
                        {member.user?.name || 'Team Member'}
                      </Text>
                    </TouchableOpacity>
                  );
                } else {
                  // Non-clickable member card with lock indicator
                  return (
                    <View key={member.user_id} style={[styles.memberCard, styles.memberCardLocked, { backgroundColor: isNewTheme ? colors.surfaceAlt : '#f9fafb', borderColor: colors.border }]}>
                      <View style={styles.memberAvatarLocked}>
                        {member.user?.profile_picture ? (
                          <Image
                            source={{ uri: member.user.profile_picture }}
                            style={[styles.memberImage, styles.memberImageLocked]}
                          />
                        ) : (
                          <View style={[styles.memberAvatar, styles.memberAvatarLockedBg, { backgroundColor: colors.textTertiary }]}>
                            <Text style={[styles.memberAvatarText, { color: isNewTheme ? colors.background : legacyColors.white }]}>
                              {member.user?.name?.charAt(0).toUpperCase() || '?'}
                            </Text>
                          </View>
                        )}
                        <View style={[styles.lockBadge, { backgroundColor: colors.textTertiary, borderColor: isNewTheme ? colors.surfaceAlt : '#f9fafb' }]}>
                          <Ionicons name="lock-closed" size={10} color={isNewTheme ? colors.background : '#fff'} />
                        </View>
                      </View>
                      <Text style={[styles.memberName, styles.memberNameLocked, { color: colors.textTertiary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]} numberOfLines={2}>
                        {member.user?.name || 'Team Member'}
                      </Text>
                    </View>
                  );
                }
              })}
            </View>
          </View>
        )}

        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: isNewTheme ? 1 : 0 }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary, fontFamily: isNewTheme ? 'Aboreto_400Regular' : undefined, textTransform: isNewTheme ? 'uppercase' : 'none', letterSpacing: isNewTheme ? 1 : 0 }]}>Description</Text>
          <Text style={[styles.description, { color: colors.textSecondary, fontFamily: isNewTheme ? 'Magra_400Regular' : undefined }]}>{pursuit.description}</Text>
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: isNewTheme ? 1 : 0 }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary, fontFamily: isNewTheme ? 'Aboreto_400Regular' : undefined, textTransform: isNewTheme ? 'uppercase' : 'none', letterSpacing: isNewTheme ? 1 : 0 }]}>Details</Text>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.textPrimary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>📍 Location:</Text>
            <Text style={[styles.detailValue, { color: colors.textSecondary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>{pursuit.location}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.textPrimary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>📅 Meeting Cadence:</Text>
            <Text style={[styles.detailValue, { color: colors.textSecondary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>{pursuit.meeting_cadence}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.textPrimary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>👥 Team Size:</Text>
            <Text style={[styles.detailValue, { color: colors.textSecondary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>
              {pursuit.current_members_count}/{pursuit.team_size_max} members
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.textPrimary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>Status:</Text>
            <Text style={[styles.detailValue, { color: colors.textSecondary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>
              {pursuit.status === 'awaiting_kickoff' ? '🟡 Awaiting Kickoff' : '🟢 Active'}
            </Text>
          </View>
          {initialKickoffDate && pursuit.status === 'active' && (
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: colors.textPrimary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>🚀 Initial Kick-Off:</Text>
              <Text style={[styles.detailValue, { color: colors.textSecondary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>
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
          <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: isNewTheme ? 1 : 0 }]}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary, fontFamily: isNewTheme ? 'Aboreto_400Regular' : undefined, textTransform: isNewTheme ? 'uppercase' : 'none', letterSpacing: isNewTheme ? 1 : 0 }]}>Pursuit Types</Text>
            <View style={styles.tagContainer}>
              {pursuit.pursuit_types.map((type: string, i: number) => (
                <View key={i} style={[styles.tag, { backgroundColor: isNewTheme ? 'rgba(168, 230, 163, 0.15)' : '#e0f2fe', borderWidth: isNewTheme ? 1 : 0, borderColor: colors.accentGreenMuted }]}>
                  <Text style={[styles.tagText, { color: isNewTheme ? colors.accentGreen : '#0369a1', fontFamily: isNewTheme ? 'Aboreto_400Regular' : undefined, textTransform: isNewTheme ? 'uppercase' : 'none', letterSpacing: isNewTheme ? 0.5 : 0 }]}>{type}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {pursuit.pursuit_categories && pursuit.pursuit_categories.length > 0 && (
          <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: isNewTheme ? 1 : 0 }]}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary, fontFamily: isNewTheme ? 'Aboreto_400Regular' : undefined, textTransform: isNewTheme ? 'uppercase' : 'none', letterSpacing: isNewTheme ? 1 : 0 }]}>Categories</Text>
            <View style={styles.tagContainer}>
              {pursuit.pursuit_categories.map((category: string, i: number) => (
                <View key={i} style={[styles.tag, styles.categoryTag, { backgroundColor: isNewTheme ? 'rgba(129, 140, 248, 0.15)' : '#bae6fd', borderWidth: isNewTheme ? 1 : 0, borderColor: isNewTheme ? colors.primary : undefined }]}>
                  <Text style={[styles.tagText, styles.categoryTagText, { color: isNewTheme ? colors.primary : '#0c4a6e', fontFamily: isNewTheme ? 'Aboreto_400Regular' : undefined, textTransform: isNewTheme ? 'uppercase' : 'none', letterSpacing: isNewTheme ? 0.5 : 0 }]}>{category}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {pursuit.subcategory && (
          <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: isNewTheme ? 1 : 0 }]}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary, fontFamily: isNewTheme ? 'Aboreto_400Regular' : undefined, textTransform: isNewTheme ? 'uppercase' : 'none', letterSpacing: isNewTheme ? 1 : 0 }]}>Sub-category</Text>
            <View style={styles.tagContainer}>
              <View style={[styles.tag, styles.subcategoryTag, { backgroundColor: isNewTheme ? 'rgba(252, 211, 77, 0.15)' : '#ddd6fe', borderWidth: isNewTheme ? 1 : 0, borderColor: isNewTheme ? colors.warning : undefined }]}>
                <Text style={[styles.tagText, styles.subcategoryTagText, { color: isNewTheme ? colors.warning : '#5b21b6', fontFamily: isNewTheme ? 'Aboreto_400Regular' : undefined, textTransform: isNewTheme ? 'uppercase' : 'none', letterSpacing: isNewTheme ? 0.5 : 0 }]}>{pursuit.subcategory}</Text>
              </View>
            </View>
          </View>
        )}

        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: isNewTheme ? 1 : 0 }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary, fontFamily: isNewTheme ? 'Aboreto_400Regular' : undefined, textTransform: isNewTheme ? 'uppercase' : 'none', letterSpacing: isNewTheme ? 1 : 0 }]}>Decision System</Text>
          <Text style={[styles.detailValue, { color: colors.textSecondary, fontFamily: isNewTheme ? 'Magra_400Regular' : undefined }]}>
            {pursuit.decision_system === 'admin_has_ultimate_say'
              ? 'Admin has full control'
              : pursuit.decision_system.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}
          </Text>
        </View>

        {/* Next Meeting Section */}
        {nextMeeting && (
          <View style={[styles.section, styles.nextMeetingSection, { backgroundColor: isNewTheme ? colors.surfaceAlt : '#f0f9ff', borderColor: isNewTheme ? colors.accentGreen : legacyColors.secondary, borderWidth: 2 }]}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary, fontFamily: isNewTheme ? 'Aboreto_400Regular' : undefined, textTransform: isNewTheme ? 'uppercase' : 'none', letterSpacing: isNewTheme ? 1 : 0 }]}>📅 Next Meeting</Text>
            <View style={styles.nextMeetingCard}>
              <Text style={[styles.nextMeetingTitle, { color: colors.textPrimary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>{nextMeeting.title}</Text>
              <Text style={[styles.nextMeetingTime, { color: isNewTheme ? colors.accentGreen : legacyColors.secondary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>
                {new Date(nextMeeting.scheduled_time).toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit'
                })}
              </Text>
              <View style={styles.nextMeetingDetails}>
                <Text style={[styles.nextMeetingDetail, { color: colors.textSecondary, fontFamily: isNewTheme ? 'Magra_400Regular' : undefined }]}>
                  ⏱️ {nextMeeting.duration_minutes} min
                </Text>
                <Text style={[styles.nextMeetingDetail, { color: colors.textSecondary, fontFamily: isNewTheme ? 'Magra_400Regular' : undefined }]}>
                  📍 {nextMeeting.meeting_type === 'video' ? 'Video Call' :
                      nextMeeting.meeting_type === 'in_person' ? 'In Person' : 'Hybrid'}
                </Text>
              </View>
              {nextMeeting.is_kickoff && (
                <View style={[styles.kickoffBadge, { backgroundColor: isNewTheme ? colors.warning : '#f59e0b' }]}>
                  <Text style={[styles.kickoffBadgeText, { color: isNewTheme ? colors.background : legacyColors.white, fontFamily: isNewTheme ? 'Aboreto_400Regular' : undefined, letterSpacing: isNewTheme ? 0.5 : 0 }]}>🚀 KICKOFF MEETING</Text>
                </View>
              )}
              <Text style={[styles.teamBoardPrompt, { color: isNewTheme ? colors.accentGreen : legacyColors.secondary, fontFamily: isNewTheme ? 'Magra_400Regular' : undefined }]}>
                💡 Add your thoughts to the Team Board!
              </Text>
            </View>
          </View>
        )}

        {/* Activate Kickoff Button */}
        {canActivateKickoff && (
          <TouchableOpacity
            style={[styles.activateKickoffButton, { backgroundColor: isNewTheme ? colors.warning : '#f59e0b', shadowColor: isNewTheme ? colors.warning : '#f59e0b' }]}
            onPress={handleActivateKickoff}
          >
            <Text style={[styles.activateKickoffText, { color: isNewTheme ? colors.background : legacyColors.white, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>
              🚀 Activate Kickoff ({pursuit.current_members_count}/{pursuit.team_size_min} members ready)
            </Text>
          </TouchableOpacity>
        )}

        {/* Schedule Kickoff Button (for creator when collecting proposals) */}
        {isOwner && pursuit.status === 'collecting_proposals' && (
          <TouchableOpacity
            style={[styles.scheduleKickoffButton, { backgroundColor: isNewTheme ? colors.accentGreen : legacyColors.success, shadowColor: isNewTheme ? colors.accentGreen : legacyColors.success }]}
            onPress={() => setShowKickoffScheduling(true)}
          >
            <Text style={[styles.scheduleKickoffText, { color: isNewTheme ? colors.background : legacyColors.white, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>
              📅 Review Proposals & Schedule Kickoff
            </Text>
          </TouchableOpacity>
        )}

        {/* Time Slot Proposal Button (for team members) */}
        {!isOwner && isTeamMember && pursuit.status === 'collecting_proposals' && (
          <>
            {hasSubmittedProposal ? (
              <View style={[styles.proposalSubmittedBadge, { backgroundColor: isNewTheme ? 'rgba(168, 230, 163, 0.15)' : '#e0f2fe', borderColor: isNewTheme ? colors.accentGreen : legacyColors.secondary }]}>
                <Text style={[styles.proposalSubmittedText, { color: isNewTheme ? colors.accentGreen : legacyColors.secondary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>✓ Time Proposals Submitted</Text>
                <Text style={[styles.proposalSubmittedSubtext, { color: isNewTheme ? colors.accentGreenMuted : '#0369a1', fontFamily: isNewTheme ? 'Magra_400Regular' : undefined }]}>
                  Waiting for team creator to select final time
                </Text>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.proposeTimesButton, { backgroundColor: isNewTheme ? colors.accentGreen : legacyColors.secondary, shadowColor: isNewTheme ? colors.accentGreen : legacyColors.secondary }]}
                onPress={() => setShowTimeSlotProposal(true)}
              >
                <Text style={[styles.proposeTimesText, { color: isNewTheme ? colors.background : legacyColors.white, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>
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
                style={[styles.editButton, { backgroundColor: isNewTheme ? colors.warning : '#f59e0b' }]}
                onPress={onEdit}
              >
                <Text style={[styles.editButtonText, { color: isNewTheme ? colors.background : legacyColors.white, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>✏️ Edit Pursuit</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.teamBoardButton, { backgroundColor: isNewTheme ? colors.primary : '#8b5cf6' }]}
              onPress={() => onOpenTeamBoard(pursuit.id)}
            >
              <Text style={[styles.teamBoardButtonText, { color: isNewTheme ? colors.background : legacyColors.white, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>📋 Team Board</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.podChatButton, { backgroundColor: isNewTheme ? colors.primaryHover : '#6366f1' }]}
              onPress={() => setShowPodChat(true)}
            >
              <Text style={[styles.podChatButtonText, { color: isNewTheme ? colors.background : legacyColors.white, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>💬 Pod Chat</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.reviewButton, { backgroundColor: isNewTheme ? colors.accentGreen : legacyColors.secondary }]}
              onPress={() => setShowApplicationsReview(true)}
            >
              <Text style={[styles.reviewButtonText, { color: isNewTheme ? colors.background : legacyColors.white, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>📋 Review Applications</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.deleteButton, { backgroundColor: colors.error }]} onPress={onDelete}>
              <Text style={[styles.deleteButtonText, { color: isNewTheme ? colors.background : legacyColors.white, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>🗑️ Delete Pursuit</Text>
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
                    style={[styles.teamBoardButtonMember, { backgroundColor: isNewTheme ? colors.primary : '#8b5cf6', shadowColor: isNewTheme ? colors.primary : '#8b5cf6' }]}
                    onPress={() => onOpenTeamBoard(pursuit.id)}
                  >
                    <Text style={[styles.teamBoardButtonText, { color: isNewTheme ? colors.background : legacyColors.white, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>📋 Team Board</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.podChatButtonMember, { backgroundColor: isNewTheme ? colors.primaryHover : '#6366f1', shadowColor: isNewTheme ? colors.primaryHover : '#6366f1' }]}
                  onPress={() => setShowPodChat(true)}
                >
                  <Text style={[styles.podChatButtonText, { color: isNewTheme ? colors.background : legacyColors.white, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>💬 Pod Chat</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.leavePodButton, { backgroundColor: colors.error, shadowColor: colors.error }]}
                  onPress={() => setShowLeavePodModal(true)}
                >
                  <Text style={[styles.leavePodButtonText, { color: isNewTheme ? colors.background : legacyColors.white, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>🚪 Leave Pod</Text>
                </TouchableOpacity>
              </View>
            ) : hasApplied ? (
              <View style={[styles.appliedBadge, { backgroundColor: isNewTheme ? 'rgba(168, 230, 163, 0.15)' : '#d1fae5', borderColor: isNewTheme ? colors.accentGreen : legacyColors.success }]}>
                <Text style={[styles.appliedText, { color: isNewTheme ? colors.accentGreen : legacyColors.success, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>✓ Application Submitted</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.applyButton, { backgroundColor: isNewTheme ? colors.accentGreen : legacyColors.success, shadowColor: isNewTheme ? colors.accentGreen : legacyColors.success }]}
                onPress={() => setShowApplicationForm(true)}
              >
                <Text style={[styles.applyButtonText, { color: isNewTheme ? colors.background : legacyColors.white, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>🚀 Apply to Join</Text>
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
          style={[styles.modalOverlay, { backgroundColor: isNewTheme ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.5)' }]}
        >
          <View style={[styles.modalContainer, { backgroundColor: colors.surface }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>
                {showRemovalForm ? 'Remove Member' : 'Edit Team Members'}
              </Text>
              <TouchableOpacity
                style={[styles.modalCloseButton, { backgroundColor: isNewTheme ? colors.surfaceAlt : '#f5f5f5' }]}
                onPress={() => {
                  setShowEditTeamModal(false);
                  setMemberToRemove(null);
                  setShowRemovalForm(false);
                  setRemovalReason('');
                  setShareWithMember(false);
                }}
              >
                <Text style={[styles.modalCloseText, { color: colors.textSecondary }]}>✕</Text>
              </TouchableOpacity>
            </View>

            {!showRemovalForm ? (
              // Team members list with remove buttons
              <ScrollView style={styles.modalContent}>
                {teamMembers.map((member: any) => (
                  <View key={member.user_id} style={[styles.editMemberCard, { backgroundColor: isNewTheme ? colors.surfaceAlt : '#f9f9f9' }]}>
                    <View style={styles.editMemberInfo}>
                      {member.user?.profile_picture ? (
                        <Image
                          source={{ uri: member.user.profile_picture }}
                          style={styles.editMemberImage}
                        />
                      ) : (
                        <View style={[styles.editMemberAvatar, { backgroundColor: isNewTheme ? colors.accentGreen : legacyColors.success }]}>
                          <Text style={[styles.editMemberAvatarText, { color: isNewTheme ? colors.background : legacyColors.white }]}>
                            {member.user?.name?.charAt(0).toUpperCase() || '?'}
                          </Text>
                        </View>
                      )}
                      <View style={styles.editMemberDetails}>
                        <Text style={[styles.editMemberName, { color: colors.textPrimary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>
                          {member.user?.name || 'Team Member'}
                        </Text>
                        <Text style={[styles.editMemberEmail, { color: colors.textSecondary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>
                          {member.user?.email}
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={[styles.removeButton, { backgroundColor: colors.error }]}
                      onPress={() => handleRemoveMemberConfirm(member)}
                    >
                      <Text style={[styles.removeButtonText, { color: isNewTheme ? colors.background : legacyColors.white }]}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
                {teamMembers.length === 0 && (
                  <Text style={[styles.noMembersText, { color: colors.textTertiary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>No team members yet</Text>
                )}
              </ScrollView>
            ) : (
              // Removal form
              <ScrollView style={styles.modalContent}>
                <View style={styles.removalForm}>
                  <Text style={[styles.removalMemberName, { color: colors.error, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>
                    Removing: {memberToRemove?.user?.name || 'Team Member'}
                  </Text>

                  <Text style={[styles.removalLabel, { color: colors.textPrimary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>Reason for Removal</Text>
                  <Text style={[styles.removalSubLabel, { color: colors.textSecondary, fontFamily: isNewTheme ? 'Magra_400Regular' : undefined }]}>
                    Please explain why you are removing this member (50 character minimum)
                  </Text>
                  <TextInput
                    style={[styles.removalInput, { backgroundColor: isNewTheme ? colors.surfaceAlt : '#f9f9f9', borderColor: colors.border, color: colors.textPrimary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}
                    value={removalReason}
                    onChangeText={setRemovalReason}
                    placeholder="Enter reason for removal..."
                    placeholderTextColor={colors.textTertiary}
                    multiline
                    numberOfLines={4}
                    spellCheck={true}
                    autoCorrect={true}
                  />
                  <Text style={[
                    styles.characterCount,
                    { color: isNewTheme ? colors.accentGreen : legacyColors.success, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined },
                    removalReason.length < 50 && { color: colors.error }
                  ]}>
                    {removalReason.length}/50 characters minimum
                  </Text>

                  <TouchableOpacity
                    style={styles.checkboxRow}
                    onPress={() => setShareWithMember(!shareWithMember)}
                  >
                    <View style={[styles.checkbox, { borderColor: colors.border }, shareWithMember && { backgroundColor: isNewTheme ? colors.accentGreen : legacyColors.secondary, borderColor: isNewTheme ? colors.accentGreen : legacyColors.secondary }]}>
                      {shareWithMember && <Text style={[styles.checkboxMark, { color: isNewTheme ? colors.background : legacyColors.white }]}>✓</Text>}
                    </View>
                    <Text style={[styles.checkboxLabel, { color: colors.textPrimary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>Share with the member?</Text>
                  </TouchableOpacity>
                  <Text style={[styles.checkboxHint, { color: colors.textSecondary, fontFamily: isNewTheme ? 'Magra_400Regular' : undefined }]}>
                    If checked, the member will receive a notification with your reason
                  </Text>

                  <View style={styles.removalButtons}>
                    <TouchableOpacity
                      style={[styles.cancelRemovalButton, { backgroundColor: isNewTheme ? colors.surfaceAlt : '#f5f5f5' }]}
                      onPress={() => {
                        setMemberToRemove(null);
                        setShowRemovalForm(false);
                        setRemovalReason('');
                        setShareWithMember(false);
                      }}
                    >
                      <Text style={[styles.cancelRemovalText, { color: colors.textSecondary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.confirmRemovalButton,
                        { backgroundColor: colors.error },
                        (removalReason.length < 50 || removingMember) && styles.buttonDisabled
                      ]}
                      onPress={handleRemoveMember}
                      disabled={removalReason.length < 50 || removingMember}
                    >
                      <Text style={[styles.confirmRemovalText, { color: isNewTheme ? colors.background : legacyColors.white, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>
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
          style={[styles.modalOverlay, { backgroundColor: isNewTheme ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.5)' }]}
        >
          <View style={[styles.modalContainer, { backgroundColor: colors.surface }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>Leave Pod</Text>
              <TouchableOpacity
                style={[styles.modalCloseButton, { backgroundColor: isNewTheme ? colors.surfaceAlt : '#f5f5f5' }]}
                onPress={() => {
                  setShowLeavePodModal(false);
                  setLeaveReason('');
                  setShareWithLeader(false);
                }}
              >
                <Text style={[styles.modalCloseText, { color: colors.textSecondary }]}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              <View style={styles.removalForm}>
                <Text style={[styles.leavePodTitle, { color: colors.textPrimary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>
                  Are you sure you want to leave "{pursuit.title}"?
                </Text>

                <Text style={[styles.removalLabel, { color: colors.textPrimary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>Reason for Leaving</Text>
                <Text style={[styles.removalSubLabel, { color: colors.textSecondary, fontFamily: isNewTheme ? 'Magra_400Regular' : undefined }]}>
                  Please explain why you are leaving this pod (50 character minimum)
                </Text>
                <TextInput
                  style={[styles.removalInput, { backgroundColor: isNewTheme ? colors.surfaceAlt : '#f9f9f9', borderColor: colors.border, color: colors.textPrimary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}
                  value={leaveReason}
                  onChangeText={setLeaveReason}
                  placeholder="Enter reason for leaving..."
                  placeholderTextColor={colors.textTertiary}
                  multiline
                  numberOfLines={4}
                  spellCheck={true}
                  autoCorrect={true}
                />
                <Text style={[
                  styles.characterCount,
                  { color: isNewTheme ? colors.accentGreen : legacyColors.success, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined },
                  leaveReason.length < 50 && { color: colors.error }
                ]}>
                  {leaveReason.length}/50 characters minimum
                </Text>

                <TouchableOpacity
                  style={styles.checkboxRow}
                  onPress={() => setShareWithLeader(!shareWithLeader)}
                >
                  <View style={[styles.checkbox, { borderColor: colors.border }, shareWithLeader && { backgroundColor: isNewTheme ? colors.accentGreen : legacyColors.secondary, borderColor: isNewTheme ? colors.accentGreen : legacyColors.secondary }]}>
                    {shareWithLeader && <Text style={[styles.checkboxMark, { color: isNewTheme ? colors.background : legacyColors.white }]}>✓</Text>}
                  </View>
                  <Text style={[styles.checkboxLabel, { color: colors.textPrimary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>Share with the leader?</Text>
                </TouchableOpacity>
                <Text style={[styles.checkboxHint, { color: colors.textSecondary, fontFamily: isNewTheme ? 'Magra_400Regular' : undefined }]}>
                  If checked, the pod creator will receive a notification with your reason
                </Text>

                <View style={styles.removalButtons}>
                  <TouchableOpacity
                    style={[styles.cancelRemovalButton, { backgroundColor: isNewTheme ? colors.surfaceAlt : '#f5f5f5' }]}
                    onPress={() => {
                      setShowLeavePodModal(false);
                      setLeaveReason('');
                      setShareWithLeader(false);
                    }}
                  >
                    <Text style={[styles.cancelRemovalText, { color: colors.textSecondary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.confirmLeaveButton,
                      { backgroundColor: colors.error },
                      (leaveReason.length < 50 || leavingPod) && styles.buttonDisabled
                    ]}
                    onPress={handleLeavePod}
                    disabled={leaveReason.length < 50 || leavingPod}
                  >
                    <Text style={[styles.confirmLeaveText, { color: isNewTheme ? colors.background : legacyColors.white, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>
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
  container: { flex: 1, backgroundColor: legacyColors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: legacyColors.background },
  loadingText: { marginTop: 12, fontSize: 16, color: '#6b7280' },
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
  teamBoardPrompt: { color: '#0ea5e9', fontSize: 14, fontWeight: '600', marginTop: 12, fontStyle: 'italic', textAlign: 'center' },
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
  // Locked member styles
  memberCardLocked: {
    backgroundColor: '#f9fafb',
    borderColor: '#e5e7eb',
  },
  memberAvatarLocked: {
    position: 'relative',
  },
  memberImageLocked: {
    opacity: 0.6,
  },
  memberAvatarLockedBg: {
    backgroundColor: '#9ca3af',
  },
  lockBadge: {
    position: 'absolute',
    bottom: 4,
    right: -4,
    backgroundColor: '#6b7280',
    borderRadius: 10,
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#f9fafb',
  },
  memberNameLocked: {
    color: '#9ca3af',
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
