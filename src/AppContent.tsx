import React, { useState, useCallback } from 'react';
import { supabase } from './config/supabase';
import { View } from 'react-native';
import WhaleLoader from './components/ui/WhaleLoader';
import { useAuth } from './contexts/AuthContext';
import { LegalDoc } from './screens/LegalScreen';
import IntroAnimation from './components/IntroAnimation';
import LoginScreen from './screens/LoginScreen';
import EntryGate from './screens/apply/EntryGate';
import WaitingListScreen from './screens/apply/WaitingListScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import AppTabBar from './components/ui/AppTabBar';
import { useOnboardingGate } from './hooks/useOnboardingGate';
import { useNotifications } from './hooks/useNotifications';
import { useInterviewListeners } from './hooks/useInterviewListeners';
import { useMessageBadges } from './hooks/useMessageBadges';
import { useToastNavigation } from './hooks/useToastNavigation';
import { useKickoffReminder } from './hooks/useKickoffReminder';
import { useAppNavigation } from './navigation/useAppNavigation';
import AppRouter from './navigation/AppRouter';
import { DEV_BYPASS_GATE } from './config/devFlags';

export default function AppContent() {
  const auth = useAuth();
  const { theme, isNewTheme } = require('./theme/ThemeContext').useTheme();
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
  const [applicationStatus, setApplicationStatus] = useState<string | null>(null);
  const [introDone, setIntroDone] = useState(false);

  // Effects + data loading extracted to hooks (state stays in AppContent and is
  // passed down, so behavior is unchanged). Effect order preserved:
  // onboarding -> notifications -> interview x2 -> messages.
  useOnboardingGate(auth, { setOnboardingCompleted, setCheckingOnboarding, setApplicationStatus });

  // Re-read the gate fields (used when an approval arrives while the applicant
  // is sitting on the Waiting List, so they advance without relaunching).
  const recheckGate = useCallback(async () => {
    if (!auth.user) return;
    const { data } = await supabase
      .from('profiles')
      .select('application_status, onboarding_completed')
      .eq('id', auth.user.id)
      .maybeSingle();
    if (data) {
      setApplicationStatus(data.application_status ?? null);
      setOnboardingCompleted(data.onboarding_completed ?? true);
    }
  }, [auth.user]);
  const { loadBadgeCounts, clearBadgeForTab } = useNotifications(auth, { setBadgeCounts, setCurrentToast });
  // Nudge the leader on every app open if a pod is team-ready but not kicked off.
  useKickoffReminder(auth, { setCurrentToast });
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
        <WhaleLoader size={64} />
      </View>
    );
  }

  if (!auth.user) {
    return <EntryGate />;
  }

  // Show loading while checking onboarding status
  if (checkingOnboarding) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: themeColors.background }}>
        <WhaleLoader size={64} />
      </View>
    );
  }

  // DEV-ONLY: skip the waitlist + onboarding gate (see config/devFlags.ts).
  // __DEV__-gated, so this is dead code in a release build.
  const bypassGate = DEV_BYPASS_GATE && !!auth.user;

  // Applicants awaiting review stay on the waiting list until approved.
  // (Existing/approved users have application_status 'approved' or null.)
  if (applicationStatus === 'pending' && !bypassGate) {
    return <WaitingListScreen onApproved={recheckGate} />;
  }

  // Show onboarding if not completed
  if (!onboardingCompleted && !bypassGate) {
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
