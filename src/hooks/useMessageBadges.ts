import { useEffect } from 'react';
import { supabase } from '../config/supabase';
import { messageService } from '../services/messageService';

type Setter = (value: any) => void;

export function useMessageBadges(
  auth: any,
  { setUnreadMessageCount }: { setUnreadMessageCount: Setter }
) {
  const loadUnreadMessageCount = async () => {
    if (!auth.user) return;

    try {
      const count = await messageService.getUnreadCount(auth.user.id);
      console.log('💬 Unread message count:', count);
      setUnreadMessageCount(count);
    } catch (error) {
      console.error('Error loading unread message count:', error);
    }
  };

  // Load unread message count and set up real-time listener for messages
  useEffect(() => {
    if (auth.user) {
      loadUnreadMessageCount();

      console.log('💬 Setting up realtime messages listener for user:', auth.user.id);

      // Set up real-time listener for new messages
      const messagesChannel = supabase
        .channel('messages-badge')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `recipient_id=eq.${auth.user.id}`,
          },
          (payload) => {
            console.log('💬 NEW MESSAGE RECEIVED:', payload);
            // Refresh unread count when a new message arrives
            // No toast here - toast only shows on login for unread messages
            loadUnreadMessageCount();
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'messages',
            filter: `recipient_id=eq.${auth.user.id}`,
          },
          (payload) => {
            console.log('💬 MESSAGE UPDATED:', payload);
            // Refresh unread count when messages are marked as read
            loadUnreadMessageCount();
          }
        )
        .subscribe((status, err) => {
          console.log('💬 Messages subscription status:', status);
          if (err) {
            console.error('💬 Messages subscription error:', err);
          }
        });

      // Refresh count every 30 seconds as backup
      const interval = setInterval(loadUnreadMessageCount, 30000);

      return () => {
        console.log('💬 Cleaning up messages subscription');
        supabase.removeChannel(messagesChannel);
        clearInterval(interval);
      };
    }
  }, [auth.user]);

  return { loadUnreadMessageCount };
}
