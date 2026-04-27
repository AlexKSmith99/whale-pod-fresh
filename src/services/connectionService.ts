import { supabase } from '../config/supabase';
import { notificationService } from './notificationService';

// Resolve a display name for a given user id (falls back to email local-part).
const resolveDisplayName = async (userId: string): Promise<string> => {
  try {
    const { data } = await supabase
      .from('profiles')
      .select('name, email')
      .eq('id', userId)
      .single();
    return data?.name || data?.email?.split('@')[0] || 'Someone';
  } catch {
    return 'Someone';
  }
};

export const connectionService = {
  // Send connection request — creates a pending row AND fires an alert-tab notification
  // so the recipient sees it in Notifications and as a toast popup.
  sendConnectionRequest: async (userId1: string, userId2: string) => {
    const { data, error } = await supabase
      .from('connections')
      .insert([
        {
          user_id_1: userId1,
          user_id_2: userId2,
          status: 'pending',
        },
      ])
      .select()
      .single();

    if (error) throw error;

    // Fire the notification (non-blocking — send failures shouldn't reverse the request)
    try {
      const requesterName = await resolveDisplayName(userId1);
      await notificationService.notifyConnectionRequest(userId2, requesterName, userId1);
    } catch (err) {
      console.warn('notifyConnectionRequest failed:', err);
    }

    return data;
  },

  // Accept connection request — fires a notification back to the original requester.
  acceptConnection: async (connectionId: string) => {
    const { data, error } = await supabase
      .from('connections')
      .update({ status: 'accepted' })
      .eq('id', connectionId)
      .select()
      .single();

    if (error) throw error;

    // Notify the other side that the connection was accepted
    try {
      const { data: sessionData } = await supabase.auth.getUser();
      const currentUserId = sessionData?.user?.id;
      // The original requester is whichever user id isn't the current one
      const otherUserId = data.user_id_1 === currentUserId ? data.user_id_2 : data.user_id_1;
      if (otherUserId && currentUserId && otherUserId !== currentUserId) {
        const accepterName = await resolveDisplayName(currentUserId);
        await notificationService.notifyConnectionAccepted(otherUserId, accepterName, currentUserId);
      }
    } catch (err) {
      console.warn('notifyConnectionAccepted failed:', err);
    }

    return data;
  },

  // Reject/Delete connection
  rejectConnection: async (connectionId: string) => {
    const { error } = await supabase
      .from('connections')
      .delete()
      .eq('id', connectionId);

    if (error) throw error;
  },

  // Get user connections with profile data
  getMyConnections: async (userId: string) => {
    const { data, error } = await supabase
      .from('connections')
      .select('*')
      .or(`user_id_1.eq.${userId},user_id_2.eq.${userId}`)
      .eq('status', 'accepted');

    if (error) throw error;

    // Manually fetch profile data for each connection
    const connections = await Promise.all(
      (data || []).map(async (conn) => {
        const otherUserId = conn.user_id_1 === userId ? conn.user_id_2 : conn.user_id_1;
        const { data: profileData } = await supabase
          .from('profiles')
          .select('name, profile_picture, email, bio')
          .eq('id', otherUserId)
          .single();
        return { ...conn, profile: profileData, otherUserId };
      })
    );

    return connections;
  },

  // Get pending connection requests with profile data
  getPendingRequests: async (userId: string) => {
    const { data, error } = await supabase
      .from('connections')
      .select('*')
      .eq('user_id_2', userId)
      .eq('status', 'pending');

    if (error) throw error;

    // Manually fetch profile data for each request
    const requests = await Promise.all(
      (data || []).map(async (req) => {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('name, profile_picture, email')
          .eq('id', req.user_id_1)
          .single();
        return { ...req, profile: profileData };
      })
    );

    return requests;
  },

  // Get sent connection requests with profile data
  getSentRequests: async (userId: string) => {
    const { data, error } = await supabase
      .from('connections')
      .select('*')
      .eq('user_id_1', userId)
      .eq('status', 'pending');

    if (error) throw error;

    // Manually fetch profile data for each request
    const requests = await Promise.all(
      (data || []).map(async (req) => {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('name, profile_picture, email')
          .eq('id', req.user_id_2)
          .single();
        return { ...req, profile: profileData };
      })
    );

    return requests;
  },

  // Check if users are connected
  areConnected: async (userId1: string, userId2: string) => {
    const { data, error } = await supabase
      .from('connections')
      .select('*')
      .or(`and(user_id_1.eq.${userId1},user_id_2.eq.${userId2}),and(user_id_1.eq.${userId2},user_id_2.eq.${userId1})`)
      .eq('status', 'accepted')
      .maybeSingle();

    return !!data && !error;
  },
};