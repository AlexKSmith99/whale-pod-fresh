import { supabase } from '../config/supabase';

export const messageLikeService = {
  // Toggle like on a message. Returns true if liked, false if unliked.
  async toggleLike(messageId: string, messageType: 'direct' | 'pod', userId: string): Promise<boolean> {
    // Check if already liked
    const { data: existing } = await supabase
      .from('message_likes')
      .select('id')
      .eq('message_id', messageId)
      .eq('message_type', messageType)
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) {
      // Unlike
      const { error } = await supabase
        .from('message_likes')
        .delete()
        .eq('id', existing.id);
      if (error) throw error;
      return false;
    } else {
      // Like
      const { error } = await supabase
        .from('message_likes')
        .insert({ message_id: messageId, message_type: messageType, user_id: userId });
      if (error) throw error;
      return true;
    }
  },

  // Get likes for a batch of messages. Returns { messageId: [userId, ...] }
  async getLikesForMessages(messageIds: string[], messageType: 'direct' | 'pod'): Promise<Record<string, string[]>> {
    if (messageIds.length === 0) return {};

    const { data, error } = await supabase
      .from('message_likes')
      .select('message_id, user_id')
      .eq('message_type', messageType)
      .in('message_id', messageIds);

    if (error || !data) return {};

    const likesMap: Record<string, string[]> = {};
    data.forEach((like: any) => {
      if (!likesMap[like.message_id]) likesMap[like.message_id] = [];
      likesMap[like.message_id].push(like.user_id);
    });
    return likesMap;
  },
};
