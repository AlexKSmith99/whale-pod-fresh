import { supabase } from '../config/supabase';

export const messageService = {
  // Send a message
  async sendMessage(senderId: string, recipientId: string, content: string) {
    const { data, error } = await supabase
      .from('messages')
      .insert([{
        sender_id: senderId,
        recipient_id: recipientId,
        content,
        is_read: false,
      }])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Get conversation between two users
  async getConversation(userId1: string, userId2: string) {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${userId1},recipient_id.eq.${userId2}),and(sender_id.eq.${userId2},recipient_id.eq.${userId1})`)
      .order('created_at', { ascending: true });
    
    if (error) throw error;
    return data || [];
  },

  // Get all conversations for a user
  async getConversations(userId: string) {
    const { data, error } = await supabase
      .from('messages')
      .select('*, sender:profiles!sender_id(email), recipient:profiles!recipient_id(email)')
      .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Group by conversation partner
    const conversationsMap = new Map();
    data?.forEach((msg: any) => {
      const partnerId = msg.sender_id === userId ? msg.recipient_id : msg.sender_id;
      const partnerEmail = msg.sender_id === userId ? msg.recipient?.email : msg.sender?.email;

      if (!conversationsMap.has(partnerId)) {
        // Check if there are any unread messages FROM this partner TO the current user
        const hasUnreadMessages = data.some((m: any) =>
          m.sender_id === partnerId &&
          m.recipient_id === userId &&
          !m.is_read
        );

        console.log(`📧 Conversation with ${partnerId}: hasUnreadMessages=${hasUnreadMessages}`);

        conversationsMap.set(partnerId, {
          partnerId,
          partnerEmail,
          lastMessage: msg.content,
          lastMessageTime: msg.created_at,
          isRead: !hasUnreadMessages, // Show blue dot if there are unread messages
        });
      }
    });

    return Array.from(conversationsMap.values());
  },

  // Mark all messages from a partner as read
  async markConversationAsRead(userId: string, partnerId: string) {
    console.log('📧 Marking conversation as read - userId:', userId, 'partnerId:', partnerId);

    const { data, error } = await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('recipient_id', userId)
      .eq('sender_id', partnerId)
      .eq('is_read', false)
      .select();

    if (error) {
      console.error('❌ Error marking messages as read:', error);
      throw error;
    }

    console.log(`✅ Marked ${data?.length || 0} messages as read`);
    return data;
  },

  // Get total count of unread messages for a user
  async getUnreadCount(userId: string): Promise<number> {
    const { count, error } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('recipient_id', userId)
      .eq('is_read', false);

    if (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }

    return count || 0;
  },

  // Get count of unread messages from a specific sender
  async getUnreadCountFromSender(userId: string, senderId: string): Promise<number> {
    const { count, error } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('recipient_id', userId)
      .eq('sender_id', senderId)
      .eq('is_read', false);

    if (error) {
      console.error('Error getting unread count from sender:', error);
      return 0;
    }

    return count || 0;
  },
};
