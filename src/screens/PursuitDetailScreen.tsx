import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Image, Modal, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, StatusBar, Animated } from 'react-native';
import { useTypewriter } from '../hooks/useTypewriter';
import { useStaggerFadeIn } from '../hooks/useStaggerFadeIn';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { applicationService } from '../services/applicationService';
import { meetingService } from '../services/meetingService';
import { notificationService } from '../services/notificationService';
import { privacyService } from '../services/privacyService';
import { supabase } from '../config/supabase';
import PieButton from '../components/ui/PieButton';
import ApplicationScreen from './ApplicationScreen';
import ApplicationsReviewScreen from './ApplicationsReviewScreen';
import UserProfileScreen from './UserProfileScreen';
import TimeSlotProposalScreen from './TimeSlotProposalScreen';
import KickoffSchedulingScreen from './KickoffSchedulingScreen';
import PodChatScreen from './PodChatScreen';
import { colors as legacyColors, typography, spacing } from '../theme/designSystem';
import { useTheme } from '../theme/ThemeContext';
import { getThemedStyles } from '../theme/themedStyles';
import GrainTexture from '../components/ui/GrainTexture';
import LocationMapView from '../components/ui/LocationMapView';
import { AppAlert } from '../components/ui/AppAlert';

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

const LEAVE_POD_REASONS = [
  "I wasn't getting value from it",
  "I didn't get along with the members",
  "I want to try out a different pod",
  "I didn't feel like a fit",
  "I had a lifestyle/schedule conflict",
  "I didn't enjoy how the pod was run / poor leadership",
  "The pod was poorly organized",
  "The meeting cadence or time commitment didn't work",
  "The pod's direction changed and no longer aligns with my goals",
  "I'm stepping back from pods for now",
  "Personal reasons",
  "Other",
];

