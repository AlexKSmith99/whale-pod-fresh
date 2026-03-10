/**
 * React Query hooks for cached data fetching
 * These hooks provide instant data on repeat visits and background refreshing
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../config/supabase';
import { pursuitService } from '../services/pursuitService';
import { messageService } from '../services/messageService';
import { notificationService } from '../services/notificationService';
import { connectionService } from '../services/connectionService';
import { reviewService } from '../services/reviewService';
import { podChatService } from '../services/podChatService';
import { meetingService } from '../services/meetingService';

// Query Keys - centralized for easy invalidation
export const queryKeys = {
  // Feed & Pursuits
  feed: ['feed'] as const,
  pursuit: (id: string) => ['pursuit', id] as const,
  myPursuits: (userId: string) => ['myPursuits', userId] as const,
  appliedPursuits: (userId: string) => ['appliedPursuits', userId] as const,

  // Profiles
  profile: (userId: string) => ['profile', userId] as const,

  // Messages
  conversations: (userId: string) => ['conversations', userId] as const,
  messages: (partnerId: string) => ['messages', partnerId] as const,
  unreadCount: (userId: string) => ['unreadCount', userId] as const,

  // Pod Chats
  podChats: (userId: string) => ['podChats', userId] as const,
  podChatMessages: (pursuitId: string) => ['podChatMessages', pursuitId] as const,

  // Connections
  connections: (userId: string) => ['connections', userId] as const,
  connectionRequests: (userId: string) => ['connectionRequests', userId] as const,

  // Reviews
  userReviews: (userId: string) => ['userReviews', userId] as const,
  averageRatings: (userId: string) => ['averageRatings', userId] as const,

  // Notifications
  notifications: (userId: string) => ['notifications', userId] as const,

  // Calendar/Meetings
  meetings: (userId: string) => ['meetings', userId] as const,
  meeting: (id: string) => ['meeting', id] as const,

  // Team
  teamMembers: (pursuitId: string) => ['teamMembers', pursuitId] as const,
};

// ============================================
// FEED & PURSUITS
// ============================================

export function useFeed() {
  return useQuery({
    queryKey: queryKeys.feed,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pursuits_public_view')
        .select('*')
        .eq('status', 'open')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    staleTime: 2 * 60 * 1000, // 2 minutes for feed
  });
}

export function usePursuit(pursuitId: string | null) {
  return useQuery({
    queryKey: queryKeys.pursuit(pursuitId || ''),
    queryFn: async () => {
      if (!pursuitId) return null;
      const { data, error } = await supabase
        .from('pursuits')
        .select('*')
        .eq('id', pursuitId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!pursuitId,
  });
}

export function useMyPursuits(userId: string | null) {
  return useQuery({
    queryKey: queryKeys.myPursuits(userId || ''),
    queryFn: async () => {
      if (!userId) return [];
      return pursuitService.getMyPursuits(userId);
    },
    enabled: !!userId,
  });
}

export function useAppliedPursuits(userId: string | null) {
  return useQuery({
    queryKey: queryKeys.appliedPursuits(userId || ''),
    queryFn: async () => {
      if (!userId) return [];
      return pursuitService.getAppliedPursuits(userId);
    },
    enabled: !!userId,
  });
}

// ============================================
// PROFILES
// ============================================

export function useProfile(userId: string | null) {
  return useQuery({
    queryKey: queryKeys.profile(userId || ''),
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!userId,
    staleTime: 10 * 60 * 1000, // Profiles don't change often - 10 min
  });
}

// ============================================
// MESSAGES & CONVERSATIONS
// ============================================

export function useConversations(userId: string | null) {
  return useQuery({
    queryKey: queryKeys.conversations(userId || ''),
    queryFn: async () => {
      if (!userId) return [];
      return messageService.getConversations(userId);
    },
    enabled: !!userId,
    staleTime: 30 * 1000, // 30 seconds for messages
  });
}

export function useMessages(partnerId: string | null, currentUserId: string | null) {
  return useQuery({
    queryKey: queryKeys.messages(partnerId || ''),
    queryFn: async () => {
      if (!partnerId || !currentUserId) return [];
      return messageService.getMessages(currentUserId, partnerId);
    },
    enabled: !!partnerId && !!currentUserId,
    staleTime: 10 * 1000, // 10 seconds for active chat
  });
}

export function useUnreadMessageCount(userId: string | null) {
  return useQuery({
    queryKey: queryKeys.unreadCount(userId || ''),
    queryFn: async () => {
      if (!userId) return 0;
      return messageService.getUnreadCount(userId);
    },
    enabled: !!userId,
    staleTime: 30 * 1000,
  });
}

// ============================================
// POD CHATS
// ============================================

export function usePodChats(userId: string | null) {
  return useQuery({
    queryKey: queryKeys.podChats(userId || ''),
    queryFn: async () => {
      if (!userId) return [];
      return podChatService.getUserPodChats(userId);
    },
    enabled: !!userId,
    staleTime: 30 * 1000,
  });
}

export function usePodChatMessages(pursuitId: string | null) {
  return useQuery({
    queryKey: queryKeys.podChatMessages(pursuitId || ''),
    queryFn: async () => {
      if (!pursuitId) return [];
      return podChatService.getMessages(pursuitId);
    },
    enabled: !!pursuitId,
    staleTime: 10 * 1000,
  });
}

// ============================================
// CONNECTIONS
// ============================================

export function useConnections(userId: string | null) {
  return useQuery({
    queryKey: queryKeys.connections(userId || ''),
    queryFn: async () => {
      if (!userId) return [];
      return connectionService.getMyConnections(userId);
    },
    enabled: !!userId,
  });
}

export function useConnectionRequests(userId: string | null) {
  return useQuery({
    queryKey: queryKeys.connectionRequests(userId || ''),
    queryFn: async () => {
      if (!userId) return [];
      return connectionService.getPendingRequests(userId);
    },
    enabled: !!userId,
    staleTime: 60 * 1000, // 1 minute
  });
}

// ============================================
// REVIEWS
// ============================================

export function useUserReviews(userId: string | null) {
  return useQuery({
    queryKey: queryKeys.userReviews(userId || ''),
    queryFn: async () => {
      if (!userId) return [];
      return reviewService.getUserReviews(userId);
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // Reviews don't change often
  });
}

export function useAverageRatings(userId: string | null) {
  return useQuery({
    queryKey: queryKeys.averageRatings(userId || ''),
    queryFn: async () => {
      if (!userId) return null;
      return reviewService.getAverageRatings(userId);
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });
}

// ============================================
// NOTIFICATIONS
// ============================================

export function useNotifications(userId: string | null) {
  return useQuery({
    queryKey: queryKeys.notifications(userId || ''),
    queryFn: async () => {
      if (!userId) return [];
      return notificationService.getUserNotifications(userId);
    },
    enabled: !!userId,
    staleTime: 30 * 1000,
  });
}

// ============================================
// MEETINGS
// ============================================

export function useMeetings(userId: string | null) {
  return useQuery({
    queryKey: queryKeys.meetings(userId || ''),
    queryFn: async () => {
      if (!userId) return [];
      return meetingService.getMyMeetings(userId);
    },
    enabled: !!userId,
  });
}

export function useMeeting(meetingId: string | null) {
  return useQuery({
    queryKey: queryKeys.meeting(meetingId || ''),
    queryFn: async () => {
      if (!meetingId) return null;
      return meetingService.getMeeting(meetingId);
    },
    enabled: !!meetingId,
  });
}

// ============================================
// TEAM MEMBERS
// ============================================

export function useTeamMembers(pursuitId: string | null) {
  return useQuery({
    queryKey: queryKeys.teamMembers(pursuitId || ''),
    queryFn: async () => {
      if (!pursuitId) return [];
      const { data, error } = await supabase
        .from('team_members')
        .select(`
          *,
          user:profiles(id, name, email, profile_picture)
        `)
        .eq('pursuit_id', pursuitId)
        .in('status', ['active', 'accepted']);

      if (error) {
        // If join fails, fetch separately
        const { data: members, error: membersError } = await supabase
          .from('team_members')
          .select('*')
          .eq('pursuit_id', pursuitId)
          .in('status', ['active', 'accepted']);

        if (membersError) throw membersError;
        if (!members || members.length === 0) return [];

        const userIds = members.map(m => m.user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, email, profile_picture')
          .in('id', userIds);

        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
        return members.map(member => ({
          ...member,
          user: profileMap.get(member.user_id) || null
        }));
      }

      return data || [];
    },
    enabled: !!pursuitId,
  });
}

// ============================================
// CACHE INVALIDATION HELPERS
// ============================================

export function useInvalidateQueries() {
  const queryClient = useQueryClient();

  return {
    invalidateFeed: () => queryClient.invalidateQueries({ queryKey: queryKeys.feed }),
    invalidatePursuit: (id: string) => queryClient.invalidateQueries({ queryKey: queryKeys.pursuit(id) }),
    invalidateProfile: (id: string) => queryClient.invalidateQueries({ queryKey: queryKeys.profile(id) }),
    invalidateConversations: (userId: string) => queryClient.invalidateQueries({ queryKey: queryKeys.conversations(userId) }),
    invalidateMessages: (partnerId: string) => queryClient.invalidateQueries({ queryKey: queryKeys.messages(partnerId) }),
    invalidateConnections: (userId: string) => queryClient.invalidateQueries({ queryKey: queryKeys.connections(userId) }),
    invalidateNotifications: (userId: string) => queryClient.invalidateQueries({ queryKey: queryKeys.notifications(userId) }),
    invalidateMeetings: (userId: string) => queryClient.invalidateQueries({ queryKey: queryKeys.meetings(userId) }),
    invalidateAll: () => queryClient.invalidateQueries(),
  };
}

// ============================================
// PREFETCH HELPERS
// ============================================

export function usePrefetch() {
  const queryClient = useQueryClient();

  return {
    prefetchProfile: (userId: string) => {
      queryClient.prefetchQuery({
        queryKey: queryKeys.profile(userId),
        queryFn: async () => {
          const { data } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();
          return data;
        },
      });
    },
    prefetchPursuit: (pursuitId: string) => {
      queryClient.prefetchQuery({
        queryKey: queryKeys.pursuit(pursuitId),
        queryFn: async () => {
          const { data } = await supabase
            .from('pursuits')
            .select('*')
            .eq('id', pursuitId)
            .single();
          return data;
        },
      });
    },
  };
}
