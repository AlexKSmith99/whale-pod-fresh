import { supabase } from '../config/supabase';

export interface PodChatMessage {
  id: string;
  pursuit_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender?: {
    name: string;
    email: string;
    profile_picture?: string;
  };
}

export interface PodChat {
  pursuit_id: string;
  pursuit_title: string;
  custom_name?: string;
  default_picture?: string;
  last_message?: string;
  last_message_time?: string;
  unread_count: number;
  member_count: number;
}

export const podChatService = {
  // Send a message to a pod chat
  async sendMessage(pursuitId: string, senderId: string, content: string): Promise<PodChatMessage> {
    const { data, error } = await supabase
      .from('pod_chat_messages')
      .insert([{
        pursuit_id: pursuitId,
        sender_id: senderId,
        content,
      }])
      .select(`
        *,
        sender:profiles!sender_id(name, email, profile_picture)
      `)
      .single();

    if (error) throw error;
    return data;
  },

  // Get messages for a pod chat
  async getMessages(pursuitId: string): Promise<PodChatMessage[]> {
    const { data, error } = await supabase
      .from('pod_chat_messages')
      .select(`
        *,
        sender:profiles!sender_id(name, email, profile_picture)
      `)
      .eq('pursuit_id', pursuitId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  // Get all pod chats for a user (pods they're a member of)
  async getUserPodChats(userId: string): Promise<PodChat[]> {
    // Get pursuits where user is creator
    const { data: createdPursuits, error: createdError } = await supabase
      .from('pursuits')
      .select('*')
      .eq('creator_id', userId);

    if (createdError) throw createdError;

    // Get pursuits where user is an active team member
    const { data: memberPursuits, error: memberError } = await supabase
      .from('team_members')
      .select(`
        pursuit_id,
        pursuits(*)
      `)
      .eq('user_id', userId)
      .in('status', ['active', 'accepted']);

    if (memberError) throw memberError;

    // Combine and dedupe
    const allPursuitIds = new Set<string>();
    const pursuits: { id: string; title: string; default_picture?: string }[] = [];

    createdPursuits?.forEach((p) => {
      if (!allPursuitIds.has(p.id)) {
        allPursuitIds.add(p.id);
        pursuits.push(p);
      }
    });

    memberPursuits?.forEach((m: any) => {
      if (m.pursuits && !allPursuitIds.has(m.pursuits.id)) {
        allPursuitIds.add(m.pursuits.id);
        pursuits.push(m.pursuits);
      }
    });

    // Get custom names from pod_chat_settings if they exist
    const pursuitIds = pursuits.map(p => p.id);
    const { data: settings } = await supabase
      .from('pod_chat_settings')
      .select('pursuit_id, custom_name')
      .in('pursuit_id', pursuitIds);

    const settingsMap = new Map(settings?.map(s => [s.pursuit_id, s.custom_name]) || []);

    // Get last message and unread count for each pod chat
    const podChats: PodChat[] = await Promise.all(
      pursuits.map(async (pursuit) => {
        // Get last message
        const { data: lastMsg } = await supabase
          .from('pod_chat_messages')
          .select('content, created_at')
          .eq('pursuit_id', pursuit.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        // Get unread count (messages after user's last read timestamp)
        const { data: readStatus } = await supabase
          .from('pod_chat_read_status')
          .select('last_read_at')
          .eq('pursuit_id', pursuit.id)
          .eq('user_id', userId)
          .single();

        let unreadCount = 0;
        if (readStatus?.last_read_at) {
          const { count } = await supabase
            .from('pod_chat_messages')
            .select('*', { count: 'exact', head: true })
            .eq('pursuit_id', pursuit.id)
            .gt('created_at', readStatus.last_read_at)
            .neq('sender_id', userId);
          unreadCount = count || 0;
        } else {
          // If no read status, count all messages not sent by user
          const { count } = await supabase
            .from('pod_chat_messages')
            .select('*', { count: 'exact', head: true })
            .eq('pursuit_id', pursuit.id)
            .neq('sender_id', userId);
          unreadCount = count || 0;
        }

        // Get member count
        const { count: memberCount } = await supabase
          .from('team_members')
          .select('*', { count: 'exact', head: true })
          .eq('pursuit_id', pursuit.id)
          .in('status', ['active', 'accepted']);

        return {
          pursuit_id: pursuit.id,
          pursuit_title: pursuit.title,
          custom_name: settingsMap.get(pursuit.id),
          default_picture: pursuit.default_picture,
          last_message: lastMsg?.content,
          last_message_time: lastMsg?.created_at,
          unread_count: unreadCount,
          member_count: (memberCount || 0) + 1, // +1 for creator
        };
      })
    );

    // Sort by last message time
    return podChats.sort((a, b) => {
      if (!a.last_message_time) return 1;
      if (!b.last_message_time) return -1;
      return new Date(b.last_message_time).getTime() - new Date(a.last_message_time).getTime();
    });
  },

  // Mark pod chat as read
  async markAsRead(pursuitId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('pod_chat_read_status')
      .upsert({
        pursuit_id: pursuitId,
        user_id: userId,
        last_read_at: new Date().toISOString(),
      }, {
        onConflict: 'pursuit_id,user_id',
      });

    if (error) throw error;
  },

  // Update pod chat custom name
  async updateChatName(pursuitId: string, customName: string): Promise<void> {
    const { error } = await supabase
      .from('pod_chat_settings')
      .upsert({
        pursuit_id: pursuitId,
        custom_name: customName,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'pursuit_id',
      });

    if (error) throw error;
  },

  // Check if user is a member of a pod
  async isUserPodMember(pursuitId: string, userId: string): Promise<boolean> {
    // Check if creator
    const { data: pursuit } = await supabase
      .from('pursuits')
      .select('creator_id')
      .eq('id', pursuitId)
      .single();

    if (pursuit?.creator_id === userId) return true;

    // Check if team member
    const { data: membership } = await supabase
      .from('team_members')
      .select('status')
      .eq('pursuit_id', pursuitId)
      .eq('user_id', userId)
      .in('status', ['active', 'accepted'])
      .single();

    return !!membership;
  },

  // Get pod chat members
  async getPodMembers(pursuitId: string): Promise<any[]> {
    // Get creator
    const { data: pursuit } = await supabase
      .from('pursuits')
      .select(`
        creator_id,
        creator:profiles!creator_id(id, name, email, profile_picture)
      `)
      .eq('id', pursuitId)
      .single();

    // Get team members
    const { data: members } = await supabase
      .from('team_members')
      .select(`
        user_id,
        user:profiles!user_id(id, name, email, profile_picture)
      `)
      .eq('pursuit_id', pursuitId)
      .in('status', ['active', 'accepted']);

    const allMembers = [];

    if (pursuit?.creator) {
      allMembers.push({
        ...pursuit.creator,
        isCreator: true,
      });
    }

    members?.forEach((m: any) => {
      if (m.user && m.user.id !== pursuit?.creator_id) {
        allMembers.push({
          ...m.user,
          isCreator: false,
        });
      }
    });

    return allMembers;
  },
};
