import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, TouchableOpacity, Text, StyleSheet, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { notificationService } from './src/services/notificationService';
import { messageService } from './src/services/messageService';
import { supabase } from './src/config/supabase';
import NotificationToast from './src/components/NotificationToast';
import LoginScreen from './src/screens/LoginScreen';
import FeedScreen from './src/screens/FeedScreen';
import CreateScreen from './src/screens/CreateScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import UserProfileScreen from './src/screens/UserProfileScreen';
import MessagesListScreen, { getLocallyReadMessageCount } from './src/screens/MessagesListScreen';
import ChatScreen from './src/screens/ChatScreen';
import TeamWorkspaceScreen from './src/screens/team/TeamWorkspaceScreen';
import PodsScreen from './src/screens/PodsScreen';
import CalendarScreen from './src/screens/CalendarScreen';
import CreateMeetingScreen from './src/screens/CreateMeetingScreen';
import MeetingDetailScreen from './src/screens/MeetingDetailScreen';
import ConnectionsScreen from './src/screens/connections/ConnectionsScreen';
import PursuitDetailScreen from './src/screens/PursuitDetailScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import EditPursuitScreen from './src/screens/EditPursuitScreen';
import VideoCallScreen from './src/screens/VideoCallScreen';
import RemovalReasonScreen from './src/screens/RemovalReasonScreen';
import MemberLeftScreen from './src/screens/MemberLeftScreen';
import MeetingInvitationScreen from './src/screens/MeetingInvitationScreen';
import InterviewTimeSlotProposalScreen from './src/screens/InterviewTimeSlotProposalScreen';
import InterviewSchedulingScreen from './src/screens/InterviewSchedulingScreen';
import WriteReviewScreen from './src/screens/WriteReviewScreen';
import { AGORA_APP_ID } from './src/services/agoraService';

