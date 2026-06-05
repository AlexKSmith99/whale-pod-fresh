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
import { useAppNavigation } from './src/navigation/useAppNavigation';
import AppRouter from './src/navigation/AppRouter';
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

  // Navigation + routing extracted to useAppNavigation (contains no React hooks;
  // viewingUserId is read by navigate(), so it is passed in explicitly).
  const { navigation, onTabPress } = useAppNavigation(auth, viewingUserId, {
    setViewingUserId,
    setShowConnections,
    setChatOpenedFromUserId,
    setChatPartnerId,
    setChatPartnerEmail,
    setCurrentScreen,
    setViewingPodDetail,
    setPodDetailSubScreen,
    setPodDetailFromNotifications,
    setPodDetailOpenedFromUserId,
    setTeamBoardPursuitId,
    setTeamBoardSubTab,
    setViewingRemovalReason,
    setViewingMemberLeft,
    setViewingMeetingInvitation,
    setViewingInterviewProposal,
    setViewingInterviewScheduling,
    setViewingLegalDoc,
    clearBadgeForTab,
    fetchInterviewProposalData,
    fetchInterviewSchedulingData,
  });

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

  return (
    <AppRouter
      currentScreen={currentScreen}
      chatPartnerId={chatPartnerId}
      chatPartnerEmail={chatPartnerEmail}
      chatOpenedFromUserId={chatOpenedFromUserId}
      podDetailOpenedFromUserId={podDetailOpenedFromUserId}
      teamBoardPursuitId={teamBoardPursuitId}
      teamBoardSubTab={teamBoardSubTab}
      viewingLegalDoc={viewingLegalDoc}
      showCreate={showCreate}
      showCreateMeeting={showCreateMeeting}
      selectedMeeting={selectedMeeting}
      editingPursuit={editingPursuit}
      viewingUserId={viewingUserId}
      showConnections={showConnections}
      viewingPodDetail={viewingPodDetail}
      podDetailSubScreen={podDetailSubScreen}
      podDetailFromNotifications={podDetailFromNotifications}
      videoCallChannel={videoCallChannel}
      videoCallPodTitle={videoCallPodTitle}
      viewingRemovalReason={viewingRemovalReason}
      viewingMemberLeft={viewingMemberLeft}
      viewingMeetingInvitation={viewingMeetingInvitation}
      viewingInterviewProposal={viewingInterviewProposal}
      viewingInterviewScheduling={viewingInterviewScheduling}
      currentToast={currentToast}
      setCurrentScreen={setCurrentScreen}
      setChatPartnerId={setChatPartnerId}
      setChatPartnerEmail={setChatPartnerEmail}
      setChatOpenedFromUserId={setChatOpenedFromUserId}
      setPodDetailOpenedFromUserId={setPodDetailOpenedFromUserId}
      setTeamBoardPursuitId={setTeamBoardPursuitId}
      setTeamBoardSubTab={setTeamBoardSubTab}
      setViewingLegalDoc={setViewingLegalDoc}
      setShowCreate={setShowCreate}
      setShowCreateMeeting={setShowCreateMeeting}
      setSelectedMeeting={setSelectedMeeting}
      setEditingPursuit={setEditingPursuit}
      setViewingUserId={setViewingUserId}
      setViewingPodDetail={setViewingPodDetail}
      setPodDetailSubScreen={setPodDetailSubScreen}
      setPodDetailFromNotifications={setPodDetailFromNotifications}
      setVideoCallChannel={setVideoCallChannel}
      setVideoCallPodTitle={setVideoCallPodTitle}
      setViewingRemovalReason={setViewingRemovalReason}
      setViewingMemberLeft={setViewingMemberLeft}
      setViewingMeetingInvitation={setViewingMeetingInvitation}
      setViewingInterviewProposal={setViewingInterviewProposal}
      setViewingInterviewScheduling={setViewingInterviewScheduling}
      setCurrentToast={setCurrentToast}
      setLocallyReadCount={setLocallyReadCount}
      auth={auth}
      navigation={navigation}
      renderTabBar={renderTabBar}
      handleToastPress={handleToastPress}
      loadUnreadMessageCount={loadUnreadMessageCount}
    />
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