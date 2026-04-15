import { Platform } from 'react-native';
import { supabase } from '../config/supabase';
import { fetchPossessivePronoun } from '../utils/pronouns';

// Lazy load notification modules to avoid startup crashes
let Notifications: any = null;
let Device: any = null;

const loadNotificationModules = async () => {
  if (!Notifications) {
    try {
      Notifications = await import('expo-notifications');
      Device = await import('expo-device');

      // Configure notification handler
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        }),
      });
    } catch (error) {
      console.warn('Expo notifications not available:', error);
      return false;
    }
  }
  return true;
};

export interface NotificationData {
  type: string;
  pursuitId?: string;
  meetingId?: string;
  applicationId?: string;
  [key: string]: any;
}

export const notificationService = {
  // Register push token for the current user
  async registerPushToken(userId: string): Promise<string | null> {
    try {
      // Load notification modules
      const loaded = await loadNotificationModules();
      if (!loaded || !Notifications || !Device) {
        console.log('Notifications not available on this device/build');
        return null;
      }

      // Check if device supports push notifications
      if (!Device.isDevice) {
        console.log('Push notifications only work on physical devices');
        return null;
      }

      // Request permission
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('Failed to get push token permission');
        return null;
      }

      // Get the token
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: '85d9f8fe-e5eb-4f70-80f6-e3094a1c557d',
      });
      const token = tokenData.data;

      // Store token in database
      const { error } = await supabase
        .from('push_tokens')
        .upsert({
          user_id: userId,
          expo_push_token: token,
          device_id: Device.modelName || 'unknown',
        }, {
          onConflict: 'user_id,expo_push_token'
        });

      if (error) {
        console.error('Error storing push token:', error);
        return null;
      }

      // Configure channel for Android
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
        });
      }

      return token;
    } catch (error) {
      console.error('Error registering push token:', error);
      return null;
    }
  },

  // Send push notification ONLY (no database storage) - for messages/chats
  // This sends a pop-up notification without storing in the Alerts tab
  async sendPushOnly(
    userIds: string[],
    title: string,
    body: string,
    data?: NotificationData
  ): Promise<void> {
    try {
      if (userIds.length === 0) {
        console.log('No recipients supplied for push notification');
        return;
      }

      // Get push tokens for users
      const { data: tokens, error: tokenError } = await supabase
        .from('push_tokens')
        .select('expo_push_token, user_id')
        .in('user_id', userIds);

      if (tokenError || !tokens || tokens.length === 0) {
        console.log('No push tokens found for users - skipping push notification');
        return;
      }

      // Prepare messages for Expo Push API
      const messages = tokens.map(token => ({
        to: token.expo_push_token,
        sound: 'default',
        title,
        body,
        data: data || {},
      }));

      // Send notifications via Expo Push API
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messages),
      });

      const result = await response.json();
      console.log('Push notification sent (no DB storage):', result);
    } catch (error) {
      console.error('Error sending push notification:', error);
    }
  },

  // Send push notification to specific users
  async sendPushNotification(
    userIds: string[],
    title: string,
    body: string,
    data?: NotificationData,
    type: string = 'general',
    relatedId?: string,
    relatedType?: string
  ): Promise<void> {
    try {
      // ALWAYS store notification history for in-app notifications, regardless of push tokens
      const notifications = userIds.map(userId => ({
        user_id: userId,
        title,
        body, // Database column is 'body'
        type,
        related_id: relatedId,
        related_type: relatedType,
        data: data || null,
      }));

      if (notifications.length === 0) {
        console.log('No recipients supplied for notification insert');
        return;
      }

      console.log('💾 Inserting notifications via RPC function:', notifications);

      // Use the SECURITY DEFINER RPC function to bypass RLS
      // This function was created in migration 020 specifically for this purpose
      try {
        const { data: insertedData, error: historyError } = await supabase
          .rpc('create_notifications', {
            input_notifications: notifications
          });

        if (historyError) {
          // Log but don't throw - notification failure shouldn't block main flow
          console.warn('⚠️ Could not store notification:', historyError.message);
        } else {
          console.log('✅ Notifications stored successfully:', insertedData);
        }
      } catch (insertError) {
        // Silently handle - notifications are secondary to the main action
        console.warn('⚠️ Notification insert failed:', insertError);
      }

      // Try to send push notifications if tokens are available
      const { data: tokens, error: tokenError } = await supabase
        .from('push_tokens')
        .select('expo_push_token, user_id')
        .in('user_id', userIds);

      if (tokenError || !tokens || tokens.length === 0) {
        console.log('No push tokens found for users - skipping push notification (in-app notification already created)');
        return;
      }

      // Prepare messages for Expo Push API
      const messages = tokens.map(token => ({
        to: token.expo_push_token,
        sound: 'default',
        title,
        body,
        data: data || {},
      }));

      // Send notifications via Expo Push API
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messages),
      });

      const result = await response.json();
      console.log('Push notification sent:', result);
    } catch (error) {
      console.error('Error sending push notification:', error);
    }
  },

  // Get user's notification history
  async getUserNotifications(userId: string) {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching notifications:', error);
      return [];
    }

    return data || [];
  },

  // Mark notification as read
  async markAsRead(notificationId: string) {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId);

    if (error) {
      console.error('Error marking notification as read:', error);
    }
  },

  // Notification touchpoint 1: Application received
  async notifyApplicationReceived(
    creatorId: string,
    pursuitId: string,
    pursuitName: string,
    applicantName: string,
    applicantId?: string
  ) {
    const pronoun = applicantId ? await fetchPossessivePronoun(applicantId) : 'their';
    await this.sendPushNotification(
      [creatorId],
      `${applicantName} applied to join "${pursuitName}"`,
      `Review ${pronoun} application in the Pods tab`,
      {
        type: 'application_received',
        pursuitId,
      },
      'application_received',
      pursuitId,
      'pursuit'
    );
  },

  // Notification touchpoint 2: Minimum team size reached
  async notifyMinTeamSizeReached(
    creatorId: string,
    pursuitId: string,
    pursuitName: string,
    currentSize: number,
    minSize: number
  ) {
    await this.sendPushNotification(
      [creatorId],
      'Team Ready! 🚀',
      `"${pursuitName}" has reached ${currentSize}/${minSize} members. Time to activate the kickoff!`,
      {
        type: 'min_team_size_reached',
        pursuitId,
      },
      'min_team_size_reached',
      pursuitId,
      'pursuit'
    );
  },

  // Notification touchpoint 3: Kickoff activated
  async notifyKickoffActivated(
    teamMemberIds: string[],
    pursuitId: string,
    pursuitName: string,
    creatorName: string
  ) {
    await this.sendPushNotification(
      teamMemberIds,
      `${creatorName} activated kickoff scheduling for "${pursuitName}"`,
      'Share your availability now!',
      {
        type: 'kickoff_activated',
        pursuitId,
      },
      'kickoff_activated',
      pursuitId,
      'pursuit'
    );
  },

  // Notification touchpoint 4: All proposals submitted
  async notifyAllProposalsSubmitted(
    creatorId: string,
    pursuitId: string,
    pursuitName: string,
    proposalCount: number
  ) {
    await this.sendPushNotification(
      [creatorId],
      'All Time Slots Received! ⏰',
      `All ${proposalCount} team members submitted their availability for "${pursuitName}". Schedule the kickoff now!`,
      {
        type: 'all_proposals_submitted',
        pursuitId,
      },
      'all_proposals_submitted',
      pursuitId,
      'pursuit'
    );
  },

  // Notification touchpoint 5: Kickoff scheduled - for team members
  async notifyKickoffScheduledToTeam(
    teamMemberIds: string[],
    pursuitId: string,
    pursuitName: string,
    creatorName: string,
    meetingDate: string,
    meetingTime: string
  ) {
    await this.sendPushNotification(
      teamMemberIds,
      `${creatorName} scheduled a kickoff meeting for "${pursuitName}" at ${meetingTime} on ${meetingDate}`,
      'Add your pre-meeting notes to the team board!',
      {
        type: 'kickoff_scheduled_team',
        pursuitId,
      },
      'kickoff_scheduled',
      pursuitId,
      'pursuit'
    );
  },

  // Notification touchpoint 6: Kickoff scheduled - for creator
  async notifyKickoffScheduledToCreator(
    creatorId: string,
    pursuitId: string,
    pursuitName: string,
    meetingDate: string,
    meetingTime: string
  ) {
    await this.sendPushNotification(
      [creatorId],
      `You scheduled the kickoff for "${pursuitName}" at ${meetingTime} on ${meetingDate}`,
      'Add your pre-meeting agenda to the team board!',
      {
        type: 'kickoff_scheduled_creator',
        pursuitId,
      },
      'kickoff_scheduled',
      pursuitId,
      'pursuit'
    );
  },

  // New message notification - push only, no database storage
  // Messages show in Chats tab badge, not Alerts tab
  async notifyNewMessage(
    recipientId: string,
    senderName: string,
    messagePreview: string,
    conversationId: string
  ) {
    await this.sendPushOnly(
      [recipientId],
      `${senderName} sent you a message`,
      messagePreview,
      {
        type: 'new_message',
        conversationId,
      }
    );
  },

  // Connection request received
  async notifyConnectionRequest(
    recipientId: string,
    requesterName: string,
    requesterId: string
  ) {
    const pronoun = await fetchPossessivePronoun(requesterId);
    await this.sendPushNotification(
      [recipientId],
      `${requesterName} wants to connect with you`,
      `View ${pronoun} profile and accept or decline`,
      {
        type: 'connection_request',
        requesterId,
      },
      'connection_request',
      requesterId,
      'user'
    );
  },

  // Connection request accepted
  async notifyConnectionAccepted(
    userId: string,
    accepterName: string,
    accepterId: string
  ) {
    await this.sendPushNotification(
      [userId],
      `${accepterName} accepted your connection request`,
      'You can now message each other',
      {
        type: 'connection_accepted',
        userId: accepterId,
      },
      'connection_accepted',
      accepterId,
      'user'
    );
  },

  // Application accepted
  async notifyApplicationAccepted(
    applicantId: string,
    pursuitId: string,
    pursuitName: string,
    creatorName: string
  ) {
    await this.sendPushNotification(
      [applicantId],
      `${creatorName} accepted your application to join "${pursuitName}"`,
      'Welcome to the team!',
      {
        type: 'application_accepted',
        pursuitId,
      },
      'application_accepted',
      pursuitId,
      'pursuit'
    );
  },

  // Application rejected
  async notifyApplicationRejected(
    applicantId: string,
    pursuitId: string,
    pursuitName: string,
    creatorName: string
  ) {
    await this.sendPushNotification(
      [applicantId],
      `${creatorName} did not accept your application to "${pursuitName}"`,
      'Keep exploring other pods that match your interests',
      {
        type: 'application_rejected',
        pursuitId,
      },
      'application_rejected',
      pursuitId,
      'pursuit'
    );
  },

  // Time proposal submitted
  async notifyTimeProposalSubmitted(
    creatorId: string,
    pursuitId: string,
    pursuitName: string,
    memberName: string,
    memberId?: string
  ) {
    const pronoun = memberId ? await fetchPossessivePronoun(memberId) : 'their';
    await this.sendPushNotification(
      [creatorId],
      `${memberName} submitted ${pronoun} availability for "${pursuitName}"`,
      'Review time proposals and schedule the kickoff meeting',
      {
        type: 'time_proposal',
        pursuitId,
      },
      'time_proposal',
      pursuitId,
      'pursuit'
    );
  },

  // Team board update
  async notifyTeamBoardUpdate(
    teamMemberIds: string[],
    pursuitId: string,
    pursuitName: string,
    updaterName: string,
    updateType: string
  ) {
    await this.sendPushNotification(
      teamMemberIds,
      `${updaterName} added ${updateType} to "${pursuitName}" team board`,
      'Check out the latest updates',
      {
        type: 'team_board_update',
        pursuitId,
      },
      'team_board_update',
      pursuitId,
      'pursuit'
    );
  },

  // New meeting created
  // Pursuit created notification
  async notifyPursuitCreated(
    creatorId: string,
    pursuitId: string,
    pursuitName: string
  ) {
    await this.sendPushNotification(
      [creatorId],
      'Pod Created! 🐋',
      `You successfully created "${pursuitName}". Share it with potential team members!`,
      {
        type: 'pursuit_created',
        pursuitId,
      },
      'pursuit_created',
      pursuitId,
      'pursuit'
    );
  },

  async notifyNewMeeting(
    participantIds: string[],
    meetingId: string,
    meetingTitle: string,
    creatorName: string,
    meetingDate: string,
    meetingTime: string
  ) {
    await this.sendPushNotification(
      participantIds,
      `${creatorName} scheduled "${meetingTitle}" for ${meetingTime} on ${meetingDate}`,
      'View details in your Calendar',
      {
        type: 'new_meeting',
        meetingId,
      },
      'meeting',
      meetingId,
      'meeting'
    );
  },

  // Meeting invitation notification
  async notifyMeetingInvitation(
    participantIds: string[],
    meetingId: string,
    meetingTitle: string,
    creatorName: string,
    meetingDate: string,
    meetingTime: string,
    pursuitName: string
  ) {
    await this.sendPushNotification(
      participantIds,
      `${creatorName} invited you to "${meetingTitle}"`,
      `${meetingDate} at ${meetingTime} - ${pursuitName}. Tap to respond.`,
      {
        type: 'meeting_invitation',
        meetingId,
      },
      'meeting_invitation',
      meetingId,
      'meeting'
    );
  },

  // Get unread notification count
  async getUnreadCount(userId: string): Promise<number> {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('read', false);

    if (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }

    return count || 0;
  },

  // Get unread counts by type for badge system
  async getUnreadCountsByType(userId: string): Promise<{
    messages: number;
    connections: number;
    applications: number;
    pods: number;
    calendar: number;
  }> {
    const { data, error } = await supabase
      .from('notifications')
      .select('type, related_id')
      .eq('user_id', userId)
      .eq('read', false);

    console.log('📊 All unread notifications:', data);
    console.log('📊 Notification types breakdown:', data?.map(n => ({ type: n.type, related_id: n.related_id })));

    if (error) {
      console.error('Error getting unread counts by type:', error);
      return { messages: 0, connections: 0, applications: 0, pods: 0, calendar: 0 };
    }

    const counts = {
      messages: 0,
      connections: 0,
      applications: 0,
      pods: 0,
      calendar: 0,
    };

    data?.forEach(notif => {
      switch (notif.type) {
        // Messages are NOT stored in notifications table - they use direct message count
        // These cases are kept for backward compatibility with any old data
        case 'message':
        case 'new_message':
        case 'pod_chat':
        case 'pod_chat_message':
          // Don't count these in alerts - they show in Chats tab badge
          break;
        case 'connection_request':
        case 'connection_accepted':
          counts.connections++;
          break;
        case 'application_received':
        case 'application_accepted':
        case 'application_rejected':
          counts.applications++;
          break;
        case 'pursuit_created':
        case 'min_team_size_reached':
        case 'kickoff_activated':
        case 'time_proposal':
        case 'team_board_update':
          counts.pods++;
          break;
        case 'kickoff_scheduled':
        case 'kickoff_scheduled_creator':
        case 'kickoff_scheduled_team':
        case 'meeting':
        case 'new_meeting':
          counts.calendar++;
          break;
      }
    });

    return counts;
  },

  // Mark all notifications as read for a specific type
  async markAllAsReadByType(userId: string, type: string) {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userId)
      .eq('type', type)
      .eq('read', false);

    if (error) {
      console.error('Error marking notifications as read:', error);
    }
  },

  // Get unread notification counts grouped by pursuit ID
  async getUnreadCountsByPursuit(userId: string): Promise<Map<string, number>> {
    // Pod-related notification types
    const podTypes = [
      'pursuit_created',
      'min_team_size_reached',
      'kickoff_activated',
      'time_proposal',
      'team_board_update',
      'all_proposals_submitted',
      'kickoff_scheduled',
      'kickoff_scheduled_creator',
      'kickoff_scheduled_team',
      'application_received',
      'application_accepted',
      'application_rejected',
      'member_removed',
      'member_left',
    ];

    console.log('🔍 Querying notifications for user:', userId);
    console.log('🔍 Looking for types:', podTypes);

    const { data, error } = await supabase
      .from('notifications')
      .select('related_id, type, read')
      .eq('user_id', userId)
      .eq('read', false)
      .in('type', podTypes);

    console.log('🔍 Query result - data:', data);
    console.log('🔍 Query result - error:', error);

    if (error) {
      console.error('Error getting unread counts by pursuit:', error);
      return new Map();
    }

    const counts = new Map<string, number>();
    data?.forEach(notif => {
      if (notif.related_id) {
        counts.set(notif.related_id, (counts.get(notif.related_id) || 0) + 1);
      }
    });

    console.log('🔍 Final counts map:', Object.fromEntries(counts));
    return counts;
  },

  // Interview scheduling requested - notify applicant to propose times
  async notifyInterviewSchedulingRequested(
    applicantId: string,
    applicationId: string,
    pursuitId: string,
    pursuitName: string,
    creatorName: string
  ) {
    await this.sendPushNotification(
      [applicantId],
      `${creatorName} wants to schedule an interview for "${pursuitName}"`,
      'Propose your available interview times for next week',
      {
        type: 'interview_scheduling_requested',
        applicationId,
        pursuitId,
      },
      'interview_scheduling_requested',
      applicationId,
      'application'
    );
  },

  // Interview times submitted - notify creator
  async notifyInterviewTimesSubmitted(
    creatorId: string,
    applicationId: string,
    pursuitId: string,
    pursuitName: string,
    applicantName: string,
    applicantId?: string
  ) {
    const pronoun = applicantId ? await fetchPossessivePronoun(applicantId) : 'their';
    await this.sendPushNotification(
      [creatorId],
      `${applicantName} submitted ${pronoun} interview availability for "${pursuitName}"`,
      `Review ${pronoun} times and schedule the interview`,
      {
        type: 'interview_times_submitted',
        applicationId,
        pursuitId,
      },
      'interview_times_submitted',
      applicationId,
      'application'
    );
  },

  // Interview scheduled - notify applicant
  async notifyInterviewScheduled(
    applicantId: string,
    applicationId: string,
    pursuitId: string,
    pursuitName: string,
    creatorName: string,
    interviewDate: string,
    interviewTime: string
  ) {
    await this.sendPushNotification(
      [applicantId],
      `Interview scheduled for "${pursuitName}"`,
      `${creatorName} scheduled your interview for ${interviewDate} at ${interviewTime}`,
      {
        type: 'interview_scheduled',
        applicationId,
        pursuitId,
      },
      'interview_scheduled',
      applicationId,
      'application'
    );
  },

  // Mark all notifications as read for a specific pursuit
  async markAllAsReadByPursuit(userId: string, pursuitId: string) {
    const podTypes = [
      'pursuit_created',
      'min_team_size_reached',
      'kickoff_activated',
      'time_proposal',
      'team_board_update',
      'all_proposals_submitted',
      'kickoff_scheduled',
      'kickoff_scheduled_creator',
      'kickoff_scheduled_team',
      'application_received',
      'application_accepted',
      'application_rejected',
      'member_removed',
      'member_left',
    ];

    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userId)
      .eq('related_id', pursuitId)
      .in('type', podTypes)
      .eq('read', false);

    if (error) {
      console.error('Error marking pursuit notifications as read:', error);
    }
  },
};