function AppContent() {
  const auth = useAuth();
  const [currentScreen, setCurrentScreen] = useState('Feed');
  const [chatPartnerId, setChatPartnerId] = useState<string | null>(null);
  const [chatPartnerEmail, setChatPartnerEmail] = useState<string | null>(null);
  const [teamBoardPursuitId, setTeamBoardPursuitId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showCreateMeeting, setShowCreateMeeting] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<any | null>(null);
  const [editingPursuit, setEditingPursuit] = useState<any | null>(null);
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);
  const [showConnections, setShowConnections] = useState(false);
  const [viewingPodDetail, setViewingPodDetail] = useState<any | null>(null);
  const [podDetailSubScreen, setPodDetailSubScreen] = useState<string | null>(null);
  const [videoCallChannel, setVideoCallChannel] = useState<string | null>(null);
  const [videoCallPodTitle, setVideoCallPodTitle] = useState<string>('');
  const [viewingRemovalReason, setViewingRemovalReason] = useState<{
    pursuitTitle: string;
    reason: string;
    removedAt: string;
  } | null>(null);
  const [viewingMemberLeft, setViewingMemberLeft] = useState<{
    pursuitTitle: string;
    memberName: string;
    reason: string;
    leftAt: string;
  } | null>(null);
  const [viewingMeetingInvitation, setViewingMeetingInvitation] = useState<string | null>(null);
  const [viewingInterviewProposal, setViewingInterviewProposal] = useState<{
    applicationId: string;
    pursuitId: string;
    pursuitTitle: string;
  } | null>(null);
  const [viewingInterviewScheduling, setViewingInterviewScheduling] = useState<{
    applicationId: string;
    pursuitId: string;
    pursuitTitle: string;
    applicantId: string;
    applicantName: string;
  } | null>(null);
  const [viewingWriteReview, setViewingWriteReview] = useState<{
    revieweeId: string;
    revieweeName: string;
    revieweePhoto?: string;
  } | null>(null);
  const [badgeCounts, setBadgeCounts] = useState({
    messages: 0,
    connections: 0,
    applications: 0,
    pods: 0,
    calendar: 0,
    notifications: 0,
  });
  const [currentToast, setCurrentToast] = useState<any>(null);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [locallyReadCount, setLocallyReadCount] = useState(0);

  // Load notification badge counts and set up real-time listener
  useEffect(() => {
    if (auth.user) {
      loadBadgeCounts();

      // Check for unread notifications on login and show most recent one
      checkForUnreadNotifications();

      console.log('🔔 Setting up realtime notification listener for user:', auth.user.id);

      // Set up real-time listener for new notifications
      const channel = supabase
        .channel('notifications')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${auth.user.id}`,
          },
          (payload) => {
            console.log('🔔 NEW NOTIFICATION RECEIVED VIA REALTIME:', payload);
            const newNotification = payload.new as any;

            // Don't show toast for message notifications (those only show badge)
            if (newNotification.type !== 'message' && newNotification.type !== 'new_message') {
              // Show toast - include data for navigation
              setCurrentToast({
                title: newNotification.title,
                body: newNotification.body,
                type: newNotification.type,
                id: newNotification.id,
                data: newNotification.data, // Include data for interview navigation
              });
            }

            // Refresh badge counts
            loadBadgeCounts();
          }
        )
        .subscribe((status, err) => {
          console.log('🔔 Realtime subscription status:', status);
          if (err) {
            console.error('🔔 Realtime subscription error:', err);
          }
          if (status === 'SUBSCRIBED') {
            console.log('🔔 Successfully subscribed to notifications channel');
          }
        });

      // Refresh counts every 30 seconds as backup
      const interval = setInterval(loadBadgeCounts, 30000);

      return () => {
        console.log('🔔 Cleaning up realtime subscription');
        supabase.removeChannel(channel);
        clearInterval(interval);
      };
    }
  }, [auth.user]);

  // Listen for interview scheduling requests (fallback for when notification insert fails)
  useEffect(() => {
    if (auth.user) {
      console.log('🎤 Setting up interview request listener for applicant:', auth.user.id);

      const interviewChannel = supabase
        .channel('interview-requests')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'pursuit_applications',
            filter: `applicant_id=eq.${auth.user.id}`,
          },
          async (payload) => {
            console.log('🎤 APPLICATION UPDATE RECEIVED:', payload);
            const updatedApp = payload.new as any;
            const oldApp = payload.old as any;

            // Check if status changed to interview_pending
            if (updatedApp.status === 'interview_pending' && oldApp.status !== 'interview_pending') {
              console.log('🎤 Interview scheduling requested! Showing toast...');

              // Fetch pursuit title for the toast
              try {
                const { data: pursuitData } = await supabase
                  .from('pursuits')
                  .select('title, creator_id, profiles:creator_id(name, email)')
                  .eq('id', updatedApp.pursuit_id)
                  .single();

                const creatorProfile = pursuitData?.profiles as any;
                const creatorName = creatorProfile?.name || creatorProfile?.email?.split('@')[0] || 'The creator';
                const pursuitTitle = pursuitData?.title || 'a pursuit';

                // Show toast notification
                setCurrentToast({
                  title: `${creatorName} wants to schedule an interview`,
                  body: `Propose your available times for "${pursuitTitle}"`,
                  type: 'interview_scheduling_requested',
                  id: updatedApp.id,
                });
              } catch (error) {
                console.error('Error fetching pursuit info for toast:', error);
                // Show generic toast
                setCurrentToast({
                  title: 'Interview Request',
                  body: 'A creator wants to schedule an interview with you',
                  type: 'interview_scheduling_requested',
                  id: updatedApp.id,
                });
              }
            }
          }
        )
        .subscribe((status, err) => {
          console.log('🎤 Interview requests subscription status:', status);
          if (err) {
            console.error('🎤 Interview requests subscription error:', err);
          }
          if (status === 'SUBSCRIBED') {
            console.log('🎤 Successfully subscribed to interview requests');
          }
        });

      return () => {
        console.log('🎤 Cleaning up interview requests subscription');
        supabase.removeChannel(interviewChannel);
      };
    }
  }, [auth.user]);

  // Listen for interview times submitted (for creators to see when applicants submit availability)
  useEffect(() => {
    if (auth.user) {
      console.log('🎤 Setting up interview times listener for creator:', auth.user.id);

      // We need to listen to all pursuit_applications updates and filter by pursuits we created
      const interviewTimesChannel = supabase
        .channel('interview-times-submitted')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'pursuit_applications',
          },
          async (payload) => {
            const updatedApp = payload.new as any;
            const oldApp = payload.old as any;

            // Check if status changed to interview_times_submitted
            if (updatedApp.status === 'interview_times_submitted' && oldApp.status !== 'interview_times_submitted') {
              console.log('🎤 Interview times submitted detected:', updatedApp);

              try {
                // Check if current user is the creator of this pursuit
                const { data: pursuitData } = await supabase
                  .from('pursuits')
                  .select('title, creator_id')
                  .eq('id', updatedApp.pursuit_id)
                  .single();

                if (pursuitData?.creator_id === auth.user?.id) {
                  console.log('🎤 Current user is creator - showing toast');

                  // Fetch applicant name
                  const { data: applicantData } = await supabase
                    .from('profiles')
                    .select('name, email')
                    .eq('id', updatedApp.applicant_id)
                    .single();

                  const applicantName = applicantData?.name || applicantData?.email?.split('@')[0] || 'An applicant';
                  const pursuitTitle = pursuitData?.title || 'a pursuit';

                  // Show toast notification with data for navigation
                  setCurrentToast({
                    title: `${applicantName} submitted interview times`,
                    body: `Review their availability for "${pursuitTitle}"`,
                    type: 'interview_times_submitted',
                    id: updatedApp.id,
                    data: {
                      applicationId: updatedApp.id,
                      pursuitId: updatedApp.pursuit_id,
                    },
                  });
                }
              } catch (error) {
                console.error('Error processing interview times submitted:', error);
              }
            }
          }
        )
        .subscribe((status, err) => {
          console.log('🎤 Interview times submitted subscription status:', status);
          if (err) {
            console.error('🎤 Interview times submitted subscription error:', err);
          }
          if (status === 'SUBSCRIBED') {
            console.log('🎤 Successfully subscribed to interview times submitted');
          }
        });

      return () => {
        console.log('🎤 Cleaning up interview times submitted subscription');
        supabase.removeChannel(interviewTimesChannel);
      };
    }
  }, [auth.user]);

  // Load unread message count and set up real-time listener for messages
  useEffect(() => {
    if (auth.user) {
      loadUnreadMessageCount();

      console.log('💬 Setting up realtime messages listener for user:', auth.user.id);

      // Set up real-time listener for new messages
      const messagesChannel = supabase
        .channel('messages-badge')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `recipient_id=eq.${auth.user.id}`,
          },
          (payload) => {
            console.log('💬 NEW MESSAGE RECEIVED:', payload);
            // Refresh unread count when a new message arrives
            loadUnreadMessageCount();
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'messages',
            filter: `recipient_id=eq.${auth.user.id}`,
          },
          (payload) => {
            console.log('💬 MESSAGE UPDATED:', payload);
            // Refresh unread count when messages are marked as read
            loadUnreadMessageCount();
          }
        )
        .subscribe((status, err) => {
          console.log('💬 Messages subscription status:', status);
          if (err) {
            console.error('💬 Messages subscription error:', err);
          }
        });

      // Refresh count every 30 seconds as backup
      const interval = setInterval(loadUnreadMessageCount, 30000);

      return () => {
        console.log('💬 Cleaning up messages subscription');
        supabase.removeChannel(messagesChannel);
        clearInterval(interval);
      };
    }
  }, [auth.user]);

  const loadUnreadMessageCount = async () => {
    if (!auth.user) return;

    try {
      const count = await messageService.getUnreadCount(auth.user.id);
      console.log('💬 Unread message count:', count);
      setUnreadMessageCount(count);
    } catch (error) {
      console.error('Error loading unread message count:', error);
    }
  };

  const checkForUnreadNotifications = async () => {
    if (!auth.user) return;

    try {
      // Get the most recent unread notification
      const notifications = await notificationService.getUserNotifications(auth.user.id);
      // Filter out message notifications - those only show badges, not toasts
      const unreadNotifications = notifications.filter((n: any) =>
        !n.read && n.type !== 'message' && n.type !== 'new_message'
      );

      if (unreadNotifications.length > 0) {
        const mostRecent = unreadNotifications[0];
        console.log('🔔 Found unread notification on login:', mostRecent);

        // Show toast for most recent unread notification
        setCurrentToast({
          title: mostRecent.title,
          body: mostRecent.body,
          type: mostRecent.type,
          id: mostRecent.id,
        });
      }
    } catch (error) {
      console.error('Error checking for unread notifications:', error);
    }
  };

  const loadBadgeCounts = async () => {
    if (!auth.user) return;

    try {
      const counts = await notificationService.getUnreadCountsByType(auth.user.id);
      const totalUnread = await notificationService.getUnreadCount(auth.user.id);
      setBadgeCounts({
        ...counts,
        notifications: totalUnread,
      });
    } catch (error) {
      console.error('Error loading badge counts:', error);
    }
  };

  const clearBadgeForTab = async (tab: string) => {
    if (!auth.user) return;

    // Map tab to notification types
    const typeMap: { [key: string]: string[] } = {
      'Messages': ['message', 'new_message'],
      'Pods': ['min_team_size_reached', 'kickoff_activated', 'time_proposal', 'team_board_update'],
      'Calendar': ['kickoff_scheduled', 'kickoff_scheduled_creator', 'kickoff_scheduled_team', 'meeting', 'new_meeting', 'meeting_invitation'],
      'Profile': ['connection_request', 'connection_accepted'],
    };

    const types = typeMap[tab];
    if (types) {
      for (const type of types) {
        await notificationService.markAllAsReadByType(auth.user.id, type);
      }
      loadBadgeCounts();
    }
  };

  // Fetch data needed for interview proposal screen
  const fetchInterviewProposalData = async (applicationId: string, pursuitId: string) => {
    try {
      const { data, error } = await supabase
        .from('pursuits')
        .select('title')
        .eq('id', pursuitId)
        .single();

      if (error) throw error;

      setViewingInterviewProposal({
        applicationId,
        pursuitId,
        pursuitTitle: data?.title || 'Pursuit',
      });
    } catch (error) {
      console.error('Error fetching interview proposal data:', error);
    }
  };

  // Fetch data needed for interview scheduling screen
  const fetchInterviewSchedulingData = async (applicationId: string, pursuitId: string) => {
    try {
      // Fetch application and pursuit data
      const { data: appData, error: appError } = await supabase
        .from('pursuit_applications')
        .select(`
          applicant_id,
          applicant:profiles!applicant_id(
            name,
            email
          )
        `)
        .eq('id', applicationId)
        .single();

      if (appError) throw appError;

      const { data: pursuitData, error: pursuitError } = await supabase
        .from('pursuits')
        .select('title')
        .eq('id', pursuitId)
        .single();

      if (pursuitError) throw pursuitError;

      const applicantProfile = appData?.applicant as any;
      setViewingInterviewScheduling({
        applicationId,
        pursuitId,
        pursuitTitle: pursuitData?.title || 'Pursuit',
        applicantId: appData?.applicant_id || '',
        applicantName: applicantProfile?.name || applicantProfile?.email || 'Applicant',
      });
    } catch (error) {
      console.error('Error fetching interview scheduling data:', error);
    }
  };

  if (auth.loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#0ea5e9" />
      </View>
    );
  }

  if (!auth.user) {
    return <LoginScreen />;
  }

  // Navigation object to pass to screens
  const navigation = {
    navigate: (screen: string, params?: any) => {
      if (screen === 'UserProfile' && params?.userId) {
        setViewingUserId(params.userId);
        // Don't clear chat state - when going back, user returns to chat
      } else if (screen === 'Connections') {
        setShowConnections(true);
      } else if (screen === 'Chat' && params?.partnerId) {
        setChatPartnerId(params.partnerId);
        setChatPartnerEmail(params.partnerEmail || 'User');
        setCurrentScreen('Messages');
      } else if (screen === 'Profile') {
        setCurrentScreen('Profile');
        setViewingUserId(null);
      } else if (screen === 'PodDetail' && params?.pod) {
        setViewingPodDetail(params.pod);
        setPodDetailSubScreen(params.subScreen || null);
        setCurrentScreen('Pods');
      } else if (screen === 'TeamBoard' && params?.pursuitId) {
        setTeamBoardPursuitId(params.pursuitId);
      } else if (screen === 'Pods') {
        setCurrentScreen('Pods');
      } else if (screen === 'Calendar') {
        setCurrentScreen('Calendar');
      } else if (screen === 'Messages') {
        setCurrentScreen('Messages');
      } else if (screen === 'RemovalReason' && params) {
        setViewingRemovalReason({
          pursuitTitle: params.pursuitTitle,
          reason: params.reason,
          removedAt: params.removedAt,
        });
      } else if (screen === 'MemberLeft' && params) {
        setViewingMemberLeft({
          pursuitTitle: params.pursuitTitle,
          memberName: params.memberName,
          reason: params.reason,
          leftAt: params.leftAt,
        });
      } else if (screen === 'MeetingInvitation' && params?.meetingId) {
        setViewingMeetingInvitation(params.meetingId);
      } else if (screen === 'InterviewTimeSlotProposal' && params?.applicationId) {
        // Need to fetch pursuit info for the interview proposal screen
        fetchInterviewProposalData(params.applicationId, params.pursuitId);
      } else if (screen === 'InterviewScheduling' && params?.applicationId) {
        // Need to fetch pursuit and applicant info for the interview scheduling screen
        fetchInterviewSchedulingData(params.applicationId, params.pursuitId);
      } else if (screen === 'WriteReview') {
        console.log('🖊️ Navigating to WriteReview with params:', params);
        if (params?.revieweeId) {
          setViewingWriteReview({
            revieweeId: params.revieweeId,
            revieweeName: params.revieweeName || 'User',
            revieweePhoto: params.revieweePhoto,
          });
        } else {
          Alert.alert('Error', 'Cannot write review - user ID missing');
        }
      }
    },
    goBack: () => {
      setViewingUserId(null);
      setShowConnections(false);
      // Chat state preserved - if returning from profile, chat will show again
    },
    replace: (screen: string) => {
      if (screen === 'Profile') {
        setCurrentScreen('Profile');
        setViewingUserId(null);
      }
    },
  };

  // Show Create Pursuit screen as modal
  if (showCreate) {
    return (
      <View style={{ flex: 1 }}>
        <CreateScreen onClose={() => {
          setShowCreate(false);
          setCurrentScreen('Feed');
        }} />
        <TouchableOpacity
          style={styles.closeCreateButton}
          onPress={() => setShowCreate(false)}
        >
          <Text style={styles.closeCreateText}>✕ Close</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Show Create Meeting screen as modal
  if (showCreateMeeting) {
    return (
      <CreateMeetingScreen
        onClose={() => setShowCreateMeeting(false)}
        onMeetingCreated={() => {
          // Refresh calendar if needed
          setCurrentScreen('Calendar');
        }}
      />
    );
  }

  // Show Edit Pursuit screen as modal
  if (editingPursuit) {
    return (
      <EditPursuitScreen
        pursuit={editingPursuit}
        onClose={() => setEditingPursuit(null)}
        onSaved={() => {
          // Refresh pods screen
          setCurrentScreen('Pods');
        }}
        onDeleted={() => {
          // Go back to pods screen
          setCurrentScreen('Pods');
        }}
      />
    );
  }

// Video call screen - enabled for native builds
if (videoCallChannel) {
  if (!AGORA_APP_ID) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <Text style={{ fontSize: 18, textAlign: 'center', marginBottom: 20 }}>
          ⚠️ Agora App ID not configured
        </Text>
        <Text style={{ textAlign: 'center', color: '#666', marginBottom: 20 }}>
          Please add your Agora App ID to the agoraService.ts file
        </Text>
        <TouchableOpacity
          style={{ backgroundColor: '#8b5cf6', padding: 15, borderRadius: 8 }}
          onPress={() => setVideoCallChannel(null)}
        >
          <Text style={{ color: '#fff', fontWeight: 'bold' }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <VideoCallScreen
      channelName={videoCallChannel}
      podTitle={videoCallPodTitle}
      agoraAppId={AGORA_APP_ID}
      onEndCall={() => {
        setVideoCallChannel(null);
        setVideoCallPodTitle('');
      }}
    />
  );
}

// Show Removal Reason screen
if (viewingRemovalReason) {
  return (
    <RemovalReasonScreen
      pursuitTitle={viewingRemovalReason.pursuitTitle}
      reason={viewingRemovalReason.reason}
      removedAt={viewingRemovalReason.removedAt}
      onBack={() => {
        setViewingRemovalReason(null);
        setCurrentScreen('Feed');
      }}
    />
  );
}

// Show Member Left screen (for creators when a member leaves)
if (viewingMemberLeft) {
  return (
    <MemberLeftScreen
      pursuitTitle={viewingMemberLeft.pursuitTitle}
      memberName={viewingMemberLeft.memberName}
      reason={viewingMemberLeft.reason}
      leftAt={viewingMemberLeft.leftAt}
      onBack={() => {
        setViewingMemberLeft(null);
        setCurrentScreen('Notifications');
      }}
    />
  );
}

// Show Meeting Invitation screen
if (viewingMeetingInvitation) {
  return (
    <MeetingInvitationScreen
      meetingId={viewingMeetingInvitation}
      onBack={() => {
        setViewingMeetingInvitation(null);
        setCurrentScreen('Notifications');
      }}
      onResponded={() => {
        setViewingMeetingInvitation(null);
        setCurrentScreen('Calendar');
      }}
    />
  );
}

// Show Interview Time Slot Proposal screen (for applicants to propose interview times)
if (viewingInterviewProposal) {
  return (
    <InterviewTimeSlotProposalScreen
      applicationId={viewingInterviewProposal.applicationId}
      pursuitId={viewingInterviewProposal.pursuitId}
      pursuitTitle={viewingInterviewProposal.pursuitTitle}
      onClose={() => {
        setViewingInterviewProposal(null);
        setCurrentScreen('Notifications');
      }}
      onSubmitted={() => {
        setViewingInterviewProposal(null);
        setCurrentScreen('Feed');
      }}
    />
  );
}

// Show Interview Scheduling screen (for creators to schedule the interview)
if (viewingInterviewScheduling) {
  return (
    <InterviewSchedulingScreen
      applicationId={viewingInterviewScheduling.applicationId}
      pursuitId={viewingInterviewScheduling.pursuitId}
      pursuitTitle={viewingInterviewScheduling.pursuitTitle}
      applicantId={viewingInterviewScheduling.applicantId}
      applicantName={viewingInterviewScheduling.applicantName}
      onClose={() => {
        setViewingInterviewScheduling(null);
        setCurrentScreen('Notifications');
      }}
      onScheduled={() => {
        setViewingInterviewScheduling(null);
        setCurrentScreen('Calendar');
      }}
    />
  );
}

// Show Write Review screen
if (viewingWriteReview) {
  console.log('🖊️ Rendering WriteReviewScreen with:', viewingWriteReview);
  return (
    <WriteReviewScreen
      route={{ params: viewingWriteReview }}
      navigation={{
        ...navigation,
        goBack: () => setViewingWriteReview(null),
      }}
    />
  );
}

// Show User Profile screen (before chat so it takes priority when clicked from chat)
if (viewingUserId) {
  return (
    <UserProfileScreen
      route={{ params: { userId: viewingUserId } }}
      navigation={navigation}
      onWriteReview={(revieweeId: string, revieweeName: string, revieweePhoto?: string) => {
        Alert.alert('Debug', `Writing review for ${revieweeName} (${revieweeId})`);
        setViewingWriteReview({
          revieweeId,
          revieweeName,
          revieweePhoto,
        });
      }}
    />
  );
}

// Show Connections screen
if (showConnections) {
  return <ConnectionsScreen navigation={navigation} />;
}

// Show chat screen if a conversation is selected
if (chatPartnerId && chatPartnerEmail) {
  return (
    <ChatScreen
      partnerId={chatPartnerId}
      partnerEmail={chatPartnerEmail}
      navigation={navigation}
      onBack={() => {
        setChatPartnerId(null);
        setChatPartnerEmail(null);
      }}
    />
  );
}

// Show Pod Detail Screen if viewing from Pods tab
if (viewingPodDetail) {
  return (
    <PursuitDetailScreen
      pursuit={viewingPodDetail}
      initialSubScreen={podDetailSubScreen}
      onBack={() => {
        setViewingPodDetail(null);
        setPodDetailSubScreen(null);
      }}
      isOwner={viewingPodDetail.creator_id === auth.user?.id || viewingPodDetail.is_creator}
      onEdit={() => {
        setEditingPursuit(viewingPodDetail);
      }}
      onDelete={async () => {
        Alert.alert(
          'Delete Pursuit',
          'Are you sure you want to delete this pursuit? This action cannot be undone.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: async () => {
                try {
                  const { error } = await supabase
                    .from('pursuits')
                    .delete()
                    .eq('id', viewingPodDetail.id);

                  if (error) throw error;

                  Alert.alert('Success', 'Pursuit deleted successfully');
                  setViewingPodDetail(null);
                  setCurrentScreen('Pods');
                } catch (error: any) {
                  console.error('Error deleting pursuit:', error);
                  Alert.alert('Error', error.message || 'Failed to delete pursuit');
                }
              },
            },
          ]
        );
      }}
      onViewProfile={(userId, userEmail) => {
        // If viewing own profile, go to Profile tab
        if (userId === auth.user?.id) {
          setViewingPodDetail(null);
          setCurrentScreen('Profile');
        } else {
          setViewingUserId(userId);
        }
      }}
      onOpenTeamBoard={(pursuitId) => {
        setViewingPodDetail(null);
        setTeamBoardPursuitId(pursuitId);
      }}
      onSendMessage={(userId, userEmail) => {
        setViewingPodDetail(null);
        setChatPartnerId(userId);
        setChatPartnerEmail(userEmail);
        setCurrentScreen('Messages');
      }}
    />
  );
}

// Show Team Workspace if a pursuit board is selected
if (teamBoardPursuitId) {
  return (
    <TeamWorkspaceScreen
      initialPursuitId={teamBoardPursuitId}
      onBack={() => {
        setTeamBoardPursuitId(null);
      }}
    />
  );
}

  const startMessage = (userId: string, userEmail: string) => {
    setChatPartnerId(userId);
    setChatPartnerEmail(userEmail);
    setCurrentScreen('Messages');
  };

  const openTeamBoard = (pursuitId: string) => {
    setTeamBoardPursuitId(pursuitId);
  };

  return (
    <View style={{ flex: 1 }}>
      <NotificationToast
        notification={currentToast}
        onPress={async () => {
          // Handle navigation based on notification type
          if (currentToast?.type === 'interview_scheduling_requested' && currentToast?.id) {
            // Applicant taps toast - navigate to interview proposal screen
            try {
              const { data: appData } = await supabase
                .from('pursuit_applications')
                .select('pursuit_id, pursuits(title)')
                .eq('id', currentToast.id)
                .single();

              if (appData) {
                const pursuitData = appData.pursuits as any;
                setViewingInterviewProposal({
                  applicationId: currentToast.id,
                  pursuitId: appData.pursuit_id,
                  pursuitTitle: pursuitData?.title || 'Pursuit',
                });
              }
            } catch (error) {
              console.error('Error navigating to interview proposal:', error);
              setCurrentScreen('Notifications');
            }
          } else if (currentToast?.type === 'interview_times_submitted' && currentToast?.data?.applicationId) {
            // Creator taps toast - navigate to interview scheduling screen
            try {
              const applicationId = currentToast.data.applicationId;
              const pursuitId = currentToast.data.pursuitId;
              console.log('🎤 Navigating to interview scheduling:', { applicationId, pursuitId });
              await fetchInterviewSchedulingData(applicationId, pursuitId);
            } catch (error) {
              console.error('Error navigating to interview scheduling:', error);
              setCurrentScreen('Notifications');
            }
          } else {
            // Default: navigate to notifications tab
            setCurrentScreen('Notifications');
          }
          setCurrentToast(null);
        }}
        onDismiss={() => setCurrentToast(null)}
      />

      {currentScreen === 'Feed' && (
        <FeedScreen 
          onStartMessage={startMessage} 
          onOpenTeamBoard={openTeamBoard}
          onOpenCreate={() => setShowCreate(true)}
        />
      )}
      {currentScreen === 'Messages' && (
  <MessagesListScreen
    navigation={navigation}
    onSelectConversation={(partnerId: string, partnerEmail: string) => {
      setChatPartnerId(partnerId);
      setChatPartnerEmail(partnerEmail);
    }}
    onConversationRead={() => {
      // Update the locally-read message count to trigger badge update
      setLocallyReadCount(getLocallyReadMessageCount());
      // Also try to reload from DB (in case migration has been run)
      loadUnreadMessageCount();
    }}
  />
)}
      {currentScreen === 'Pods' && (
        <PodsScreen
          onOpenPodDetails={(pod) => setViewingPodDetail(pod)}
          onOpenTeamBoard={openTeamBoard}
          onOpenInterviewProposal={(applicationId, pursuitId, pursuitTitle) => {
            setViewingInterviewProposal({
              applicationId,
              pursuitId,
              pursuitTitle,
            });
          }}
        />
      )}
      {currentScreen === 'Calendar' && (
        <CalendarScreen
          onCreateMeeting={() => setShowCreateMeeting(true)}
          onOpenMeeting={(meeting) => {
            setSelectedMeeting(meeting);
          }}
        />
      )}
      {currentScreen === 'Notifications' && <NotificationsScreen navigation={navigation} />}
      {currentScreen === 'Profile' && <ProfileScreen navigation={navigation} />}

      <View style={styles.tabBar}>
        <TouchableOpacity style={styles.tab} onPress={() => setCurrentScreen('Feed')}>
          <Text style={[styles.tabText, currentScreen === 'Feed' && styles.tabTextActive]}>
            🏠 Feed
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.tab}
          onPress={() => {
            setCurrentScreen('Messages');
          }}
        >
          <View style={styles.tabContent}>
            <Text style={[styles.tabText, currentScreen === 'Messages' && styles.tabTextActive]}>
              💬 Messages
            </Text>
            {(() => {
              // Adjust unread count by subtracting locally-read conversations
              const effectiveUnreadCount = Math.max(0, unreadMessageCount - locallyReadCount);
              return effectiveUnreadCount > 0 && currentScreen !== 'Messages' ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{effectiveUnreadCount}</Text>
                </View>
              ) : null;
            })()}
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.tab}
          onPress={() => {
            setCurrentScreen('Pods');
            clearBadgeForTab('Pods');
          }}
        >
          <View style={styles.tabContent}>
            <Text style={[styles.tabText, currentScreen === 'Pods' && styles.tabTextActive]}>
              🐋 My Pods
            </Text>
            {badgeCounts.pods > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{badgeCounts.pods}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.tab}
          onPress={() => {
            setCurrentScreen('Calendar');
            clearBadgeForTab('Calendar');
          }}
        >
          <View style={styles.tabContent}>
            <Text style={[styles.tabText, currentScreen === 'Calendar' && styles.tabTextActive]}>
              📅 Calendar
            </Text>
            {badgeCounts.calendar > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{badgeCounts.calendar}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.tab}
          onPress={() => {
            setCurrentScreen('Notifications');
          }}
        >
          <View style={styles.tabContent}>
            <Text style={[styles.tabText, currentScreen === 'Notifications' && styles.tabTextActive]}>
              🔔 Alerts
            </Text>
            {badgeCounts.notifications > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{badgeCounts.notifications}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.tab}
          onPress={() => {
            setCurrentScreen('Profile');
            clearBadgeForTab('Profile');
          }}
        >
          <View style={styles.tabContent}>
            <Text style={[styles.tabText, currentScreen === 'Profile' && styles.tabTextActive]}>
              👤 Profile
            </Text>
            {badgeCounts.connections > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{badgeCounts.connections}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </View>

      {/* Meeting Detail Modal */}
      {selectedMeeting && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#fff', zIndex: 1000 }}>
          <MeetingDetailScreen
            meeting={selectedMeeting}
            onClose={() => setSelectedMeeting(null)}
            onJoinCall={(meeting) => {
              // Join the Agora video call
              if (meeting.agora_channel_name) {
                console.log('🎥 Starting video call for meeting:', meeting.title);
                setVideoCallChannel(meeting.agora_channel_name);
                setVideoCallPodTitle(meeting.title || 'Meeting');
                setSelectedMeeting(null);
              } else {
                Alert.alert('Error', 'Video channel not available for this meeting');
              }
            }}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingBottom: 20,
    paddingTop: 10,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
  },
  tabContent: {
    position: 'relative',
    alignItems: 'center',
  },
  tabText: {
    fontSize: 14,
    color: '#999',
  },
  tabTextActive: {
    color: '#0ea5e9',
    fontWeight: 'bold',
  },
  badge: {
    position: 'absolute',
    top: -8,
    right: -12,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  closeCreateButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    backgroundColor: '#ef4444',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    zIndex: 1000,
  },
  closeCreateText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
      <StatusBar style="auto" />
    </AuthProvider>
  );
}