const REMOVE_MEMBER_REASONS = [
  "Member wasn't aligned with the mission",
  "Member was inactive or not contributing",
  "Member was disruptive to the group dynamic",
  "Member violated pod guidelines or behavior expectations",
  "Skill or experience mismatch for the pod's needs",
  "Member had a schedule or availability conflict",
  "Member repeatedly missed meetings",
  "Personal reasons",
  "Other",
];

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
  const [selectedRemovalReason, setSelectedRemovalReason] = useState<string | null>(null);
  const [shareWithMember, setShareWithMember] = useState(false);
  const [removingMember, setRemovingMember] = useState(false);

  // Leave Pod state (for team members)
  const [showLeavePodModal, setShowLeavePodModal] = useState(false);
  const [leaveReason, setLeaveReason] = useState('');
  const [selectedLeaveReason, setSelectedLeaveReason] = useState<string | null>(null);
  const [shareWithLeader, setShareWithLeader] = useState(false);
  const [leavingPod, setLeavingPod] = useState(false);

  // Pod Chat state
  const [showPodChat, setShowPodChat] = useState(false);

  // Description typewriter — runs in both themes
  const { displayedText: typedDescription, isTyping: descriptionTyping, isComplete: typewriterDone } = useTypewriter({
    text: pursuit.description || '',
    speed: 30,
    startDelay: 400,
    haptic: true,
    hapticInterval: 3,
  });

  const typesCount = pursuit.pursuit_types?.length || 0;
  const categoriesCount = pursuit.pursuit_categories?.length || 0;

  const { opacities: typeOpacities, translateYs: typeTranslateYs } = useStaggerFadeIn({
    itemCount: typesCount,
    startDelay: 1500,
    staggerDelay: 100,
    enabled: !isNewTheme,
  });

  const { opacities: catOpacities, translateYs: catTranslateYs } = useStaggerFadeIn({
    itemCount: categoriesCount,
    startDelay: 1500 + typesCount * 100 + 200,
    staggerDelay: 100,
    enabled: !isNewTheme,
  });

  const detailsOpacity = useRef(new Animated.Value(isNewTheme ? 1 : 0)).current;
  const detailsTranslateY = useRef(new Animated.Value(isNewTheme ? 0 : 20)).current;

  useEffect(() => {
    if (!isNewTheme) {
      Animated.parallel([
        Animated.timing(detailsOpacity, {
          toValue: 1,
          duration: 600,
          delay: 800,
          useNativeDriver: true,
        }),
        Animated.timing(detailsTranslateY, {
          toValue: 0,
          duration: 600,
          delay: 800,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, []);

  // Delete Pursuit state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedTerminationReason, setSelectedTerminationReason] = useState<string | null>(null);
  const [deletingPursuit, setDeletingPursuit] = useState(false);

  const terminationReasons = [
    'No interest from others',
    'I lost interest in the pod',
    'We finished our pod',
    "I couldn't handle the responsibility",
    'I can no longer lead a pod at this time',
    "Unsatisfied with pod's progress",
  ];

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
    AppAlert.alert(
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

              AppAlert.alert('Success!', 'Kickoff activated! Team members will be prompted to propose meeting times.');
              onBack(); // Refresh by going back
            } catch (error: any) {
              console.error('Error activating kickoff:', error);
              AppAlert.alert('Error', error.message || 'Failed to activate kickoff');
            }
          }
        }
      ]
    );
  };

  const handleRemoveMemberConfirm = (member: any) => {
    const memberName = member.user?.name || 'this member';
    // native Alert: fires while Edit Team modal is open
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
    if (!memberToRemove || !selectedRemovalReason) {
      // native Alert: fires while Edit Team modal is open
      Alert.alert('Error', 'Please select a reason for removal');
      return;
    }

    const combinedReason = removalReason.trim()
      ? `${selectedRemovalReason}\n\nDetails: ${removalReason.trim()}`
      : selectedRemovalReason;

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
              removalReason: combinedReason,
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

      // native Alert: fires while Edit Team modal is open (closed below, after this alert)
      Alert.alert('Member Removed', `${memberToRemove.user?.name || 'Member'} has been removed from the pod.`);

      // Reset state
      setMemberToRemove(null);
      setShowRemovalForm(false);
      setRemovalReason('');
      setSelectedRemovalReason(null);
      setShareWithMember(false);
      setShowEditTeamModal(false);

      // Reload team members
      loadTeamMembers();
    } catch (error: any) {
      console.error('Error removing member:', error);
      // native Alert: fires while Edit Team modal is open
      Alert.alert('Error', error.message || 'Failed to remove member');
    } finally {
      setRemovingMember(false);
    }
  };

  const [joiningOpenPod, setJoiningOpenPod] = useState(false);

  const handleJoinOpenPod = async () => {
    if (!user) return;
    if (pursuit.current_members_count >= pursuit.team_size_max) {
      AppAlert.alert('Pod full', 'This pod has reached its maximum team size.');
      return;
    }
    setJoiningOpenPod(true);
    try {
      const { error: memberError } = await supabase
        .from('team_members')
        .upsert(
          { pursuit_id: pursuit.id, user_id: user.id, status: 'accepted' },
          { onConflict: 'pursuit_id,user_id' }
        );
      if (memberError) throw memberError;

      const { error: countError } = await supabase
        .from('pursuits')
        .update({ current_members_count: (pursuit.current_members_count || 0) + 1 })
        .eq('id', pursuit.id);
      if (countError) console.error('Count update error:', countError);

      setIsTeamMember(true);
      AppAlert.alert("you're in! 🐋", `welcome to "${pursuit.title}". get in, loser — we're makin' plans.`);
    } catch (err: any) {
      console.error('Join open pod error:', err);
      AppAlert.alert('Error', err.message || 'Failed to join pod');
    } finally {
      setJoiningOpenPod(false);
    }
  };

  const handleLeavePod = async () => {
    if (!user || !selectedLeaveReason) {
      // native Alert: fires while Leave Pod modal is open
      Alert.alert('Error', 'Please select a reason for leaving');
      return;
    }

    const combinedLeaveReason = leaveReason.trim()
      ? `${selectedLeaveReason}\n\nDetails: ${leaveReason.trim()}`
      : selectedLeaveReason;

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
        // native Alert: fires while Leave Pod modal is open
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
              leaveReason: combinedLeaveReason,
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

      // native Alert: fires while Leave Pod modal is open (closed below, after this alert)
      Alert.alert(
        'Left Pod',
        `You have left ${pursuit.title}.`,
        [{ text: 'OK', onPress: () => onBack() }]
      );

      // Reset state
      setShowLeavePodModal(false);
      setLeaveReason('');
      setSelectedLeaveReason(null);
      setShareWithLeader(false);
    } catch (error: any) {
      console.error('Error leaving pod:', error);
      // native Alert: fires while Leave Pod modal is open
      Alert.alert('Error', error.message || 'Failed to leave pod');
    } finally {
      setLeavingPod(false);
    }
  };

  const handleDeletePursuit = async () => {
    if (!selectedTerminationReason) {
      // native Alert: fires while Delete Pod modal is open
      Alert.alert('Required', 'Please select a reason for pod termination.');
      return;
    }

    setDeletingPursuit(true);
    try {
      // Notify all team members of pod termination
      if (teamMembers.length > 0) {
        try {
          const memberIds = teamMembers.map(m => m.user_id).filter(id => id !== user?.id);
          if (memberIds.length > 0) {
            const creatorName = user?.name || user?.email?.split('@')[0] || 'The pod creator';
            await notificationService.sendPushNotification(
              memberIds,
              `Pod Terminated: ${pursuit.title}`,
              `${creatorName} has terminated the pod. Reason: ${selectedTerminationReason}`,
              {
                type: 'pod_terminated',
                pursuitId: pursuit.id,
                pursuitTitle: pursuit.title,
                terminationReason: selectedTerminationReason,
                terminatedAt: new Date().toISOString()
              },
              'pod_terminated',
              pursuit.id,
              'pursuit'
            );
          }
        } catch (notifError) {
          console.error('Error sending termination notifications:', notifError);
        }
      }

      // Close the modal and call the delete handler
      setShowDeleteModal(false);
      setSelectedTerminationReason(null);
      if (onDelete) onDelete();
    } catch (error: any) {
      console.error('Error deleting pursuit:', error);
      // native Alert: fires while Delete Pod modal is open
      Alert.alert('Error', error.message || 'Failed to delete pursuit');
    } finally {
      setDeletingPursuit(false);
    }
  };

  // Show loading state while fetching pursuit data
  if (pursuit._loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <StatusBar barStyle={isNewTheme ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
        {isNewTheme && <GrainTexture opacity={0.06} />}
        <ActivityIndicator size="large" color={isNewTheme ? colors.accentGreen : '#4B9CD3'} />
        <Text style={[styles.loadingText, { color: colors.textSecondary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>Loading...</Text>
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
    <View style={[styles.container, { backgroundColor: colors.background }]}>
    <ScrollView style={{ flex: 1 }}>
      <StatusBar barStyle={isNewTheme ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      {isNewTheme && <GrainTexture opacity={0.06} />}

      {/* NEW DARK-THEME HERO — full-bleed cover image with title overlay */}
      {isNewTheme ? (
        <View style={styles.heroCoverWrap}>
          {pursuit.cover_image_url ? (
            <Image source={{ uri: pursuit.cover_image_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }]}>
              <View style={[styles.heroCoverPlaceholderDot, { backgroundColor: colors.accentGreen, opacity: 0.3 }]} />
            </View>
          )}
          {/* Bottom darkening for title legibility */}
          <View style={styles.heroCoverGradient} pointerEvents="none" />

          {/* Back chevron (glass) */}
          <TouchableOpacity onPress={onBack} style={styles.heroBackChip} activeOpacity={0.8}>
            <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>

          {/* Edit cover (owner only) — routes to Edit Pursuit screen via the existing edit button on the action bar */}
          {isOwner && pursuit.cover_image_url && (
            <View style={styles.heroEditChip}>
              <Ionicons name="image-outline" size={16} color="#FFFFFF" />
              <Text style={styles.heroEditChipText}>cover</Text>
            </View>
          )}

          {/* Title overlay */}
          <View style={styles.heroTitleOverlay}>
            <Text style={styles.heroTitleText} numberOfLines={3}>
              {pursuit.title}
            </Text>
          </View>
        </View>
      ) : (
        <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={[styles.backText, { color: colors.primary, fontFamily: isNewTheme ? 'Sora_500Medium' : 'InterTight_600SemiBold' }]}>← Back</Text>
          </TouchableOpacity>
          <View style={styles.headerTitleRow}>
            <Text style={[styles.title, { color: colors.textPrimary, fontFamily: isNewTheme ? 'Sora_700Bold' : 'PlayfairDisplay_700Bold' }]}>{pursuit.title}</Text>
            {pursuit.default_picture && (
              <Image
                source={{ uri: pursuit.default_picture }}
                style={styles.headerPodPicture}
              />
            )}
          </View>
        </View>
      )}

      <View style={styles.content}>
        <View style={styles.creatorSection}>
          <Text style={[styles.sectionTitle, isNewTheme && styles.pieSectionLabel, { color: isNewTheme ? 'rgba(255,255,255,0.45)' : colors.textPrimary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold', textTransform: isNewTheme ? 'uppercase' : 'none', letterSpacing: isNewTheme ? 1 : 0 }]}>Created By</Text>
          <TouchableOpacity
            style={[styles.creatorCard, { backgroundColor: colors.surface, borderColor: isNewTheme ? 'rgba(255,255,255,0.08)' : colors.border, borderWidth: isNewTheme ? 1 : 0 }]}
            onPress={() => {
              setSelectedMemberId(pursuit.creator_id);
              setShowUserProfile(true);
            }}
          >
            {creatorProfile?.profile_picture ? (
              <Image source={{ uri: creatorProfile.profile_picture }} style={styles.creatorImage} />
            ) : (
              <View style={[styles.creatorAvatar, { backgroundColor: isNewTheme ? colors.accentGreen : '#4B9CD3' }]}>
                <Text style={[styles.creatorAvatarText, { color: isNewTheme ? colors.background : legacyColors.white }]}>
                  {creatorProfile?.name?.charAt(0).toUpperCase() || '?'}
                </Text>
              </View>
            )}
            <View style={styles.creatorInfo}>
              <Text style={[styles.creatorName, { color: colors.textPrimary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'PlayfairDisplay_700Bold' }]}>{creatorProfile?.name || 'Loading...'}</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Team Members Section */}
        {teamMembers.length > 0 && (
          <View style={[styles.section, { backgroundColor: colors.surface, borderColor: isNewTheme ? 'rgba(255,255,255,0.08)' : colors.border, borderWidth: isNewTheme ? 1 : 0 }]}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, isNewTheme && styles.pieSectionLabel, { color: isNewTheme ? 'rgba(255,255,255,0.45)' : colors.textPrimary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold', textTransform: isNewTheme ? 'uppercase' : 'none', letterSpacing: isNewTheme ? 1 : 0 }]}>Team Members</Text>
              {isOwner && (
                <TouchableOpacity
                  style={styles.editTeamIconButton}
                  onPress={() => setShowEditTeamModal(true)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  accessibilityLabel="Edit team members"
                >
                  <Ionicons name="ellipsis-horizontal" size={22} color={colors.textPrimary} />
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
                        <View style={[styles.memberAvatar, { backgroundColor: isNewTheme ? colors.accentGreen : '#4B9CD3' }]}>
                          <Text style={[styles.memberAvatarText, { color: isNewTheme ? colors.background : legacyColors.white }]}>
                            {member.user?.name?.charAt(0).toUpperCase() || '?'}
                          </Text>
                        </View>
                      )}
                      <Text style={[styles.memberName, { color: colors.textPrimary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'PlayfairDisplay_700Bold' }]} numberOfLines={2}>
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
                      <Text style={[styles.memberName, styles.memberNameLocked, { color: colors.textTertiary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'PlayfairDisplay_700Bold' }]} numberOfLines={2}>
                        {member.user?.name || 'Team Member'}
                      </Text>
                    </View>
                  );
                }
              })}
            </View>
          </View>
        )}

        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: isNewTheme ? 'rgba(255,255,255,0.08)' : colors.border, borderWidth: isNewTheme ? 1 : 0, borderRadius: isNewTheme ? 16 : 16, padding: isNewTheme ? 16 : 20 }]}>
          <Text style={[styles.sectionTitle, isNewTheme && styles.pieSectionLabel, { color: isNewTheme ? 'rgba(255,255,255,0.45)' : colors.textPrimary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold', textTransform: isNewTheme ? 'uppercase' : 'none', letterSpacing: isNewTheme ? 1 : 0.3 }]}>Description</Text>
          <Text style={[styles.description, { color: colors.textSecondary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold', lineHeight: isNewTheme ? 22 : 24 }]}>
            {typedDescription}
            {descriptionTyping && <Text style={{ color: colors.primary, fontWeight: '700' }}>|</Text>}
          </Text>
        </View>

        <Animated.View style={[styles.section, { backgroundColor: colors.surface, borderColor: isNewTheme ? 'rgba(255,255,255,0.08)' : colors.border, borderWidth: isNewTheme ? 1 : 0, borderRadius: isNewTheme ? 16 : 16, padding: isNewTheme ? 16 : 20, opacity: detailsOpacity, transform: [{ translateY: detailsTranslateY }], overflow: 'hidden' }]}>
          <Text style={[styles.sectionTitle, isNewTheme && styles.pieSectionLabel, { color: isNewTheme ? 'rgba(255,255,255,0.45)' : colors.textPrimary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold', textTransform: isNewTheme ? 'uppercase' : 'none', letterSpacing: isNewTheme ? 1 : 0.3 }]}>Details</Text>

          {/* Location - conditional display based on membership */}
          {(isTeamMember || isOwner) && pursuit.address ? (
            <>
              <View style={styles.detailRowModern}>
                <View style={[styles.detailIconPill, { backgroundColor: isNewTheme ? 'rgba(168, 230, 163, 0.15)' : 'rgba(75, 156, 211, 0.10)' }]}>
                  <Ionicons name="navigate-outline" size={14} color={colors.accentGreen} />
                </View>
                <View style={styles.detailTextGroup}>
                  <Text style={[styles.detailLabelModern, { color: colors.textPrimary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>Address</Text>
                  <Text style={[styles.detailValueModern, { color: colors.textPrimary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>{pursuit.address}</Text>
                </View>
              </View>
              {pursuit.latitude && pursuit.longitude && (
                <LocationMapView
                  latitude={pursuit.latitude}
                  longitude={pursuit.longitude}
                  interactive={false}
                  style={{ marginBottom: 12, marginTop: 4 }}
                />
              )}
              {pursuit.neighborhood && (
                <View style={styles.detailRowModern}>
                  <View style={[styles.detailIconPill, { backgroundColor: isNewTheme ? 'rgba(168, 230, 163, 0.15)' : 'rgba(75, 156, 211, 0.10)' }]}>
                    <Ionicons name="map-outline" size={14} color={colors.accentGreen} />
                  </View>
                  <View style={styles.detailTextGroup}>
                    <Text style={[styles.detailLabelModern, { color: colors.textPrimary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>Neighborhood</Text>
                    <Text style={[styles.detailValueModern, { color: colors.textPrimary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>{pursuit.neighborhood}</Text>
                  </View>
                </View>
              )}
              <View style={styles.detailRowModern}>
                <View style={[styles.detailIconPill, { backgroundColor: isNewTheme ? 'rgba(168, 230, 163, 0.15)' : 'rgba(75, 156, 211, 0.10)' }]}>
                  <Ionicons name="location-outline" size={14} color={colors.accentGreen} />
                </View>
                <View style={styles.detailTextGroup}>
                  <Text style={[styles.detailLabelModern, { color: colors.textPrimary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>Location</Text>
                  <Text style={[styles.detailValueModern, { color: colors.textPrimary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>{pursuit.location}</Text>
                </View>
              </View>
            </>
          ) : (
            <>
              <View style={styles.detailRowModern}>
                <View style={[styles.detailIconPill, { backgroundColor: isNewTheme ? 'rgba(168, 230, 163, 0.15)' : 'rgba(75, 156, 211, 0.10)' }]}>
                  <Ionicons name="location-outline" size={14} color={colors.accentGreen} />
                </View>
                <View style={styles.detailTextGroup}>
                  <Text style={[styles.detailLabelModern, { color: colors.textPrimary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>Location</Text>
                  <Text style={[styles.detailValueModern, { color: colors.textPrimary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>{pursuit.location}</Text>
                </View>
              </View>
              {pursuit.neighborhood && (
                <View style={styles.detailRowModern}>
                  <View style={[styles.detailIconPill, { backgroundColor: isNewTheme ? 'rgba(168, 230, 163, 0.15)' : 'rgba(75, 156, 211, 0.10)' }]}>
                    <Ionicons name="map-outline" size={14} color={colors.accentGreen} />
                  </View>
                  <View style={styles.detailTextGroup}>
                    <Text style={[styles.detailLabelModern, { color: colors.textPrimary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>Neighborhood</Text>
                    <Text style={[styles.detailValueModern, { color: colors.textPrimary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>{pursuit.neighborhood}</Text>
                  </View>
                </View>
              )}
              {pursuit.address && (
                <View style={styles.detailRowModern}>
                  <View style={[styles.detailIconPill, { backgroundColor: 'rgba(138, 138, 133, 0.1)' }]}>
                    <Ionicons name="lock-closed-outline" size={14} color={colors.textTertiary} />
                  </View>
                  <View style={styles.detailTextGroup}>
                    <Text style={[styles.detailValueModern, { color: colors.textTertiary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold', fontStyle: 'italic', fontSize: 15 }]}>
                      Exact location visible to pod members
                    </Text>
                  </View>
                </View>
              )}
            </>
          )}

          <View style={styles.detailRowModern}>
            <View style={[styles.detailIconPill, { backgroundColor: isNewTheme ? 'rgba(168, 230, 163, 0.15)' : 'rgba(75, 156, 211, 0.10)' }]}>
              <Ionicons name="calendar-outline" size={14} color={colors.accentGreen} />
            </View>
            <View style={styles.detailTextGroup}>
              <Text style={[styles.detailLabelModern, { color: colors.textPrimary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>Meeting Cadence</Text>
              <Text style={[styles.detailValueModern, { color: colors.textPrimary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>{pursuit.meeting_cadence}</Text>
            </View>
          </View>

          <View style={styles.detailRowModern}>
            <View style={[styles.detailIconPill, { backgroundColor: isNewTheme ? 'rgba(168, 230, 163, 0.15)' : 'rgba(75, 156, 211, 0.10)' }]}>
              <Ionicons name="people-outline" size={14} color={colors.accentGreen} />
            </View>
            <View style={styles.detailTextGroup}>
              <Text style={[styles.detailLabelModern, { color: colors.textPrimary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>Team Size</Text>
              <Text style={[styles.detailValueModern, { color: colors.textPrimary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>
                {pursuit.current_members_count}/{pursuit.team_size_max} members
              </Text>
            </View>
          </View>

          <View style={styles.detailRowModern}>
            <View style={[styles.detailIconPill, { backgroundColor: pursuit.status === 'active' ? 'rgba(134, 239, 172, 0.2)' : 'rgba(252, 211, 77, 0.2)' }]}>
              <Ionicons name="pulse-outline" size={14} color={pursuit.status === 'active' ? colors.success : colors.warning} />
            </View>
            <View style={styles.detailTextGroup}>
              <Text style={[styles.detailLabelModern, { color: colors.textPrimary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>Status</Text>
              <View style={[styles.detailStatusPill, { backgroundColor: pursuit.status === 'active' ? 'rgba(134, 239, 172, 0.15)' : 'rgba(252, 211, 77, 0.15)' }]}>
                <Text style={[styles.detailStatusText, { color: pursuit.status === 'active' ? colors.success : colors.warning, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>
                  {pursuit.status === 'awaiting_kickoff' ? 'Awaiting Kickoff' : 'Active'}
                </Text>
              </View>
            </View>
          </View>

          {initialKickoffDate && pursuit.status === 'active' && (
            <View style={styles.detailRowModern}>
              <View style={[styles.detailIconPill, { backgroundColor: isNewTheme ? 'rgba(168, 230, 163, 0.15)' : 'rgba(75, 156, 211, 0.10)' }]}>
                <Ionicons name="rocket-outline" size={14} color={colors.accentGreen} />
              </View>
              <View style={styles.detailTextGroup}>
                <Text style={[styles.detailLabelModern, { color: colors.textPrimary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>Initial Kick-Off</Text>
                <Text style={[styles.detailValueModern, { color: colors.textPrimary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>
                  {initialKickoffDate.toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </Text>
              </View>
            </View>
          )}
        </Animated.View>

        {/* Dark mode: one quiet chip cluster instead of three boxed, shouting tag
            sections. Lowercase micro-chips matching the feed card — lime tint for
            types, barely-there white for categories/sub-category. */}
        {isNewTheme && ((pursuit.pursuit_types?.length ?? 0) > 0 || (pursuit.pursuit_categories?.length ?? 0) > 0 || pursuit.subcategory) && (
          <View style={[styles.section, { backgroundColor: colors.surface, borderColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderRadius: 16, padding: 16 }]}>
            <View style={styles.pieChipCluster}>
              {(pursuit.pursuit_types || []).map((type: string, i: number) => (
                <View key={`t-${i}`} style={[styles.pieChip, { backgroundColor: 'rgba(200, 255, 107, 0.10)', borderColor: 'rgba(200, 255, 107, 0.25)' }]}>
                  <Text style={[styles.pieChipText, { color: colors.accentGreen }]}>{type.toLowerCase()}</Text>
                </View>
              ))}
              {(pursuit.pursuit_categories || []).map((category: string, i: number) => (
                <View key={`c-${i}`} style={[styles.pieChip, { backgroundColor: 'rgba(255, 255, 255, 0.06)', borderColor: 'rgba(255, 255, 255, 0.10)' }]}>
                  <Text style={[styles.pieChipText, { color: colors.textSecondary }]}>{category.toLowerCase()}</Text>
                </View>
              ))}
              {pursuit.subcategory && (
                <View style={[styles.pieChip, { backgroundColor: 'rgba(255, 255, 255, 0.06)', borderColor: 'rgba(255, 255, 255, 0.10)' }]}>
                  <Text style={[styles.pieChipText, { color: colors.textSecondary }]}>{pursuit.subcategory.toLowerCase()}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {!isNewTheme && pursuit.pursuit_types && pursuit.pursuit_types.length > 0 && (
          <View style={[styles.section, { backgroundColor: colors.surface, borderColor: isNewTheme ? 'rgba(255,255,255,0.08)' : colors.border, borderWidth: isNewTheme ? 1 : 0, borderRadius: isNewTheme ? 16 : 16, padding: isNewTheme ? 16 : 20 }]}>
            <Text style={[styles.sectionTitle, isNewTheme && styles.pieSectionLabel, { color: isNewTheme ? 'rgba(255,255,255,0.45)' : colors.textPrimary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold', textTransform: isNewTheme ? 'uppercase' : 'none', letterSpacing: isNewTheme ? 1 : 0.3 }]}>Pod Types</Text>
            <View style={styles.tagContainer}>
              {pursuit.pursuit_types.map((type: string, i: number) => {
                const tagView = (
                  <View key={i} style={[styles.tag, { backgroundColor: isNewTheme ? 'rgba(168, 230, 163, 0.15)' : 'transparent', borderWidth: 1, borderColor: isNewTheme ? colors.accentGreenMuted : colors.border }]}>
                    <Text style={[styles.tagText, { color: isNewTheme ? colors.accentGreen : '#1B1B18', fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold', textTransform: isNewTheme ? 'uppercase' : 'lowercase', letterSpacing: isNewTheme ? 0.5 : 0.3, fontSize: isNewTheme ? 15 : 11 }]}>{type}</Text>
                  </View>
                );
                if (!isNewTheme && typeOpacities[i]) {
                  return (
                    <Animated.View key={i} style={{ opacity: typeOpacities[i], transform: [{ translateY: typeTranslateYs[i] }] }}>
                      {React.cloneElement(tagView, { key: undefined })}
                    </Animated.View>
                  );
                }
                return tagView;
              })}
            </View>
          </View>
        )}

        {!isNewTheme && pursuit.pursuit_categories && pursuit.pursuit_categories.length > 0 && (
          <View style={[styles.section, { backgroundColor: colors.surface, borderColor: isNewTheme ? 'rgba(255,255,255,0.08)' : colors.border, borderWidth: isNewTheme ? 1 : 0, borderRadius: isNewTheme ? 16 : 16, padding: isNewTheme ? 16 : 20 }]}>
            <Text style={[styles.sectionTitle, isNewTheme && styles.pieSectionLabel, { color: isNewTheme ? 'rgba(255,255,255,0.45)' : colors.textPrimary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold', textTransform: isNewTheme ? 'uppercase' : 'none', letterSpacing: isNewTheme ? 1 : 0.3 }]}>Categories</Text>
            <View style={styles.tagContainer}>
              {pursuit.pursuit_categories.map((category: string, i: number) => {
                const tagView = (
                  <View key={i} style={[styles.tag, styles.categoryTag, { backgroundColor: isNewTheme ? 'rgba(129, 140, 248, 0.15)' : 'transparent', borderWidth: 1, borderColor: isNewTheme ? colors.primary : colors.border }]}>
                    <Text style={[styles.tagText, styles.categoryTagText, { color: isNewTheme ? colors.primary : '#1B1B18', fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold', textTransform: isNewTheme ? 'uppercase' : 'lowercase', letterSpacing: isNewTheme ? 0.5 : 0.3, fontSize: isNewTheme ? 15 : 11 }]}>{category}</Text>
                  </View>
                );
                if (!isNewTheme && catOpacities[i]) {
                  return (
                    <Animated.View key={i} style={{ opacity: catOpacities[i], transform: [{ translateY: catTranslateYs[i] }] }}>
                      {React.cloneElement(tagView, { key: undefined })}
                    </Animated.View>
                  );
                }
                return tagView;
              })}
            </View>
          </View>
        )}

        {!isNewTheme && pursuit.subcategory && (
          <View style={[styles.section, { backgroundColor: colors.surface, borderColor: isNewTheme ? 'rgba(255,255,255,0.08)' : colors.border, borderWidth: isNewTheme ? 1 : 0, borderRadius: isNewTheme ? 16 : 16, padding: isNewTheme ? 16 : 20 }]}>
            <Text style={[styles.sectionTitle, isNewTheme && styles.pieSectionLabel, { color: isNewTheme ? 'rgba(255,255,255,0.45)' : colors.textPrimary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold', textTransform: isNewTheme ? 'uppercase' : 'none', letterSpacing: isNewTheme ? 1 : 0.3 }]}>Sub-category</Text>
            <View style={styles.tagContainer}>
              <View style={[styles.tag, styles.subcategoryTag, { backgroundColor: isNewTheme ? 'rgba(252, 211, 77, 0.15)' : 'transparent', borderWidth: 1, borderColor: isNewTheme ? colors.warning : colors.border }]}>
                <Text style={[styles.tagText, styles.subcategoryTagText, { color: isNewTheme ? colors.warning : '#1B1B18', fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold', textTransform: isNewTheme ? 'uppercase' : 'lowercase', letterSpacing: isNewTheme ? 0.5 : 0.3, fontSize: isNewTheme ? 15 : 11 }]}>{pursuit.subcategory}</Text>
              </View>
            </View>
          </View>
        )}

        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: isNewTheme ? 'rgba(255,255,255,0.08)' : colors.border, borderWidth: isNewTheme ? 1 : 0, borderRadius: isNewTheme ? 16 : 16, padding: isNewTheme ? 16 : 20 }]}>
          <Text style={[styles.sectionTitle, isNewTheme && styles.pieSectionLabel, { color: isNewTheme ? 'rgba(255,255,255,0.45)' : colors.textPrimary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold', textTransform: isNewTheme ? 'uppercase' : 'none', letterSpacing: isNewTheme ? 1 : 0.3 }]}>Decision System</Text>
          <Text style={[styles.detailValue, { color: colors.textSecondary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>
            {pursuit.decision_system === 'admin_has_ultimate_say'
              ? 'Admin has full control'
              : pursuit.decision_system.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}
          </Text>
        </View>

        {/* Next Meeting Section */}
        {nextMeeting && (
          <View style={[styles.section, styles.nextMeetingSection, { backgroundColor: isNewTheme ? colors.surfaceAlt : '#FFFFFF', borderColor: isNewTheme ? colors.accentGreen : '#4B9CD3', borderWidth: 1 }]}>
            <Text style={[styles.sectionTitle, isNewTheme && styles.pieSectionLabel, { color: isNewTheme ? 'rgba(255,255,255,0.45)' : colors.textPrimary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold', textTransform: isNewTheme ? 'uppercase' : 'none', letterSpacing: isNewTheme ? 1 : 0 }]}>Next Meeting</Text>
            <View style={styles.nextMeetingCard}>
              <Text style={[styles.nextMeetingTitle, { color: colors.textPrimary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'PlayfairDisplay_700Bold' }]}>{nextMeeting.title}</Text>
              <Text style={[styles.nextMeetingTime, { color: isNewTheme ? colors.accentGreen : '#2E6A95', fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>
                {new Date(nextMeeting.scheduled_time).toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit'
                })}
              </Text>
              <View style={styles.nextMeetingDetails}>
                <Text style={[styles.nextMeetingDetail, { color: colors.textSecondary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>
                  ⏱️ {nextMeeting.duration_minutes} min
                </Text>
                <Text style={[styles.nextMeetingDetail, { color: colors.textSecondary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>
                  📍 {nextMeeting.meeting_type === 'video' ? 'Video Call' :
                      nextMeeting.meeting_type === 'in_person' ? 'In Person' : 'Hybrid'}
                </Text>
              </View>
              {nextMeeting.is_kickoff && (
                <View style={[styles.kickoffBadge, { backgroundColor: isNewTheme ? colors.warning : '#f59e0b' }]}>
                  <Text style={[styles.kickoffBadgeText, { color: isNewTheme ? colors.background : legacyColors.white, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold', letterSpacing: isNewTheme ? 0.5 : 0 }]}>🚀 KICKOFF MEETING</Text>
                </View>
              )}
              <Text style={[styles.teamBoardPrompt, { color: isNewTheme ? colors.accentGreen : '#2E6A95', fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>
                💡 Add your thoughts to the Team Board!
              </Text>
            </View>
          </View>
        )}

        {/* Activate Kickoff Button */}
        {canActivateKickoff && (
          isNewTheme ? (
            <View style={{ paddingHorizontal: 4, paddingTop: 4, paddingBottom: 8 }}>
              <PieButton
                label={`activate kickoff · ${pursuit.current_members_count}/${pursuit.team_size_min} ready`}
                icon="rocket-outline"
                iconPosition="left"
                onPress={handleActivateKickoff}
                full
              />
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.activateKickoffButton, { backgroundColor: '#f59e0b', shadowColor: '#f59e0b' }]}
              onPress={handleActivateKickoff}
            >
              <Text style={[styles.activateKickoffText, { color: legacyColors.white }]}>
                🚀 Activate Kickoff ({pursuit.current_members_count}/{pursuit.team_size_min} members ready)
              </Text>
            </TouchableOpacity>
          )
        )}

        {/* Schedule Kickoff Button (for creator when collecting proposals) */}
        {isOwner && pursuit.status === 'collecting_proposals' && (
          isNewTheme ? (
            <View style={{ paddingHorizontal: 4, paddingTop: 4, paddingBottom: 8 }}>
              <PieButton
                label="review times & schedule kickoff"
                icon="calendar-outline"
                iconPosition="left"
                onPress={() => setShowKickoffScheduling(true)}
                full
              />
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.scheduleKickoffButton, { backgroundColor: '#1B1B18', shadowColor: '#1B1B18' }]}
              onPress={() => setShowKickoffScheduling(true)}
            >
              <Text style={[styles.scheduleKickoffText, { color: legacyColors.white }]}>
                📅 Review Proposals & Schedule Kickoff
              </Text>
            </TouchableOpacity>
          )
        )}

        {/* Time Slot Proposal Button (for team members) */}
        {!isOwner && isTeamMember && pursuit.status === 'collecting_proposals' && (
          <>
            {hasSubmittedProposal ? (
              isNewTheme ? (
                <View style={{ paddingHorizontal: 4, paddingTop: 4, paddingBottom: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 16, backgroundColor: 'rgba(200, 255, 107, 0.10)', borderWidth: 1, borderColor: 'rgba(200, 255, 107, 0.25)' }}>
                    <Ionicons name="checkmark-circle" size={20} color={colors.accentGreen} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.accentGreen, fontFamily: 'Sora_600SemiBold', fontSize: 14 }}>times sent ✓</Text>
                      <Text style={{ color: colors.textSecondary, fontFamily: 'Sora_600SemiBold', fontSize: 12, marginTop: 2 }}>chillin' till the creator picks the slot</Text>
                    </View>
                  </View>
                </View>
              ) : (
                <View style={[styles.proposalSubmittedBadge, { backgroundColor: 'rgba(75, 156, 211, 0.10)', borderColor: '#4B9CD3' }]}>
                  <Text style={[styles.proposalSubmittedText, { color: '#2E6A95' }]}>✓ Time Proposals Submitted</Text>
                  <Text style={[styles.proposalSubmittedSubtext, { color: '#52524E' }]}>
                    Waiting for team creator to select final time
                  </Text>
                </View>
              )
            ) : (
              isNewTheme ? (
                <View style={{ paddingHorizontal: 4, paddingTop: 4, paddingBottom: 8 }}>
                  <PieButton label="drop your times" icon="calendar-outline" iconPosition="left" onPress={() => setShowTimeSlotProposal(true)} full />
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.proposeTimesButton, { backgroundColor: '#1B1B18', shadowColor: '#1B1B18' }]}
                  onPress={() => setShowTimeSlotProposal(true)}
                >
                  <Text style={[styles.proposeTimesText, { color: legacyColors.white }]}>
                    📅 Propose Available Times
                  </Text>
                </TouchableOpacity>
              )
            )}
          </>
        )}

        {isOwner && onOpenTeamBoard && (
          isNewTheme ? (
            <View style={{ paddingHorizontal: 4, paddingTop: 4, gap: 10 }}>
              <PieButton label="team board" icon="grid-outline" iconPosition="left" onPress={() => onOpenTeamBoard(pursuit.id)} full />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <PieButton label="pod chat" icon="chatbubble-outline" iconPosition="left" variant="secondary" size="md" onPress={() => setShowPodChat(true)} style={{ flex: 1 }} />
                <PieButton label="applications" icon="documents-outline" iconPosition="left" variant="secondary" size="md" onPress={() => setShowApplicationsReview(true)} style={{ flex: 1 }} />
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {onEdit && (
                  <PieButton label="edit" icon="pencil" iconPosition="left" variant="ghost" size="md" onPress={onEdit} style={{ flex: 1 }} />
                )}
                <PieButton label="delete" icon="trash-outline" iconPosition="left" variant="destructive" size="md" onPress={() => setShowDeleteModal(true)} style={{ flex: 1 }} />
              </View>
            </View>
          ) : (
            <View style={styles.ownerActions}>
              {onEdit && (
                <TouchableOpacity
                  style={[styles.editButton, { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#1B1B18' }]}
                  onPress={onEdit}
                >
                  <Text style={[styles.editButtonText, { color: '#1B1B18' }]}>✏️ Edit Pod</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.teamBoardButton, { backgroundColor: '#1B1B18' }]}
                onPress={() => onOpenTeamBoard(pursuit.id)}
              >
                <Text style={[styles.teamBoardButtonText, { color: legacyColors.white }]}>📋 Team Board</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.podChatButton, { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#1B1B18' }]}
                onPress={() => setShowPodChat(true)}
              >
                <Text style={[styles.podChatButtonText, { color: '#1B1B18' }]}>💬 Pod Chat</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.reviewButton, { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#1B1B18' }]}
                onPress={() => setShowApplicationsReview(true)}
              >
                <Text style={[styles.reviewButtonText, { color: '#1B1B18' }]}>📋 Review Applications</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.deleteButton, { backgroundColor: colors.error }]} onPress={() => setShowDeleteModal(true)}>
                <Text style={[styles.deleteButtonText, { color: legacyColors.white }]}>🗑️ Delete Pod</Text>
              </TouchableOpacity>
            </View>
          )
        )}

        {!isOwner && (
          <>
            {isTeamMember ? (
              isNewTheme ? (
                <View style={{ paddingHorizontal: 4, paddingTop: 4, gap: 10 }}>
                  {onOpenTeamBoard && (
                    <PieButton label="team board" icon="grid-outline" iconPosition="left" onPress={() => onOpenTeamBoard(pursuit.id)} full />
                  )}
                  <PieButton label="pod chat" icon="chatbubble-outline" iconPosition="left" variant="secondary" size="md" onPress={() => setShowPodChat(true)} full />
                  <PieButton label="leave pod" icon="exit-outline" iconPosition="left" variant="destructive" size="md" onPress={() => setShowLeavePodModal(true)} full />
                </View>
              ) : (
                <View style={styles.teamMemberActions}>
                  {onOpenTeamBoard && (
                    <TouchableOpacity
                      style={[styles.teamBoardButtonMember, { backgroundColor: '#1B1B18', shadowColor: '#1B1B18' }]}
                      onPress={() => onOpenTeamBoard(pursuit.id)}
                    >
                      <Text style={[styles.teamBoardButtonText, { color: legacyColors.white }]}>📋 Team Board</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[styles.podChatButtonMember, { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#1B1B18', shadowColor: 'transparent', shadowOpacity: 0, elevation: 0 }]}
                    onPress={() => setShowPodChat(true)}
                  >
                    <Text style={[styles.podChatButtonText, { color: '#1B1B18' }]}>💬 Pod Chat</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.leavePodButton, { backgroundColor: colors.error, shadowColor: colors.error }]}
                    onPress={() => setShowLeavePodModal(true)}
                  >
                    <Text style={[styles.leavePodButtonText, { color: legacyColors.white }]}>🚪 Leave Pod</Text>
                  </TouchableOpacity>
                </View>
              )
            ) : hasApplied ? (
              <View style={[styles.appliedBadge, { backgroundColor: isNewTheme ? 'rgba(168, 230, 163, 0.15)' : '#d1fae5', borderColor: isNewTheme ? colors.accentGreen : legacyColors.success }]}>
                <Text style={[styles.appliedText, { color: isNewTheme ? colors.accentGreen : legacyColors.success, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>✓ Application Submitted</Text>
              </View>
            ) : pursuit.is_open_pod ? (
              isNewTheme ? (
                <View style={{ paddingHorizontal: 4, paddingTop: 4 }}>
                  <PieButton
                    label={joiningOpenPod ? 'joining…' : 'join pod'}
                    icon="arrow-forward"
                    onPress={handleJoinOpenPod}
                    loading={joiningOpenPod}
                    full
                  />
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.applyButton, { backgroundColor: '#1B1B18', shadowColor: '#1B1B18', opacity: joiningOpenPod ? 0.6 : 1 }]}
                  onPress={handleJoinOpenPod}
                  disabled={joiningOpenPod}
                >
                  <Text style={[styles.applyButtonText, { color: legacyColors.white, fontFamily: 'InterTight_600SemiBold' }]}>
                    {joiningOpenPod ? 'Joining…' : 'Join Pod — Open'}
                  </Text>
                </TouchableOpacity>
              )
            ) : (
              isNewTheme ? (
                <View style={{ paddingHorizontal: 4, paddingTop: 4 }}>
                  <PieButton label="apply to join" icon="arrow-forward" onPress={() => setShowApplicationForm(true)} full />
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.applyButton, { backgroundColor: '#1B1B18', shadowColor: '#1B1B18' }]}
                  onPress={() => setShowApplicationForm(true)}
                >
                  <Text style={[styles.applyButtonText, { color: legacyColors.white, fontFamily: 'InterTight_600SemiBold' }]}>Apply to Join</Text>
                </TouchableOpacity>
              )
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
          setSelectedRemovalReason(null);
          setShareWithMember(false);
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={[styles.modalOverlay, { backgroundColor: isNewTheme ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.5)' }]}
        >
          <View style={[styles.modalContainer, { backgroundColor: colors.surface }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'PlayfairDisplay_700Bold' }]}>
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
                        <View style={[styles.editMemberAvatar, { backgroundColor: isNewTheme ? colors.accentGreen : '#4B9CD3' }]}>
                          <Text style={[styles.editMemberAvatarText, { color: isNewTheme ? colors.background : legacyColors.white }]}>
                            {member.user?.name?.charAt(0).toUpperCase() || '?'}
                          </Text>
                        </View>
                      )}
                      <View style={styles.editMemberDetails}>
                        <Text style={[styles.editMemberName, { color: colors.textPrimary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'PlayfairDisplay_700Bold' }]}>
                          {member.user?.name || 'Team Member'}
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
                  <Text style={[styles.noMembersText, { color: colors.textTertiary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>No team members yet</Text>
                )}
              </ScrollView>
            ) : (
              // Removal form
              <ScrollView style={styles.modalContent}>
                <View style={styles.removalForm}>
                  <Text style={[styles.removalMemberName, { color: colors.error, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'PlayfairDisplay_700Bold' }]}>
                    Removing: {memberToRemove?.user?.name || 'Team Member'}
                  </Text>

                  <Text style={[styles.removalLabel, { color: colors.textPrimary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>Reason for Removal</Text>
                  <Text style={[styles.removalSubLabel, { color: colors.textSecondary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>
                    Pick the reason that best fits.
                  </Text>
                  <View style={{ marginBottom: 16 }}>
                    {REMOVE_MEMBER_REASONS.map((r) => {
                      const selected = selectedRemovalReason === r;
                      return (
                        <TouchableOpacity
                          key={r}
                          onPress={() => setSelectedRemovalReason(r)}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            paddingVertical: 10,
                            paddingHorizontal: 12,
                            borderRadius: 10,
                            marginBottom: 6,
                            backgroundColor: selected ? (isNewTheme ? 'rgba(168, 230, 163, 0.15)' : 'rgba(75, 156, 211, 0.10)') : (isNewTheme ? colors.surfaceAlt : '#f9f9f9'),
                            borderWidth: 1,
                            borderColor: selected ? (isNewTheme ? colors.accentGreen : legacyColors.primary) : 'transparent',
                          }}
                          activeOpacity={0.7}
                        >
                          <View style={{
                            width: 18, height: 18, borderRadius: 9, borderWidth: 2,
                            borderColor: selected ? (isNewTheme ? colors.accentGreen : legacyColors.primary) : colors.border,
                            alignItems: 'center', justifyContent: 'center', marginRight: 10,
                          }}>
                            {selected && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: isNewTheme ? colors.accentGreen : legacyColors.primary }} />}
                          </View>
                          <Text style={{ flex: 1, color: colors.textPrimary, fontSize: 14, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }}>
                            {r}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <Text style={[styles.removalLabel, { color: colors.textPrimary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>Add details (optional)</Text>
                  <TextInput
                    style={[styles.removalInput, { backgroundColor: isNewTheme ? colors.surfaceAlt : '#f9f9f9', borderColor: colors.border, color: colors.textPrimary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}
                    value={removalReason}
                    onChangeText={setRemovalReason}
                    placeholder="Any additional context you'd like to add…"
                    placeholderTextColor={colors.textTertiary}
                    multiline
                    numberOfLines={4}
                    spellCheck={true}
                    autoCorrect={true}
                  />

                  <TouchableOpacity
                    style={styles.checkboxRow}
                    onPress={() => setShareWithMember(!shareWithMember)}
                  >
                    <View style={[styles.checkbox, { borderColor: colors.border }, shareWithMember && { backgroundColor: isNewTheme ? colors.accentGreen : '#4B9CD3', borderColor: isNewTheme ? colors.accentGreen : '#4B9CD3' }]}>
                      {shareWithMember && <Text style={[styles.checkboxMark, { color: isNewTheme ? colors.background : legacyColors.white }]}>✓</Text>}
                    </View>
                    <Text style={[styles.checkboxLabel, { color: colors.textPrimary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>Share with the member?</Text>
                  </TouchableOpacity>
                  <Text style={[styles.checkboxHint, { color: colors.textSecondary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>
                    If checked, the member will receive a notification with your reason
                  </Text>

                  <View style={styles.removalButtons}>
                    <TouchableOpacity
                      style={[styles.cancelRemovalButton, { backgroundColor: isNewTheme ? colors.surfaceAlt : '#f5f5f5' }]}
                      onPress={() => {
                        setMemberToRemove(null);
                        setShowRemovalForm(false);
                        setRemovalReason('');
                        setSelectedRemovalReason(null);
                        setShareWithMember(false);
                      }}
                    >
                      <Text style={[styles.cancelRemovalText, { color: colors.textSecondary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.confirmRemovalButton,
                        { backgroundColor: colors.error },
                        (!selectedRemovalReason || removingMember) && styles.buttonDisabled
                      ]}
                      onPress={handleRemoveMember}
                      disabled={!selectedRemovalReason || removingMember}
                    >
                      <Text style={[styles.confirmRemovalText, { color: isNewTheme ? colors.background : legacyColors.white, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>
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
          setSelectedLeaveReason(null);
          setShareWithLeader(false);
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={[styles.modalOverlay, { backgroundColor: isNewTheme ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.5)' }]}
        >
          <View style={[styles.modalContainer, { backgroundColor: colors.surface }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'PlayfairDisplay_700Bold' }]}>Leave Pod</Text>
              <TouchableOpacity
                style={[styles.modalCloseButton, { backgroundColor: isNewTheme ? colors.surfaceAlt : '#f5f5f5' }]}
                onPress={() => {
                  setShowLeavePodModal(false);
                  setLeaveReason('');
                  setSelectedLeaveReason(null);
                  setShareWithLeader(false);
                }}
              >
                <Text style={[styles.modalCloseText, { color: colors.textSecondary }]}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              <View style={styles.removalForm}>
                <Text style={[styles.leavePodTitle, { color: colors.textPrimary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'PlayfairDisplay_700Bold' }]}>
                  Are you sure you want to leave "{pursuit.title}"?
                </Text>

                <Text style={[styles.removalLabel, { color: colors.textPrimary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>Reason for Leaving</Text>
                <Text style={[styles.removalSubLabel, { color: colors.textSecondary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>
                  Pick the reason that best fits.
                </Text>
                <View style={{ marginBottom: 16 }}>
                  {LEAVE_POD_REASONS.map((r) => {
                    const selected = selectedLeaveReason === r;
                    return (
                      <TouchableOpacity
                        key={r}
                        onPress={() => setSelectedLeaveReason(r)}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          paddingVertical: 10,
                          paddingHorizontal: 12,
                          borderRadius: 10,
                          marginBottom: 6,
                          backgroundColor: selected ? (isNewTheme ? 'rgba(168, 230, 163, 0.15)' : 'rgba(75, 156, 211, 0.10)') : (isNewTheme ? colors.surfaceAlt : '#f9f9f9'),
                          borderWidth: 1,
                          borderColor: selected ? (isNewTheme ? colors.accentGreen : legacyColors.primary) : 'transparent',
                        }}
                        activeOpacity={0.7}
                      >
                        <View style={{
                          width: 18, height: 18, borderRadius: 9, borderWidth: 2,
                          borderColor: selected ? (isNewTheme ? colors.accentGreen : legacyColors.primary) : colors.border,
                          alignItems: 'center', justifyContent: 'center', marginRight: 10,
                        }}>
                          {selected && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: isNewTheme ? colors.accentGreen : legacyColors.primary }} />}
                        </View>
                        <Text style={{ flex: 1, color: colors.textPrimary, fontSize: 14, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }}>
                          {r}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={[styles.removalLabel, { color: colors.textPrimary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>Add details (optional)</Text>
                <TextInput
                  style={[styles.removalInput, { backgroundColor: isNewTheme ? colors.surfaceAlt : '#f9f9f9', borderColor: colors.border, color: colors.textPrimary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}
                  value={leaveReason}
                  onChangeText={setLeaveReason}
                  placeholder="Any additional context you'd like to add…"
                  placeholderTextColor={colors.textTertiary}
                  multiline
                  numberOfLines={4}
                  spellCheck={true}
                  autoCorrect={true}
                />

                <TouchableOpacity
                  style={styles.checkboxRow}
                  onPress={() => setShareWithLeader(!shareWithLeader)}
                >
                  <View style={[styles.checkbox, { borderColor: colors.border }, shareWithLeader && { backgroundColor: isNewTheme ? colors.accentGreen : '#4B9CD3', borderColor: isNewTheme ? colors.accentGreen : '#4B9CD3' }]}>
                    {shareWithLeader && <Text style={[styles.checkboxMark, { color: isNewTheme ? colors.background : legacyColors.white }]}>✓</Text>}
                  </View>
                  <Text style={[styles.checkboxLabel, { color: colors.textPrimary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>Share with the leader?</Text>
                </TouchableOpacity>
                <Text style={[styles.checkboxHint, { color: colors.textSecondary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>
                  If checked, the pod creator will receive a notification with your reason
                </Text>

                <View style={styles.removalButtons}>
                  <TouchableOpacity
                    style={[styles.cancelRemovalButton, { backgroundColor: isNewTheme ? colors.surfaceAlt : '#f5f5f5' }]}
                    onPress={() => {
                      setShowLeavePodModal(false);
                      setLeaveReason('');
                      setSelectedLeaveReason(null);
                      setShareWithLeader(false);
                    }}
                  >
                    <Text style={[styles.cancelRemovalText, { color: colors.textSecondary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.confirmLeaveButton,
                      { backgroundColor: colors.error },
                      (!selectedLeaveReason || leavingPod) && styles.buttonDisabled
                    ]}
                    onPress={handleLeavePod}
                    disabled={!selectedLeaveReason || leavingPod}
                  >
                    <Text style={[styles.confirmLeaveText, { color: isNewTheme ? colors.background : legacyColors.white, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>
                      {leavingPod ? 'Leaving...' : 'Leave Pod'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Delete Pursuit Confirmation Modal */}
      <Modal
        visible={showDeleteModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setShowDeleteModal(false);
          setSelectedTerminationReason(null);
        }}
      >
        <View style={[styles.modalOverlay, { backgroundColor: isNewTheme ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.5)' }]}>
          <View style={[styles.modalContainer, { backgroundColor: colors.surface }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.error, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'PlayfairDisplay_700Bold' }]}>
                Delete Pod
              </Text>
              <TouchableOpacity
                style={[styles.modalCloseButton, { backgroundColor: isNewTheme ? colors.surfaceAlt : '#f5f5f5' }]}
                onPress={() => {
                  setShowDeleteModal(false);
                  setSelectedTerminationReason(null);
                }}
              >
                <Text style={[styles.modalCloseText, { color: colors.textSecondary }]}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              <Text style={[styles.deleteConfirmTitle, { color: colors.textPrimary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'PlayfairDisplay_700Bold' }]}>
                Are you sure you want to delete this pod?
              </Text>

              {teamMembers.length > 0 && (
                <Text style={[styles.deleteConfirmWarning, { color: colors.error, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>
                  Are members aware and have they signed off on this pod termination?
                </Text>
              )}

              <Text style={[styles.deleteReasonLabel, { color: colors.textPrimary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>
                Select a reason for Pod termination:
              </Text>

              {terminationReasons.map((reason) => (
                <TouchableOpacity
                  key={reason}
                  style={[
                    styles.terminationReasonOption,
                    { borderColor: colors.border, backgroundColor: isNewTheme ? colors.surfaceAlt : '#f9f9f9' },
                    selectedTerminationReason === reason && {
                      borderColor: colors.error,
                      backgroundColor: isNewTheme ? 'rgba(239, 68, 68, 0.1)' : '#fef2f2',
                    },
                  ]}
                  onPress={() => setSelectedTerminationReason(reason)}
                >
                  <View style={[
                    styles.terminationRadio,
                    { borderColor: colors.border },
                    selectedTerminationReason === reason && { borderColor: colors.error },
                  ]}>
                    {selectedTerminationReason === reason && (
                      <View style={[styles.terminationRadioFill, { backgroundColor: colors.error }]} />
                    )}
                  </View>
                  <Text style={[
                    styles.terminationReasonText,
                    { color: colors.textPrimary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' },
                    selectedTerminationReason === reason && { fontWeight: '700' },
                  ]}>
                    {reason}
                  </Text>
                </TouchableOpacity>
              ))}

              {teamMembers.length > 0 && (
                <Text style={[styles.deleteNoticeText, { color: colors.textSecondary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>
                  Members will be notified of pod termination.
                </Text>
              )}

              <View style={styles.deleteModalButtons}>
                <TouchableOpacity
                  style={[styles.cancelRemovalButton, { backgroundColor: isNewTheme ? colors.surfaceAlt : '#f5f5f5' }]}
                  onPress={() => {
                    setShowDeleteModal(false);
                    setSelectedTerminationReason(null);
                  }}
                >
                  <Text style={[styles.cancelRemovalText, { color: colors.textSecondary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.confirmDeleteButton,
                    { backgroundColor: colors.error },
                    (!selectedTerminationReason || deletingPursuit) && styles.buttonDisabled,
                  ]}
                  onPress={handleDeletePursuit}
                  disabled={!selectedTerminationReason || deletingPursuit}
                >
                  <Text style={[styles.confirmDeleteText, { color: isNewTheme ? colors.background : legacyColors.white, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>
                    {deletingPursuit ? 'Deleting...' : 'Delete Pod'}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  // ===== Pie-style hero cover =====
  heroCoverWrap: {
    width: '100%',
    aspectRatio: 16 / 12,
    backgroundColor: '#000',
    position: 'relative',
  },
  heroCoverGradient: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    height: '55%', backgroundColor: 'rgba(0,0,0,0.55)',
  },
  heroCoverPlaceholderDot: {
    width: 60, height: 60, borderRadius: 30,
  },
  heroBackChip: {
    position: 'absolute', top: 56, left: 16,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center',
  },
  heroEditChip: {
    position: 'absolute', top: 56, right: 16,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  heroEditChipText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
  heroTitleOverlay: {
    position: 'absolute', left: 18, right: 18, bottom: 18,
  },
  heroTitleText: {
    color: '#FFFFFF',
    fontFamily: 'InterTight_600SemiBold',
    fontSize: 32, lineHeight: 36, letterSpacing: -0.5,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 8,
  },
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
  creatorName: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 4 },
  viewProfileText: { fontSize: 14, color: '#0ea5e9', fontWeight: '600' },
  section: { backgroundColor: '#fff', borderRadius: 12, padding: 18, marginBottom: 15, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: '#333', marginBottom: 14 },
  // Dark-mode de-shouted section label — quiet, tracked, secondary white
  pieSectionLabel: { fontSize: 12, fontWeight: '600', letterSpacing: 1, marginBottom: 10 },
  description: { fontSize: 17, color: '#666', lineHeight: 26 },
  detailRow: { marginBottom: 12 },
  detailLabel: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 4 },
  detailValue: { fontSize: 16, color: '#666' },
  detailCardAccentLine: { position: 'absolute', top: 0, left: 0, bottom: 0, width: 3 },
  detailDotDivider: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4, marginTop: 10, marginBottom: 14 },
  detailDotDividerDot: { width: 3, height: 3, borderRadius: 1.5, opacity: 0.6 },
  detailRowModern: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14 },
  detailIconPill: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginRight: 12, marginTop: 1 },
  detailTextGroup: { flex: 1, justifyContent: 'center' },
  detailLabelModern: { fontSize: 13, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 4 },
  detailValueModern: { fontSize: 16, fontWeight: '500', lineHeight: 22 },
  detailStatusPill: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, marginTop: 4 },
  detailStatusText: { fontSize: 14, fontWeight: '600', letterSpacing: 0.3 },
  tagContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  // Dark-mode micro-chips (mirrors the feed card's pieTag look)
  pieChipCluster: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pieChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pieChipText: {
    fontSize: 13,
    fontFamily: 'Sora_600SemiBold',
    letterSpacing: 0.2,
  },
  tag: { backgroundColor: '#e0f2fe', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16 },
  tagText: { color: '#0369a1', fontSize: 15, fontWeight: '500' },
  categoryTag: { backgroundColor: '#bae6fd' },
  categoryTagText: { color: '#0c4a6e' },
  subcategoryTag: { backgroundColor: '#ddd6fe' },
  subcategoryTagText: { color: '#5b21b6' },
  ownerActions: { marginTop: 20, gap: 12 },
  editButton: { backgroundColor: '#f59e0b', borderRadius: 8, padding: 16, alignItems: 'center' },
  editButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  teamBoardButton: { backgroundColor: '#2D5016', borderRadius: 8, padding: 16, alignItems: 'center' },
  teamBoardButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  podChatButton: { backgroundColor: '#2D5016', borderRadius: 8, padding: 16, alignItems: 'center' },
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
  editTeamIconButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
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
    backgroundColor: '#2D5016',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#2D5016',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  podChatButtonMember: {
    backgroundColor: '#2D5016',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#2D5016',
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
  // Delete pursuit modal styles
  deleteConfirmTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  deleteConfirmWarning: {
    fontSize: 14,
    color: '#ef4444',
    marginBottom: 20,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  deleteReasonLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
  },
  terminationReasonOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    marginBottom: 8,
  },
  terminationRadio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#ddd',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  terminationRadioFill: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#ef4444',
  },
  terminationReasonText: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  deleteNoticeText: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 8,
    fontStyle: 'italic',
  },
  deleteModalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    paddingBottom: 20,
  },
  confirmDeleteButton: {
    flex: 1,
    backgroundColor: '#ef4444',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  confirmDeleteText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
});
