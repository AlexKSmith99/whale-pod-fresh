import { supabase } from '../config/supabase';
import { notificationService } from '../services/notificationService';

type Setter = (value: any) => void;

interface UseToastNavigationDeps {
  setCurrentScreen: Setter;
  setChatPartnerId: Setter;
  setChatPartnerEmail: Setter;
  setShowConnections: Setter;
  setViewingPodDetail: Setter;
  setPodDetailSubScreen: Setter;
  setPodDetailFromNotifications: Setter;
  setTeamBoardPursuitId: Setter;
  setTeamBoardSubTab: Setter;
  setViewingMeetingInvitation: Setter;
  setViewingInterviewProposal: Setter;
  setViewingRemovalReason: Setter;
  setViewingMemberLeft: Setter;
  setCurrentToast: Setter;
  loadBadgeCounts: (...args: any[]) => any;
  fetchInterviewSchedulingData: (...args: any[]) => any;
}

export function useToastNavigation(
  auth: any,
  {
    setCurrentScreen, setChatPartnerId, setChatPartnerEmail, setShowConnections,
    setViewingPodDetail, setPodDetailSubScreen, setPodDetailFromNotifications,
    setTeamBoardPursuitId, setTeamBoardSubTab, setViewingMeetingInvitation,
    setViewingInterviewProposal, setViewingRemovalReason, setViewingMemberLeft,
    setCurrentToast, loadBadgeCounts, fetchInterviewSchedulingData,
  }: UseToastNavigationDeps
) {
  const handleToastPress = async (currentToast: any) => {
    // Handle navigation based on notification type - matching NotificationsScreen behavior
    const type = currentToast?.type;
    const data = currentToast?.data;
    const notificationId = currentToast?.notificationId;
    const relatedId = data?.pursuitId || data?.applicationId || data?.meetingId;

    // Mark the notification as read so its red highlight/badge clears
    // while the notification itself remains visible in the Notifications tab.
    if (notificationId) {
      try {
        await notificationService.markAsRead(notificationId);
        loadBadgeCounts();
      } catch (err) {
        console.error('Error marking tapped notification as read:', err);
      }
    }

    try {
      // Helper to navigate to pod detail
      const navigateToPod = async (pursuitId: string, subScreen?: string) => {
        const { data: pursuit, error } = await supabase
          .from('pursuits')
          .select('*')
          .eq('id', pursuitId)
          .single();

        if (!error && pursuit) {
          setViewingPodDetail(pursuit);
          setPodDetailSubScreen(subScreen || null);
          setPodDetailFromNotifications(true);
        } else {
          setCurrentScreen('Pods');
        }
      };

      switch (type) {
        case 'new_message':
          // Navigate to chat with that person
          if (data?.conversationId) {
            const { data: senderData } = await supabase
              .from('profiles')
              .select('email')
              .eq('id', data.conversationId)
              .single();

            setChatPartnerId(data.conversationId);
            setChatPartnerEmail(senderData?.email || 'User');
            setCurrentScreen('Messages');
          } else {
            setCurrentScreen('Messages');
          }
          break;

        case 'pod_chat_message':
          setCurrentScreen('Messages');
          break;

        case 'connection_request':
        case 'connection_accepted':
          setShowConnections(true);
          break;

        case 'application_received':
          if (data?.pursuitId) {
            await navigateToPod(data.pursuitId, 'applications');
          } else {
            setCurrentScreen('Pods');
          }
          break;

        case 'time_proposal':
        case 'all_proposals_submitted':
          if (data?.pursuitId) {
            await navigateToPod(data.pursuitId, 'kickoff');
          } else {
            setCurrentScreen('Pods');
          }
          break;

        case 'kickoff_activated':
          // Check if user is creator to determine which sub-screen
          if (data?.pursuitId) {
            const { data: pursuit } = await supabase
              .from('pursuits')
              .select('creator_id')
              .eq('id', data.pursuitId)
              .single();

            const isCreator = pursuit?.creator_id === auth.user?.id;
            await navigateToPod(data.pursuitId, isCreator ? 'kickoff' : 'propose_times');
          } else {
            setCurrentScreen('Pods');
          }
          break;

        case 'team_board_update':
          if (data?.pursuitId) {
            setTeamBoardPursuitId(data.pursuitId);
          } else {
            setCurrentScreen('Pods');
          }
          break;

        case 'pursuit_created':
        case 'application_accepted':
        case 'application_rejected':
        case 'min_team_size_reached':
        case 'kickoff_scheduled':
        case 'kickoff_scheduled_creator':
        case 'kickoff_scheduled_team':
          if (data?.pursuitId) {
            await navigateToPod(data.pursuitId);
          } else {
            setCurrentScreen('Pods');
          }
          break;

        case 'meeting':
        case 'new_meeting':
        case 'interview_scheduled':
          setCurrentScreen('Calendar');
          break;

        case 'meeting_invitation':
          if (data?.meetingId) {
            setViewingMeetingInvitation(data.meetingId);
          } else {
            setCurrentScreen('Calendar');
          }
          break;

        case 'interview_scheduling_requested':
          // Applicant taps toast - navigate to interview proposal screen
          if (currentToast?.id || data?.applicationId) {
            const applicationId = data?.applicationId || currentToast?.id;
            const { data: appData } = await supabase
              .from('pursuit_applications')
              .select('pursuit_id, pursuits(title)')
              .eq('id', applicationId)
              .single();

            if (appData) {
              const pursuitData = appData.pursuits as any;
              setViewingInterviewProposal({
                applicationId,
                pursuitId: appData.pursuit_id,
                pursuitTitle: pursuitData?.title || 'Pursuit',
              });
            } else {
              setCurrentScreen('Notifications');
            }
          } else {
            setCurrentScreen('Notifications');
          }
          break;

        case 'interview_times_submitted':
          // Creator taps toast - navigate to interview scheduling screen
          if (data?.applicationId && data?.pursuitId) {
            await fetchInterviewSchedulingData(data.applicationId, data.pursuitId);
          } else {
            setCurrentScreen('Notifications');
          }
          break;

        case 'member_removed':
          setViewingRemovalReason({
            pursuitTitle: data?.pursuitTitle || 'Unknown Pursuit',
            reason: data?.removalReason || 'No reason provided',
            removedAt: data?.removedAt || new Date().toISOString(),
          });
          break;

        case 'member_left':
          setViewingMemberLeft({
            pursuitTitle: data?.pursuitTitle || 'Unknown Pursuit',
            memberName: data?.memberName || 'A team member',
            reason: data?.leaveReason || 'No reason provided',
            leftAt: data?.leftAt || new Date().toISOString(),
          });
          break;

        case 'role_edit_requested':
        case 'role_edit_approved':
          if (data?.pursuitId) {
            setTeamBoardPursuitId(data.pursuitId);
            setTeamBoardSubTab('roles');
          } else {
            setCurrentScreen('Notifications');
          }
          break;

        case 'edit_access_request':
          if (data?.pursuitId) {
            setTeamBoardPursuitId(data.pursuitId);
            setTeamBoardSubTab(data?.page || 'roles');
          } else {
            setCurrentScreen('Notifications');
          }
          break;

        default:
          // Default: navigate to notifications tab
          setCurrentScreen('Notifications');
      }
    } catch (error) {
      console.error('Error navigating from toast:', error);
      setCurrentScreen('Notifications');
    }

    setCurrentToast(null);
  };

  return { handleToastPress };
}
