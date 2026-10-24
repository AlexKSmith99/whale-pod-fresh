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

/**
 * Which preference switch governs each notification type.
 *
 * Categories match the columns in migration 081. Pod chat and DMs separate
 * cleanly because pod chat sends `pod_chat_message` (PodChatScreen) while DMs
 * send `new_message` (ChatScreen).
 */
const PUSH_CATEGORY_BY_TYPE: Record<string, string> = {
  // Pod activity
  kickoff_activated: 'pod_alerts',
  kickoff_scheduled: 'pod_alerts',
  kickoff_scheduled_team: 'pod_alerts',
  kickoff_scheduled_creator: 'pod_alerts',
  min_team_size_reached: 'pod_alerts',
  all_proposals_submitted: 'pod_alerts',
  time_proposal: 'pod_alerts',
  new_meeting: 'pod_alerts',
  meeting: 'pod_alerts',
  meeting_invitation: 'pod_alerts',
  team_board_update: 'pod_alerts',
  pursuit_created: 'pod_alerts',

  // Messages
  pod_chat_message: 'pod_chats',
  new_message: 'direct_messages',
  message: 'direct_messages',

  // Joining a pod
  application_received: 'applications',
  application_accepted: 'applications',
  application_rejected: 'applications',
  membership_approved: 'applications',
  membership_rejected: 'applications',
  edit_access: 'applications',

  connection_request: 'connections',
  connection_accepted: 'connections',

  general: 'from_whale_pod',
};

/**
 * Unknown types deliberately fall through to 'uncategorized', which is NOT one
 * of the categories get_pushable_tokens recognises — so the RPC delivers it.
 * A notification nobody fine-tuned is better than silence caused by a type
 * someone forgot to add to the map above.
 */
export function pushCategoryForType(type?: string): string {
  return (type && PUSH_CATEGORY_BY_TYPE[type]) || 'uncategorized';
}

/**
 * Expo tokens for recipients who actually want this category of push.
 *
 * Goes through get_pushable_tokens (migration 081) rather than reading
 * push_tokens directly, so preference filtering happens in the database and
 * senders never see anyone else's preferences.
 */
