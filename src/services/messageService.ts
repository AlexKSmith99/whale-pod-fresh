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
        conversationsMap.set(partnerId, {
          partnerId,
          partnerEmail,
          lastMessage: msg.content,
          lastMessageTime: msg.created_at,
          isRead: msg.is_read,
        });
      }
    });

    return Array.from(conversationsMap.values());
  },
};
