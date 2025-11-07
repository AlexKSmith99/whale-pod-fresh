import { supabase } from '../config/supabase';

export type NotificationType =
  | 'pod_ready_for_kickoff' // When min teammates quota hit
  | 'new_message' // New message in conversations
  | 'connection_request' // New connection request
  | 'connection_accepted' // Connection request accepted
  | 'pod_available' // Favorite pod becomes available
  | 'kickoff_scheduled' // Kickoff meeting scheduled
  | 'time_slot_request' // Creator requesting time slots
  | 'application_received' // Pursuit owner receives new application
  | 'application_accepted' // Applicant's application accepted
  | 'application_rejected'; // Applicant's application rejected

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  related_id?: string; // pursuit_id, message_id, user_id, etc.
  read: boolean;
  created_at: string;
}

export const notificationService = {
  // Create a notification
  async createNotification(data: {
    user_id: string;
    type: NotificationType;
    title: string;
    message: string;
    related_id?: string;
  }) {
    const { data: notification, error } = await supabase
      .from('notifications')
      .insert([{ ...data, read: false }])
      .select()
      .single();

    if (error) throw error;
    return notification;
  },

  // Get all notifications for a user
  async getNotifications(userId: string) {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Get unread notification count by type
  async getUnreadCountByType(userId: string, types: NotificationType[]) {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('read', false)
      .in('type', types);

    if (error) throw error;
    return count || 0;
  },

  // Get unread count for Messages tab
  async getMessagesUnreadCount(userId: string) {
    return this.getUnreadCountByType(userId, ['new_message']);
  },

  // Get unread count for Pods tab
  async getPodsUnreadCount(userId: string) {
    return this.getUnreadCountByType(userId, [
      'pod_ready_for_kickoff',
      'kickoff_scheduled',
      'time_slot_request'
    ]);
  },

  // Get unread count for Profile tab
  async getProfileUnreadCount(userId: string) {
    return this.getUnreadCountByType(userId, ['connection_request', 'connection_accepted']);
  },

  // Get total unread count for Notifications tab
  async getTotalUnreadCount(userId: string) {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('read', false);

    if (error) throw error;
    return count || 0;
  },

  // Get unread count for Feed tab
  async getFeedUnreadCount(userId: string) {
    return this.getUnreadCountByType(userId, ['pod_available']);
  },

  // Mark notification as read
  async markAsRead(notificationId: string) {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId);

    if (error) throw error;
  },

  // Mark all notifications of a type as read
  async markAllAsReadByType(userId: string, types: NotificationType[]) {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userId)
      .in('type', types);

    if (error) throw error;
  },

  // Notify creator that minimum teammates quota is reached
  async notifyKickoffReady(pursuitId: string, creatorId: string, pursuitTitle: string) {
    return this.createNotification({
      user_id: creatorId,
      type: 'pod_ready_for_kickoff',
      title: '🎉 Your Pod is Ready!',
      message: `"${pursuitTitle}" has reached the minimum number of teammates. Schedule your kickoff meeting!`,
      related_id: pursuitId,
    });
  },

  // Notify team members about kickoff scheduled
  async notifyKickoffScheduled(pursuitId: string, memberIds: string[], pursuitTitle: string, kickoffDate: string) {
    const notifications = memberIds.map(memberId => ({
      user_id: memberId,
      type: 'kickoff_scheduled' as NotificationType,
      title: '📅 Kickoff Scheduled!',
      message: `The kickoff meeting for "${pursuitTitle}" is scheduled for ${kickoffDate}`,
      related_id: pursuitId,
      read: false,
    }));

    const { error } = await supabase
      .from('notifications')
      .insert(notifications);

    if (error) throw error;
  },

  // Notify team members to propose time slots
  async notifyTimeSlotRequest(pursuitId: string, memberIds: string[], pursuitTitle: string) {
    const notifications = memberIds.map(memberId => ({
      user_id: memberId,
      type: 'time_slot_request' as NotificationType,
      title: '📅 Time Slot Request',
      message: `Please propose your available time slots for "${pursuitTitle}" kickoff meeting`,
      related_id: pursuitId,
      read: false,
    }));

    const { error } = await supabase
      .from('notifications')
      .insert(notifications);

    if (error) throw error;
  },

  // Notify pursuit creator of new application
  async notifyApplicationReceived(pursuitId: string, creatorId: string, applicantName: string, pursuitTitle: string) {
    return this.createNotification({
      user_id: creatorId,
      type: 'application_received',
      title: '📬 New Application',
      message: `${applicantName} applied to join "${pursuitTitle}"`,
      related_id: pursuitId,
    });
  },

  // Notify applicant that their application was accepted
  async notifyApplicationAccepted(pursuitId: string, applicantId: string, pursuitTitle: string) {
    return this.createNotification({
      user_id: applicantId,
      type: 'application_accepted',
      title: '✅ Application Accepted!',
      message: `Your application to "${pursuitTitle}" has been accepted! Welcome to the team.`,
      related_id: pursuitId,
    });
  },

  // Notify applicant that their application was rejected
  async notifyApplicationRejected(pursuitId: string, applicantId: string, pursuitTitle: string) {
    return this.createNotification({
      user_id: applicantId,
      type: 'application_rejected',
      title: '❌ Application Update',
      message: `Your application to "${pursuitTitle}" was not accepted this time.`,
      related_id: pursuitId,
    });
  },

  // Notify user that their connection request was accepted
  async notifyConnectionAccepted(userId: string, acceptorName: string, acceptorId: string) {
    return this.createNotification({
      user_id: userId,
      type: 'connection_accepted',
      title: '🤝 Connection Accepted!',
      message: `${acceptorName} accepted your connection request`,
      related_id: acceptorId,
    });
  },
};
