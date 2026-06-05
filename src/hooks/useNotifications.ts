import { useEffect } from 'react';
import { supabase } from '../config/supabase';
import { notificationService } from '../services/notificationService';
import { messageService } from '../services/messageService';
import { podChatService } from '../services/podChatService';

type Setter = (value: any) => void;

export function useNotifications(
  auth: any,
  { setBadgeCounts, setCurrentToast }: { setBadgeCounts: Setter; setCurrentToast: Setter }
) {
  const checkForUnreadMessages = async () => {
    if (!auth.user) return;

    try {
      // Get unread direct message count
      const unreadDmCount = await messageService.getUnreadCount(auth.user.id);
      
      // Get unread pod chat count
      let unreadPodChatCount = 0;
      let mostRecentPodChat: any = null;
      try {
        const podChats = await podChatService.getUserPodChats(auth.user.id);
        const unreadPodChats = podChats.filter(pc => pc.unread_count > 0);
        unreadPodChatCount = unreadPodChats.reduce((sum, pc) => sum + pc.unread_count, 0);
        
        // Get the most recent unread pod chat
        if (unreadPodChats.length > 0) {
          mostRecentPodChat = unreadPodChats.sort((a, b) => {
            const timeA = a.last_message_time ? new Date(a.last_message_time).getTime() : 0;
            const timeB = b.last_message_time ? new Date(b.last_message_time).getTime() : 0;
            return timeB - timeA;
          })[0];
        }
      } catch (podChatError) {
        console.error('Error checking pod chats:', podChatError);
      }
      
      const totalUnread = unreadDmCount + unreadPodChatCount;
      
      if (totalUnread > 0) {
        console.log('💬 Found unread messages on login:', { dm: unreadDmCount, podChat: unreadPodChatCount });
        
        // Get the most recent unread direct message
        const { data: recentMessages, error } = await supabase
          .from('messages')
          .select('*, sender:profiles!sender_id(name, email)')
          .eq('recipient_id', auth.user.id)
          .or('is_read.eq.false,is_read.is.null')
          .order('created_at', { ascending: false })
          .limit(1);

        const recentDm = (!error && recentMessages && recentMessages.length > 0) ? recentMessages[0] : null;
        
        // Determine which is more recent: DM or pod chat
        const dmTime = recentDm ? new Date(recentDm.created_at).getTime() : 0;
        const podChatTime = mostRecentPodChat?.last_message_time 
          ? new Date(mostRecentPodChat.last_message_time).getTime() 
          : 0;
        
        if (dmTime >= podChatTime && recentDm) {
          // Show DM toast
          const senderProfile = recentDm.sender as any;
          const senderName = senderProfile?.name || senderProfile?.email?.split('@')[0] || 'Someone';
          const messagePreview = recentDm.content?.length > 50 
            ? recentDm.content.substring(0, 50) + '...' 
            : recentDm.content;

          setCurrentToast({
            title: `New chat from ${senderName}`,
            body: messagePreview,
            type: 'new_message',
            id: recentDm.id,
            data: {
              conversationId: recentDm.sender_id,
            },
          });
        } else if (mostRecentPodChat) {
          // Show pod chat toast
          const chatName = mostRecentPodChat.custom_name || mostRecentPodChat.pursuit_title;
          const messagePreview = mostRecentPodChat.last_message?.length > 50 
            ? mostRecentPodChat.last_message.substring(0, 50) + '...' 
            : mostRecentPodChat.last_message || 'New message';

          setCurrentToast({
            title: `New chat in ${chatName}`,
            body: messagePreview,
            type: 'pod_chat_message',
            id: mostRecentPodChat.pursuit_id,
            data: {
              pursuitId: mostRecentPodChat.pursuit_id,
            },
          });
        }
      }
    } catch (error) {
      console.error('Error checking for unread messages:', error);
    }
  };

  const checkForUnreadNotifications = async () => {
    if (!auth.user) return;

    try {
      // Get the most recent unread notification
      const notifications = await notificationService.getUserNotifications(auth.user.id);
      // Filter out message notifications - those only show badges, not toasts
      const unreadNotifications = notifications.filter((n: any) =>
        !n.read && n.type !== 'message' && n.type !== 'new_message'
      );

      if (unreadNotifications.length > 0) {
        const mostRecent = unreadNotifications[0];
        console.log('🔔 Found unread notification on login:', mostRecent);

        // Show toast for most recent unread notification
        setCurrentToast({
          title: mostRecent.title,
          body: mostRecent.body,
          type: mostRecent.type,
          id: mostRecent.id,
          notificationId: mostRecent.id,
          data: mostRecent.data,
        });
      } else {
        // No regular notifications, check for unread messages
        await checkForUnreadMessages();
      }
    } catch (error) {
      console.error('Error checking for unread notifications:', error);
    }
  };

  const loadBadgeCounts = async () => {
    if (!auth.user) return;

    try {
      const counts = await notificationService.getUnreadCountsByType(auth.user.id);
      const totalUnread = await notificationService.getUnreadCount(auth.user.id);
      setBadgeCounts({
        ...counts,
        notifications: totalUnread,
      });
    } catch (error) {
      console.error('Error loading badge counts:', error);
    }
  };

  const clearBadgeForTab = async (tab: string) => {
    if (!auth.user) return;

    // Map tab to notification types
    const typeMap: { [key: string]: string[] } = {
      'Messages': ['message', 'new_message'],
      'Pods': ['min_team_size_reached', 'kickoff_activated', 'time_proposal', 'team_board_update'],
      'Calendar': ['kickoff_scheduled', 'kickoff_scheduled_creator', 'kickoff_scheduled_team', 'meeting', 'new_meeting', 'meeting_invitation'],
      'Profile': ['connection_request', 'connection_accepted'],
    };

    const types = typeMap[tab];
    if (types) {
      for (const type of types) {
        await notificationService.markAllAsReadByType(auth.user.id, type);
      }
      loadBadgeCounts();
    }
  };

  // Load notification badge counts and set up real-time listener
  useEffect(() => {
    if (auth.user) {
      loadBadgeCounts();

      // Check for unread notifications on login and show most recent one
      checkForUnreadNotifications();

      console.log('🔔 Setting up realtime notification listener for user:', auth.user.id);

      // Set up real-time listener for new notifications
      const channel = supabase
        .channel('notifications')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${auth.user.id}`,
          },
          (payload) => {
            console.log('🔔 NEW NOTIFICATION RECEIVED VIA REALTIME:', payload);
            const newNotification = payload.new as any;

            // Don't show toast for message notifications (those only show badge)
            if (newNotification.type !== 'message' && newNotification.type !== 'new_message') {
              // Show toast - include data for navigation
              setCurrentToast({
                title: newNotification.title,
                body: newNotification.body,
                type: newNotification.type,
                id: newNotification.id,
                notificationId: newNotification.id,
                data: newNotification.data, // Include data for interview navigation
              });
            }

            // Refresh badge counts
            loadBadgeCounts();
          }
        )
        .subscribe((status, err) => {
          console.log('🔔 Realtime subscription status:', status);
          if (err) {
            console.error('🔔 Realtime subscription error:', err);
          }
          if (status === 'SUBSCRIBED') {
            console.log('🔔 Successfully subscribed to notifications channel');
          }
        });

      // Refresh counts every 30 seconds as backup
      const interval = setInterval(loadBadgeCounts, 30000);

      return () => {
        console.log('🔔 Cleaning up realtime subscription');
        supabase.removeChannel(channel);
        clearInterval(interval);
      };
    }
  }, [auth.user]);

  return { loadBadgeCounts, clearBadgeForTab };
}
