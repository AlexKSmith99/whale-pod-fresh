import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, TouchableOpacity, Text, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from '@expo-google-fonts/nothing-you-could-do';
import { QueryClientProvider } from '@tanstack/react-query';
import { appFonts } from './src/constants/fonts';
import { queryClient } from './src/config/queryClient';
import './src/utils/enableTextSelection';
import { useOnboardingGate } from './src/hooks/useOnboardingGate';
import { useNotifications } from './src/hooks/useNotifications';
import { useInterviewListeners } from './src/hooks/useInterviewListeners';
import { useMessageBadges } from './src/hooks/useMessageBadges';
import { useToastNavigation } from './src/hooks/useToastNavigation';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { ThemeProvider } from './src/theme/ThemeContext';
import { notificationService } from './src/services/notificationService';
import { messageService } from './src/services/messageService';
import { podChatService } from './src/services/podChatService';
import { hapticService } from './src/services/hapticService';
import { supabase } from './src/config/supabase';
import NotificationToast from './src/components/NotificationToast';
import ThemeTransitionWrapper from './src/components/ThemeTransitionWrapper';
import LoginScreen from './src/screens/LoginScreen';
import IntroAnimation from './src/components/IntroAnimation';
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
import OnboardingScreen from './src/screens/OnboardingScreen';
import LegalScreen, { LegalDoc } from './src/screens/LegalScreen';
import AppTabBar from './src/components/ui/AppTabBar';
import { AGORA_APP_ID } from './src/services/agoraService';

