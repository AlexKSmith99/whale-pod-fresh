import React from 'react';
import { View, ActivityIndicator, TouchableOpacity, Text, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { supabase } from '../config/supabase';
import { AppAlert } from '../components/ui/AppAlert';
import NotificationToast from '../components/NotificationToast';
import FeedScreen from '../screens/FeedScreen';
import CreateScreen from '../screens/CreateScreen';
import ProfileScreen from '../screens/ProfileScreen';
import UserProfileScreen from '../screens/UserProfileScreen';
import MessagesListScreen, { getLocallyReadMessageCount } from '../screens/MessagesListScreen';
import ChatScreen from '../screens/ChatScreen';
import TeamWorkspaceScreen from '../screens/team/TeamWorkspaceScreen';
import PodsScreen from '../screens/PodsScreen';
import CalendarScreen from '../screens/CalendarScreen';
import CreateMeetingScreen from '../screens/CreateMeetingScreen';
import MeetingDetailScreen from '../screens/MeetingDetailScreen';
import ConnectionsScreen from '../screens/connections/ConnectionsScreen';
import PursuitDetailScreen from '../screens/PursuitDetailScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import EditPursuitScreen from '../screens/EditPursuitScreen';
import VideoCallScreen from '../screens/VideoCallScreen';
import RemovalReasonScreen from '../screens/RemovalReasonScreen';
import MemberLeftScreen from '../screens/MemberLeftScreen';
import MeetingInvitationScreen from '../screens/MeetingInvitationScreen';
import InterviewTimeSlotProposalScreen from '../screens/InterviewTimeSlotProposalScreen';
import InterviewSchedulingScreen from '../screens/InterviewSchedulingScreen';
import LegalScreen, { LegalDoc } from '../screens/LegalScreen';
import { AGORA_APP_ID } from '../services/agoraService';

// Render tree (overlay chain + main tabs) extracted verbatim from App.tsx.
// All in-scope values/handlers are passed in as props (state still lives in
// AppContent), so behavior and the early-return priority order are unchanged.
export default function AppRouter(props: any) {
  const {
    currentScreen,
    chatPartnerId,
    chatPartnerEmail,
    chatOpenedFromUserId,
    podDetailOpenedFromUserId,
    teamBoardPursuitId,
    teamBoardSubTab,
    viewingLegalDoc,
    showCreate,
    showCreateMeeting,
    selectedMeeting,
    editingPursuit,
    viewingUserId,
    showConnections,
    viewingPodDetail,
    podDetailSubScreen,
    podDetailFromNotifications,
    videoCallChannel,
    videoCallPodTitle,
    viewingRemovalReason,
    viewingMemberLeft,
    viewingMeetingInvitation,
    viewingInterviewProposal,
    viewingInterviewScheduling,
    currentToast,
    setCurrentScreen,
    setChatPartnerId,
    setChatPartnerEmail,
    setChatOpenedFromUserId,
    setPodDetailOpenedFromUserId,
    setTeamBoardPursuitId,
    setTeamBoardSubTab,
    setViewingLegalDoc,
    setShowCreate,
    setShowCreateMeeting,
    setSelectedMeeting,
    setEditingPursuit,
    setViewingUserId,
    setViewingPodDetail,
    setPodDetailSubScreen,
    setPodDetailFromNotifications,
    setVideoCallChannel,
    setVideoCallPodTitle,
    setViewingRemovalReason,
    setViewingMemberLeft,
    setViewingMeetingInvitation,
    setViewingInterviewProposal,
    setViewingInterviewScheduling,
    setCurrentToast,
    setLocallyReadCount,
    auth,
    navigation,
    renderTabBar,
    handleToastPress,
    loadUnreadMessageCount,
  } = props;

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
        AppAlert.alert(
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

                  AppAlert.alert('Success', 'Pursuit deleted successfully');
                  setViewingPodDetail(null);
                  setCurrentScreen('Pods');
                } catch (error: any) {
                  console.error('Error deleting pursuit:', error);
                  AppAlert.alert('Error', error.message || 'Failed to delete pursuit');
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
                AppAlert.alert('Error', 'Video channel not available for this meeting');
              }
            }}
          />
        </View>
      )}
    </View>
  );
}
