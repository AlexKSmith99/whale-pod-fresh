import { supabase } from '../config/supabase';
import { hapticService } from '../services/hapticService';
import { LegalDoc } from '../screens/LegalScreen';

type Setter = (value: any) => void;

interface UseAppNavigationDeps {
  setViewingUserId: Setter;
  setShowConnections: Setter;
  setChatOpenedFromUserId: Setter;
  setChatPartnerId: Setter;
  setChatPartnerEmail: Setter;
  setCurrentScreen: Setter;
  setViewingPodDetail: Setter;
  setPodDetailSubScreen: Setter;
  setPodDetailFromNotifications: Setter;
  setPodDetailOpenedFromUserId: Setter;
  setTeamBoardPursuitId: Setter;
  setTeamBoardSubTab: Setter;
  setViewingRemovalReason: Setter;
  setViewingMemberLeft: Setter;
  setViewingMeetingInvitation: Setter;
  setViewingInterviewProposal: Setter;
  setViewingInterviewScheduling: Setter;
  setViewingLegalDoc: Setter;
  clearBadgeForTab: (...args: any[]) => any;
  fetchInterviewProposalData: (...args: any[]) => any;
  fetchInterviewSchedulingData: (...args: any[]) => any;
}

export function useAppNavigation(
  auth: any,
  viewingUserId: any,
  {
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
  }: UseAppNavigationDeps
) {
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

  return { navigation, onTabPress };
}