function AppContent() {
  const auth = useAuth();
  const { theme, isNewTheme } = require('./src/theme/ThemeContext').useTheme();
  const themeColors = theme.colors;
  const [currentScreen, setCurrentScreen] = useState('Feed');
  const [chatPartnerId, setChatPartnerId] = useState<string | null>(null);
  const [chatPartnerEmail, setChatPartnerEmail] = useState<string | null>(null);
  const [chatOpenedFromUserId, setChatOpenedFromUserId] = useState<string | null>(null);
  const [podDetailOpenedFromUserId, setPodDetailOpenedFromUserId] = useState<string | null>(null);
  const [teamBoardPursuitId, setTeamBoardPursuitId] = useState<string | null>(null);
  const [teamBoardSubTab, setTeamBoardSubTab] = useState<string | null>(null);
  const [viewingLegalDoc, setViewingLegalDoc] = useState<LegalDoc | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showCreateMeeting, setShowCreateMeeting] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<any | null>(null);
  const [editingPursuit, setEditingPursuit] = useState<any | null>(null);
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);
  const [showConnections, setShowConnections] = useState(false);
  const [viewingPodDetail, setViewingPodDetail] = useState<any | null>(null);
  const [podDetailSubScreen, setPodDetailSubScreen] = useState<string | null>(null);
  const [podDetailFromNotifications, setPodDetailFromNotifications] = useState<boolean>(false);
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

  // Onboarding state
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean | null>(null);
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);
  const [introDone, setIntroDone] = useState(false);

  // Effects + data loading extracted to hooks (state stays in AppContent and is
  // passed down, so behavior is unchanged). Effect order preserved:
  // onboarding -> notifications -> interview x2 -> messages.
  useOnboardingGate(auth, { setOnboardingCompleted, setCheckingOnboarding });
  const { loadBadgeCounts, clearBadgeForTab } = useNotifications(auth, { setBadgeCounts, setCurrentToast });
  const { fetchInterviewProposalData, fetchInterviewSchedulingData } = useInterviewListeners(auth, {
    setCurrentToast,
    setViewingInterviewProposal,
    setViewingInterviewScheduling,
  });
  const { loadUnreadMessageCount } = useMessageBadges(auth, { setUnreadMessageCount });
  const { handleToastPress } = useToastNavigation(auth, {
    setCurrentScreen,
    setChatPartnerId,
    setChatPartnerEmail,
    setShowConnections,
    setViewingPodDetail,
    setPodDetailSubScreen,
    setPodDetailFromNotifications,
    setTeamBoardPursuitId,
    setTeamBoardSubTab,
    setViewingMeetingInvitation,
    setViewingInterviewProposal,
    setViewingRemovalReason,
    setViewingMemberLeft,
    setCurrentToast,
    loadBadgeCounts,
    fetchInterviewSchedulingData,
  });

  // Intro plays on every cold start of the app (state resets each time the JS
  // bundle boots — i.e., after the user swipes the app away and reopens it).
  // It plays before any other UI, regardless of auth/onboarding state.
  if (!introDone) {
    return <IntroAnimation onComplete={() => setIntroDone(true)} />;
  }

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

  // Show loading while checking onboarding status
  if (checkingOnboarding) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: themeColors.background }}>
        <ActivityIndicator size="large" color={isNewTheme ? themeColors.accentGreen : '#6366F1'} />
      </View>
    );
  }

  // Show onboarding if not completed
  if (!onboardingCompleted) {
    return (
      <OnboardingScreen
        onComplete={() => { setOnboardingCompleted(true); setCurrentScreen('Feed'); }}
      />
    );
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
        // Remember if we came from a user profile so we can go back to it
        setChatOpenedFromUserId(viewingUserId);
        setChatPartnerId(params.partnerId);
        setChatPartnerEmail(params.partnerEmail || 'User');
        setViewingUserId(null); // Clear profile view so chat takes priority
        setCurrentScreen('Messages');
      } else if (screen === 'Profile') {
        setCurrentScreen('Profile');
        setViewingUserId(null);
      } else if (screen === 'PodDetail' && params?.pod) {
        setViewingPodDetail(params.pod);
        setPodDetailSubScreen(params.subScreen || null);
        setPodDetailFromNotifications(params.fromNotifications || false);
        setCurrentScreen('Pods');
      } else if (screen === 'PursuitDetail' && params?.pursuitId) {
        // Track where we came from so we can return
        if (viewingUserId) {
          setPodDetailOpenedFromUserId(viewingUserId);
          setViewingUserId(null);
        }
        // Set a loading placeholder immediately to trigger navigation
        setViewingPodDetail({ id: params.pursuitId, _loading: true });
        setPodDetailSubScreen(null);
        setPodDetailFromNotifications(false);
        // Fetch the full pursuit data
        (async () => {
          try {
            const { data: pursuit, error } = await supabase
              .from('pursuits')
              .select('*')
              .eq('id', params.pursuitId)
              .single();
            
            if (error) throw error;
            if (pursuit) {
              setViewingPodDetail(pursuit);
            }
          } catch (error) {
            console.error('Error loading pursuit:', error);
            // Clear the loading state on error
            setViewingPodDetail(null);
          }
        })();
      } else if (screen === 'TeamBoard' && params?.pursuitId) {
        setTeamBoardPursuitId(params.pursuitId);
        setTeamBoardSubTab(params.subTab || null);
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
      } else if (screen === 'Legal' && params?.doc) {
        setViewingLegalDoc(params.doc as LegalDoc);
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

  // Clears every overlay/sub-screen state so a tab tap pops back to the tab's root.
  const resetSubScreens = () => {
    setViewingUserId(null);
    setShowConnections(false);
    setViewingLegalDoc(null);
    setChatPartnerId(null);
    setChatPartnerEmail(null);
    setChatOpenedFromUserId(null);
    setViewingPodDetail(null);
    setPodDetailSubScreen(null);
    setPodDetailFromNotifications(false);
    setPodDetailOpenedFromUserId(null);
    setTeamBoardPursuitId(null);
    setTeamBoardSubTab(null);
    setViewingRemovalReason(null);
    setViewingMemberLeft(null);
    setViewingMeetingInvitation(null);
    setViewingInterviewProposal(null);
    setViewingInterviewScheduling(null);
  };

  const onTabPress = (target: string) => {
    hapticService.lightTap();
    resetSubScreens();
    setCurrentScreen(target);
    if (target === 'Pods') clearBadgeForTab('Pods');
    if (target === 'Calendar') clearBadgeForTab('Calendar');
    if (target === 'Profile') clearBadgeForTab('Profile');
  };

  const renderTabBar = () => (
    <AppTabBar
      isNewTheme={isNewTheme}
      themeColors={themeColors}
      currentScreen={currentScreen}
      unreadMessageCount={unreadMessageCount}
      locallyReadCount={locallyReadCount}
      badgeCounts={badgeCounts}
      onTabPress={onTabPress}
    />
  );

  // Show Create Pursuit screen as modal
  if (showCreate) {
    return (
      <CreateScreen onClose={() => {
        setShowCreate(false);
        setCurrentScreen('Feed');
      }} />
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
    <View style={{ flex: 1 }}>
      <RemovalReasonScreen
        pursuitTitle={viewingRemovalReason.pursuitTitle}
        reason={viewingRemovalReason.reason}
        removedAt={viewingRemovalReason.removedAt}
        onBack={() => {
          setViewingRemovalReason(null);
          setCurrentScreen('Feed');
        }}
      />
      {renderTabBar()}
    </View>
  );
}

// Show Member Left screen (for creators when a member leaves)
if (viewingMemberLeft) {
  return (
    <View style={{ flex: 1 }}>
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
      {renderTabBar()}
    </View>
  );
}

// Show Meeting Invitation screen
if (viewingMeetingInvitation) {
  return (
    <View style={{ flex: 1 }}>
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
      {renderTabBar()}
    </View>
  );
}

// Show Interview Time Slot Proposal screen (for applicants to propose interview times)
if (viewingInterviewProposal) {
  return (
    <View style={{ flex: 1 }}>
      <InterviewTimeSlotProposalScreen
        applicationId={viewingInterviewProposal.applicationId}
        pursuitId={viewingInterviewProposal.pursuitId}
        pursuitTitle={viewingInterviewProposal.pursuitTitle}
        onClose={() => {
          setViewingInterviewProposal(null);
          setCurrentScreen('Pods');
        }}
        onSubmitted={() => {
          setViewingInterviewProposal(null);
          setCurrentScreen('Pods');
        }}
      />
      {renderTabBar()}
    </View>
  );
}

// Show Interview Scheduling screen (for creators to schedule the interview)
if (viewingInterviewScheduling) {
  return (
    <View style={{ flex: 1 }}>
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
      {renderTabBar()}
    </View>
  );
}

// Show User Profile screen (before chat so it takes priority when clicked from chat)
if (viewingUserId) {
  return (
    <View style={{ flex: 1 }}>
      <UserProfileScreen
        route={{ params: { userId: viewingUserId } }}
        navigation={navigation}
      />
      {renderTabBar()}
    </View>
  );
}

// Show Connections screen
if (showConnections) {
  return (
    <View style={{ flex: 1 }}>
      <ConnectionsScreen navigation={navigation} />
      {renderTabBar()}
    </View>
  );
}

// Show Legal doc viewer (Terms / Privacy / Support)
if (viewingLegalDoc) {
  return (
    <View style={{ flex: 1 }}>
      <LegalScreen doc={viewingLegalDoc} onBack={() => setViewingLegalDoc(null)} />
      {renderTabBar()}
    </View>
  );
}

// Show chat screen if a conversation is selected
if (chatPartnerId && chatPartnerEmail) {
  return (
    <View style={{ flex: 1 }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ChatScreen
          partnerId={chatPartnerId}
          partnerEmail={chatPartnerEmail}
          navigation={navigation}
          onBack={() => {
            // If we came from a user profile, go back to it
            if (chatOpenedFromUserId) {
              setViewingUserId(chatOpenedFromUserId);
              setChatOpenedFromUserId(null);
            }
            setChatPartnerId(null);
            setChatPartnerEmail(null);
          }}
        />
      </KeyboardAvoidingView>
      {renderTabBar()}
    </View>
  );
}

// Show Pod Detail Screen if viewing from Pods tab
if (viewingPodDetail) {
  return (
    <View style={{ flex: 1 }}>
    <PursuitDetailScreen
      pursuit={viewingPodDetail}
      initialSubScreen={podDetailSubScreen}
      fromNotifications={podDetailFromNotifications}
      onBackToNotifications={() => {
        setViewingPodDetail(null);
        setPodDetailSubScreen(null);
        setPodDetailFromNotifications(false);
        setCurrentScreen('Notifications');
      }}
      onBack={() => {
        setViewingPodDetail(null);
        setPodDetailSubScreen(null);
        setPodDetailFromNotifications(false);
        // If we came from a user profile, return to it
        if (podDetailOpenedFromUserId) {
          setViewingUserId(podDetailOpenedFromUserId);
          setPodDetailOpenedFromUserId(null);
        }
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
      {renderTabBar()}
    </View>
  );
}

// Show Team Workspace if a pursuit board is selected
if (teamBoardPursuitId) {
  return (
    <View style={{ flex: 1 }}>
      <TeamWorkspaceScreen
        initialPursuitId={teamBoardPursuitId}
        initialSubTab={teamBoardSubTab as any}
        onBack={() => {
          setTeamBoardPursuitId(null);
          setTeamBoardSubTab(null);
        }}
      />
      {renderTabBar()}
    </View>
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
        onPress={() => handleToastPress(currentToast)}
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

      {renderTabBar()}

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

// NOTE: closeCreateButton/closeCreateText are not referenced anywhere in App.tsx
// (pre-existing dead styles). Left in place per the pure-extraction constraint.
const styles = StyleSheet.create({
  closeCreateButton: {
    position: 'absolute',
    top: 55,
    right: 20,
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
  // Load all fonts globally
  const [fontsLoaded] = useFonts(appFonts);

  // Show loading while fonts load
  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0B1220' }}>
        <ActivityIndicator size="large" color="#A8E6A3" />
      </View>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <AppContent />
          <ThemeTransitionWrapper />
          <StatusBar style="auto" />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}