async function fetchPushableTokens(
  userIds: string[],
  type?: string
): Promise<{ user_id: string; expo_push_token: string }[]> {
  if (!userIds || userIds.length === 0) return [];

  const { data, error } = await supabase.rpc('get_pushable_tokens', {
    p_user_ids: userIds,
    p_category: pushCategoryForType(type),
  });

  if (!error) return (data as any[]) || [];

  // Fallback for environments where 081 hasn't been applied yet: behave exactly
  // as before (push everyone with a token), so notifications keep working
  // regardless of migration/deploy ordering.
  const { data: rows } = await supabase
    .from('push_tokens')
    .select('expo_push_token, user_id')
    .in('user_id', userIds);
  return (rows as any[]) || [];
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

      // Only recipients whose preferences allow this category. sendPushOnly
      // has no `type` parameter — callers put it in `data` (e.g. PodChatScreen
      // sends 'pod_chat_message', ChatScreen sends 'new_message'), which is
      // what separates pod chats from DMs.
      const tokens = await fetchPushableTokens(userIds, (data as any)?.type);

      if (!tokens || tokens.length === 0) {
        console.log('No pushable tokens (none registered, or push disabled for this category) - skipping push notification');
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
    relatedType?: string,
    // Who triggered this, for the avatar in the alerts tab (migration 082).
    // Optional: not every notification has a human actor — some are triggered
    // by state changes (a pod hitting its minimum size) rather than a person.
    actorId?: string
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
        actor_id: actorId || null,
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

      // Only recipients whose preferences allow this category. The in-app
      // notification row was already written above regardless — the preference
      // governs whether the phone also buzzes, not whether the notification
      // exists, so the Alerts inbox stays complete.
      const tokens = await fetchPushableTokens(userIds, type);

      if (!tokens || tokens.length === 0) {
        console.log('No pushable tokens (none registered, or push disabled for this category) - in-app notification already created');
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
    // Embeds the actor's profile in the same round trip. This only resolves
    // because 082 points notifications.actor_id at profiles(id) rather than
    // auth.users — PostgREST cannot traverse into the auth schema, which is
    // what makes the equivalent embed off meetings.creator_id fail (PGRST200).
    const { data, error } = await supabase
      .from('notifications')
      .select('*, actor:profiles!notifications_actor_id_fkey(id, name, profile_picture)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (!error) return data || [];

    // Fallback for environments where 082 hasn't been applied: no actor column
    // or FK yet, so fetch plain rows and let the UI show its typed icons.
    const { data: plain, error: plainError } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (plainError) {
      console.error('Error fetching notifications:', plainError);
      return [];
    }

    return plain || [];
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
      `${applicantName} wants in on "${pursuitName}"`,
      `peep ${pronoun} application in the pods tab`,
      {
        type: 'application_received',
        pursuitId,
      },
      'application_received',
      pursuitId,
      'pursuit',
      applicantId
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
      'team ready',
      `"${pursuitName}" hit ${currentSize}/${minSize}. time to lock it in.`,
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
    creatorName: string,
    actorId?: string
  ) {
    await this.sendPushNotification(
      teamMemberIds,
      `${creatorName} just dropped a kickoff for "${pursuitName}"`,
      "drop your availability rn — let's get this on the books",
      {
        type: 'kickoff_activated',
        pursuitId,
      },
      'kickoff_activated',
      pursuitId,
      'pursuit',
      actorId
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
      'everyone replied',
      `all ${proposalCount} pod members dropped their times for "${pursuitName}". pick a slot.`,
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
    meetingTime: string,
    actorId?: string
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
      'pursuit',
      actorId
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
      `${requesterName} wants to connect`,
      `peep ${pronoun} profile and decide`,
      {
        type: 'connection_request',
        requesterId,
      },
      'connection_request',
      requesterId,
      'user',
      requesterId
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
      `${accepterName} accepted`,
      'you can chat now. slide in.',
      {
        type: 'connection_accepted',
        userId: accepterId,
      },
      'connection_accepted',
      accepterId,
      'user',
      accepterId
    );
  },

  // Application accepted
  async notifyApplicationAccepted(
    applicantId: string,
    pursuitId: string,
    pursuitName: string,
    creatorName: string,
    actorId?: string
  ) {
    await this.sendPushNotification(
      [applicantId],
      `you're in! "${pursuitName}"`,
      `${creatorName} let you in. welcome to the pod.`,
      {
        type: 'application_accepted',
        pursuitId,
      },
      'application_accepted',
      pursuitId,
      'pursuit',
      actorId
    );
  },

  // Application rejected
  async notifyApplicationRejected(
    applicantId: string,
    pursuitId: string,
    pursuitName: string,
    creatorName: string,
    actorId?: string
  ) {
    await this.sendPushNotification(
      [applicantId],
      `update on "${pursuitName}"`,
      `${creatorName} passed this time. plenty more pods out there`,
      {
        type: 'application_rejected',
        pursuitId,
      },
      'application_rejected',
      pursuitId,
      'pursuit',
      actorId
    );
  },

  // Membership application approved (waitlist → member)
  async notifyMembershipApproved(
    applicantId: string,
    actorId?: string
  ) {
    await this.sendPushNotification(
      [applicantId],
      `you're in! welcome to whale pod`,
      `your application was approved. tap to set up your profile.`,
      { type: 'membership_approved' },
      'membership_approved',
      actorId
    );
  },

  // Membership application rejected
  async notifyMembershipRejected(
    applicantId: string,
    actorId?: string
  ) {
    await this.sendPushNotification(
      [applicantId],
      `update on your application`,
      `we're not able to offer you a spot right now.`,
      { type: 'membership_rejected' },
      'membership_rejected',
      actorId
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
      `${memberName} dropped ${pronoun} availability for "${pursuitName}"`,
      "peep the times and lock the kickoff in",
      {
        type: 'time_proposal',
        pursuitId,
      },
      'time_proposal',
      pursuitId,
      'pursuit',
      memberId
    );
  },

  // Team board update
  async notifyTeamBoardUpdate(
    teamMemberIds: string[],
    pursuitId: string,
    pursuitName: string,
    updaterName: string,
    updateType: string,
    actorId?: string
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
      'pursuit',
      actorId
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
      'pod: secured',
      `"${pursuitName}" is live. now go round up your people.`,
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
    meetingTime: string,
    actorId?: string
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
      'meeting',
      actorId
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
    pursuitName: string,
    actorId?: string
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
      'meeting',
      actorId
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
    creatorName: string,
    actorId?: string
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
      'application',
      actorId
    );
  },

  // Interview times submitted - notify creator
  async notifyInterviewTimesSubmitted(
    creatorId: string,
    applicationId: string,
    pursuitId: string,
    pursuitName: string,
    applicantName: string,
    applicantId?: string,
    actorId?: string
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
      'application',
      actorId
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
    interviewTime: string,
    actorId?: string
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
      'application',
      actorId
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
