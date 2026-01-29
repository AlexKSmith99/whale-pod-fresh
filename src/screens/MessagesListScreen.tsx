import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  Animated,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { messageService } from '../services/messageService';
import { podChatService, PodChat } from '../services/podChatService';
import { supabase } from '../config/supabase';
import ChatScreen from './ChatScreen';
import PodChatScreen from './PodChatScreen';
import PodMemberCollage from '../components/PodMemberCollage';
import { colors as legacyColors, typography, spacing, borderRadius, shadows } from '../theme/designSystem';
import { useTheme } from '../theme/ThemeContext';
import GrainTexture from '../components/ui/GrainTexture';

const SIDEBAR_WIDTH = 320;
const LAST_CHAT_KEY = 'whale_pod_last_chat';

// Track locally-read chats at module level so they persist across component remounts
const locallyReadIndividualChatsSet = new Set<string>();
const locallyReadPodChatsSet = new Set<string>();
let locallyReadMessageCount = 0;

export const isConversationLocallyRead = (partnerId: string): boolean => {
  return locallyReadIndividualChatsSet.has(partnerId);
};

export const getLocallyReadConversationCount = (): number => {
  return locallyReadIndividualChatsSet.size;
};

export const getLocallyReadMessageCount = (): number => {
  return locallyReadMessageCount;
};

export const addLocallyReadMessages = (count: number): void => {
  locallyReadMessageCount += count;
};

export const clearLocallyReadConversations = (): void => {
  locallyReadIndividualChatsSet.clear();
  locallyReadPodChatsSet.clear();
  locallyReadMessageCount = 0;
};

interface IndividualChat {
  type: 'individual';
  partnerId: string;
  partnerProfile?: {
    name?: string;
    email?: string;
    profile_picture?: string;
  };
  partnerEmail?: string;
  lastMessage?: string;
  lastMessageTime?: string;
  isRead: boolean;
  unreadCount: number;
}

interface PodChatItem extends PodChat {
  type: 'pod';
}

type ChatItem = IndividualChat | PodChatItem;

type FilterTab = 'all' | 'direct' | 'pods';

interface MessagesListScreenProps {
  navigation?: any;
  onSelectConversation?: (partnerId: string, partnerEmail: string) => void;
  onConversationRead?: () => void;
}

export default function MessagesListScreen({ navigation, onSelectConversation, onConversationRead }: MessagesListScreenProps) {
  const { user } = useAuth();
  const { theme, isNewTheme } = useTheme();
  const colors = theme.colors;
  const [individualChats, setIndividualChats] = useState<IndividualChat[]>([]);
  const [podChats, setPodChats] = useState<PodChatItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedChat, setSelectedChat] = useState<ChatItem | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const sidebarAnim = useRef(new Animated.Value(0)).current;
  const hasAutoSelected = useRef(false);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');

  useEffect(() => {
    loadAllChats();
    const interval = setInterval(loadAllChats, 5000);

    const unsubscribe = navigation?.addListener?.('focus', () => {
      loadAllChats();
    });

    return () => {
      clearInterval(interval);
      unsubscribe?.();
    };
  }, [navigation]);

  useEffect(() => {
    if (!loading && !hasAutoSelected.current && (individualChats.length > 0 || podChats.length > 0)) {
      hasAutoSelected.current = true;
      autoSelectChat();
    }
  }, [loading, individualChats, podChats]);

  const autoSelectChat = async () => {
    try {
      const lastChatStr = await AsyncStorage.getItem(LAST_CHAT_KEY);
      if (lastChatStr) {
        const lastChat = JSON.parse(lastChatStr);
        if (lastChat.type === 'individual') {
          const found = individualChats.find(c => c.partnerId === lastChat.partnerId);
          if (found) {
            setSelectedChat(found);
            return;
          }
        } else if (lastChat.type === 'pod') {
          const found = podChats.find(c => c.pursuit_id === lastChat.pursuit_id);
          if (found) {
            setSelectedChat(found);
            return;
          }
        }
      }
    } catch (error) {
      console.error('Error loading last chat:', error);
    }

    const allChats = getAllChats();
    if (allChats.length > 0) {
      setSelectedChat(allChats[0]);
    }
  };

  const loadAllChats = async () => {
    if (!user) return;

    try {
      const [directMessages, podChatData] = await Promise.all([
        loadIndividualChats(),
        loadPodChats(),
      ]);
      setLoading(false);
    } catch (error) {
      console.error('Error loading chats:', error);
      setLoading(false);
    }
  };

  const loadIndividualChats = async () => {
    if (!user) return [];

    try {
      const { data: messages, error } = await supabase
        .from('messages')
        .select(`
          id,
          sender_id,
          recipient_id,
          content,
          created_at,
          is_read,
          sender:profiles!sender_id(name, email, profile_picture),
          recipient:profiles!recipient_id(name, email, profile_picture)
        `)
        .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const conversations = new Map<string, IndividualChat>();

      messages?.forEach((msg: any) => {
        const partnerId = msg.sender_id === user.id ? msg.recipient_id : msg.sender_id;
        const partnerProfile = msg.sender_id === user.id ? msg.recipient : msg.sender;

        if (!conversations.has(partnerId)) {
          const isUnread = msg.recipient_id === user.id && !msg.is_read && !locallyReadIndividualChatsSet.has(partnerId);
          conversations.set(partnerId, {
            type: 'individual',
            partnerId,
            partnerProfile,
            partnerEmail: partnerProfile?.email,
            lastMessage: msg.content,
            lastMessageTime: msg.created_at,
            isRead: !isUnread,
            unreadCount: isUnread ? 1 : 0,
          });
        } else if (msg.recipient_id === user.id && !msg.is_read && !locallyReadIndividualChatsSet.has(partnerId)) {
          const existing = conversations.get(partnerId)!;
          existing.unreadCount += 1;
          existing.isRead = false;
        }
      });

      const chatsArray = Array.from(conversations.values());
      setIndividualChats(chatsArray);
      return chatsArray;
    } catch (error) {
      console.error('Error loading individual chats:', error);
      return [];
    }
  };

  const loadPodChats = async () => {
    if (!user) return [];

    try {
      const chats = await podChatService.getUserPodChats(user.id);
      const podChatItems: PodChatItem[] = chats.map(chat => ({
        ...chat,
        type: 'pod' as const,
        unread_count: locallyReadPodChatsSet.has(chat.pursuit_id) ? 0 : chat.unread_count,
      }));
      setPodChats(podChatItems);
      return podChatItems;
    } catch (error) {
      console.error('Error loading pod chats:', error);
      return [];
    }
  };

  const getAllChats = (): ChatItem[] => {
    const all: ChatItem[] = [...individualChats, ...podChats];
    return all.sort((a, b) => {
      const timeA = a.type === 'individual'
        ? new Date(a.lastMessageTime || 0).getTime()
        : new Date(a.last_message_time || 0).getTime();
      const timeB = b.type === 'individual'
        ? new Date(b.lastMessageTime || 0).getTime()
        : new Date(b.last_message_time || 0).getTime();
      return timeB - timeA;
    });
  };

  const getFilteredChats = (): ChatItem[] => {
    const all = getAllChats();
    switch (activeTab) {
      case 'direct':
        return all.filter(c => c.type === 'individual');
      case 'pods':
        return all.filter(c => c.type === 'pod');
      default:
        return all;
    }
  };

  const getTotalUnreadCount = (): number => {
    const dmUnread = individualChats.reduce((sum, c) => sum + c.unreadCount, 0);
    const podUnread = podChats.reduce((sum, c) => sum + c.unread_count, 0);
    return dmUnread + podUnread;
  };

  const selectChat = async (chat: ChatItem) => {
    setSelectedChat(chat);

    try {
      if (chat.type === 'individual') {
        await AsyncStorage.setItem(LAST_CHAT_KEY, JSON.stringify({
          type: 'individual',
          partnerId: chat.partnerId,
        }));

        if (chat.unreadCount > 0) {
          locallyReadIndividualChatsSet.add(chat.partnerId);
          locallyReadMessageCount += chat.unreadCount;
          setIndividualChats(prev =>
            prev.map(c => c.partnerId === chat.partnerId
              ? { ...c, isRead: true, unreadCount: 0 }
              : c
            )
          );
          onConversationRead?.();
        }

        if (onSelectConversation) {
          onSelectConversation(chat.partnerId, chat.partnerEmail || '');
        }
      } else {
        await AsyncStorage.setItem(LAST_CHAT_KEY, JSON.stringify({
          type: 'pod',
          pursuit_id: chat.pursuit_id,
        }));

        if (chat.unread_count > 0) {
          locallyReadPodChatsSet.add(chat.pursuit_id);
          locallyReadMessageCount += chat.unread_count;
          setPodChats(prev =>
            prev.map(c => c.pursuit_id === chat.pursuit_id
              ? { ...c, unread_count: 0 }
              : c
            )
          );
          onConversationRead?.();
        }
      }
    } catch (error) {
      console.error('Error saving last chat:', error);
    }

    if (sidebarOpen) {
      toggleSidebar();
    }
  };

  const deleteChat = async (chat: ChatItem) => {
    if (chat.type === 'individual') {
      try {
        await supabase
          .from('messages')
          .delete()
          .or(`and(sender_id.eq.${user?.id},recipient_id.eq.${chat.partnerId}),and(sender_id.eq.${chat.partnerId},recipient_id.eq.${user?.id})`);

        setIndividualChats(prev => prev.filter(c => c.partnerId !== chat.partnerId));

        if (selectedChat?.type === 'individual' && (selectedChat as IndividualChat).partnerId === chat.partnerId) {
          const remaining = getAllChats().filter(c => !(c.type === 'individual' && (c as IndividualChat).partnerId === chat.partnerId));
          setSelectedChat(remaining[0] || null);
        }
      } catch (error) {
        console.error('Error deleting chat:', error);
      }
    }
  };

  const toggleSidebar = () => {
    const toValue = sidebarOpen ? 0 : 1;
    Animated.spring(sidebarAnim, {
      toValue,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
    setSidebarOpen(!sidebarOpen);
  };

  const formatTime = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const sidebarTranslateX = sidebarAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-SIDEBAR_WIDTH, 0],
  });

  const overlayOpacity = sidebarAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.5],
  });

  const renderChatCard = (chat: ChatItem) => {
    const isSelected = selectedChat && (
      (chat.type === 'individual' && selectedChat.type === 'individual' && chat.partnerId === (selectedChat as IndividualChat).partnerId) ||
      (chat.type === 'pod' && selectedChat.type === 'pod' && chat.pursuit_id === (selectedChat as PodChatItem).pursuit_id)
    );

    if (chat.type === 'individual') {
      const hasUnread = chat.unreadCount > 0;
      return (
        <TouchableOpacity
          key={`dm-${chat.partnerId}`}
          style={[
            styles.chatCard,
            { backgroundColor: isNewTheme ? colors.surface : legacyColors.white, borderBottomColor: colors.border },
            isSelected && { backgroundColor: isNewTheme ? colors.surfaceAlt : legacyColors.primaryLight, borderLeftWidth: 3, borderLeftColor: colors.primary }
          ]}
          onPress={() => selectChat(chat)}
          activeOpacity={0.7}
        >
          <View style={styles.avatarContainer}>
            {chat.partnerProfile?.profile_picture ? (
              <Image
                source={{ uri: chat.partnerProfile.profile_picture }}
                style={styles.avatar}
              />
            ) : (
              <View style={[styles.avatarPlaceholder, styles.dmAvatar]}>
                <Text style={styles.avatarText}>
                  {(chat.partnerProfile?.name || chat.partnerEmail || '?')[0].toUpperCase()}
                </Text>
              </View>
            )}
            {hasUnread && <View style={styles.onlineIndicator} />}
          </View>

          <View style={styles.chatInfo}>
            <View style={styles.chatHeader}>
              <Text style={[styles.chatName, { color: colors.textPrimary }, hasUnread && styles.chatNameUnread]} numberOfLines={1}>
                {chat.partnerProfile?.name || chat.partnerEmail || 'User'}
              </Text>
              <Text style={[styles.chatTime, { color: colors.textTertiary }, hasUnread && { color: colors.primary }]}>
                {formatTime(chat.lastMessageTime)}
              </Text>
            </View>
            <View style={styles.chatPreviewRow}>
              <Text style={[styles.chatPreview, { color: colors.textSecondary }, hasUnread && { color: colors.textPrimary }]} numberOfLines={1}>
                {chat.lastMessage || 'Start a conversation'}
              </Text>
              {hasUnread && (
                <View style={[styles.unreadBadge, { backgroundColor: colors.primary }]}>
                  <Text style={styles.unreadBadgeText}>{chat.unreadCount}</Text>
                </View>
              )}
            </View>
          </View>
        </TouchableOpacity>
      );
    } else {
      const hasUnread = chat.unread_count > 0;
      return (
        <TouchableOpacity
          key={`pod-${chat.pursuit_id}`}
          style={[
            styles.chatCard,
            { backgroundColor: isNewTheme ? colors.surface : legacyColors.white, borderBottomColor: colors.border },
            isSelected && { backgroundColor: isNewTheme ? colors.surfaceAlt : legacyColors.primaryLight, borderLeftWidth: 3, borderLeftColor: colors.primary }
          ]}
          onPress={() => selectChat(chat)}
          activeOpacity={0.7}
        >
          <View style={styles.avatarContainer}>
            {chat.default_picture ? (
              <Image
                source={{ uri: chat.default_picture }}
                style={styles.avatar}
              />
            ) : (
              <PodMemberCollage members={chat.members || []} size={52} />
            )}
            {hasUnread && <View style={styles.onlineIndicator} />}
          </View>

          <View style={styles.chatInfo}>
            <View style={styles.chatHeader}>
              <View style={styles.chatNameRow}>
                <Text style={[styles.chatName, { color: colors.textPrimary }, hasUnread && styles.chatNameUnread]} numberOfLines={1}>
                  {chat.custom_name || chat.pursuit_title}
                </Text>
                <View style={[styles.podBadge, { backgroundColor: isNewTheme ? colors.surfaceAlt : legacyColors.primaryLight }]}>
                  <Text style={[styles.podBadgeText, { color: colors.primary }]}>Pod</Text>
                </View>
              </View>
              <Text style={[styles.chatTime, { color: colors.textTertiary }, hasUnread && { color: colors.primary }]}>
                {formatTime(chat.last_message_time)}
              </Text>
            </View>
            <View style={styles.chatPreviewRow}>
              <Text style={[styles.chatPreview, { color: colors.textSecondary }, hasUnread && { color: colors.textPrimary }]} numberOfLines={1}>
                {chat.last_message || 'No messages yet'}
              </Text>
              {hasUnread && (
                <View style={[styles.unreadBadge, { backgroundColor: colors.primary }]}>
                  <Text style={styles.unreadBadgeText}>{chat.unread_count}</Text>
                </View>
              )}
            </View>
          </View>
        </TouchableOpacity>
      );
    }
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <StatusBar barStyle={isNewTheme ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
        {isNewTheme && <GrainTexture opacity={0.06} />}
        <View style={styles.loadingContent}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading conversations...</Text>
        </View>
      </View>
    );
  }

  if (!selectedChat && individualChats.length === 0 && podChats.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar barStyle={isNewTheme ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
        {isNewTheme && <GrainTexture opacity={0.06} />}
        <View style={[styles.header, { backgroundColor: isNewTheme ? colors.surface : legacyColors.white }]}>
          <View style={styles.headerTop}>
            <View>
              <Text style={[styles.headerGreeting, { color: colors.textSecondary }]}>Your conversations</Text>
              <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Chats</Text>
            </View>
          </View>
        </View>
        <View style={styles.emptyContainer}>
          <View style={[styles.emptyIconContainer, { backgroundColor: isNewTheme ? colors.surface : legacyColors.backgroundSecondary }]}>
            <Ionicons name="chatbubbles-outline" size={48} color={colors.textTertiary} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No conversations yet</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            Start chatting with team members or join a pod to access group chats
          </Text>
        </View>
      </View>
    );
  }

  const filteredChats = getFilteredChats();
  const totalUnread = getTotalUnreadCount();

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <StatusBar barStyle={isNewTheme ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      {isNewTheme && <GrainTexture opacity={0.06} />}
      {/* Sidebar Overlay */}
      {sidebarOpen && (
        <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            onPress={toggleSidebar}
            activeOpacity={1}
          />
        </Animated.View>
      )}

      {/* Sidebar */}
      <Animated.View
        style={[styles.sidebar, { transform: [{ translateX: sidebarTranslateX }], backgroundColor: isNewTheme ? colors.surface : legacyColors.white }]}
      >
        <View style={[styles.sidebarHeader, { borderBottomColor: colors.border }]}>
          <Text style={[styles.sidebarTitle, { fontFamily: 'NothingYouCouldDo_400Regular', color: isNewTheme ? colors.primary : colors.textPrimary }]}>Conversations</Text>
          <TouchableOpacity onPress={toggleSidebar} style={[styles.sidebarCloseBtn, { backgroundColor: isNewTheme ? colors.surfaceAlt : legacyColors.backgroundSecondary }]}>
            <Ionicons name="close" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Sidebar Tabs */}
        <View style={[styles.sidebarTabs, { borderBottomColor: colors.border }]}>
          {(['all', 'direct', 'pods'] as FilterTab[]).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[
                styles.sidebarTab,
                { backgroundColor: isNewTheme ? colors.surfaceAlt : legacyColors.backgroundSecondary },
                activeTab === tab && { backgroundColor: colors.primary }
              ]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[
                styles.sidebarTabText,
                { color: colors.textSecondary },
                activeTab === tab && { color: legacyColors.white }
              ]}>
                {tab === 'all' ? 'All' : tab === 'direct' ? 'Direct' : 'Pods'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView style={styles.sidebarScroll} showsVerticalScrollIndicator={false}>
          {filteredChats.length === 0 ? (
            <View style={styles.sidebarEmpty}>
              <Ionicons name="chatbubble-outline" size={32} color={colors.textTertiary} />
              <Text style={[styles.sidebarEmptyText, { color: colors.textTertiary }]}>No conversations</Text>
            </View>
          ) : (
            filteredChats.map(chat => renderChatCard(chat))
          )}
        </ScrollView>
      </Animated.View>

      {/* Main Chat Area */}
      <View style={styles.chatArea}>
        {selectedChat ? (
          selectedChat.type === 'individual' ? (
            <ChatScreen
              partnerId={(selectedChat as IndividualChat).partnerId}
              partnerEmail={(selectedChat as IndividualChat).partnerEmail || ''}
              navigation={navigation}
              onBack={toggleSidebar}
              showMenuButton={true}
              onMenuPress={toggleSidebar}
              onDelete={() => deleteChat(selectedChat)}
            />
          ) : (
            <PodChatScreen
              pursuitId={(selectedChat as PodChatItem).pursuit_id}
              pursuitTitle={(selectedChat as PodChatItem).pursuit_title}
              customName={(selectedChat as PodChatItem).custom_name}
              podPicture={(selectedChat as PodChatItem).default_picture}
              onBack={toggleSidebar}
              onNameChanged={(newName) => {
                setPodChats(prev =>
                  prev.map(c => c.pursuit_id === (selectedChat as PodChatItem).pursuit_id
                    ? { ...c, custom_name: newName }
                    : c
                  )
                );
              }}
              navigation={navigation}
              showMenuButton={true}
              onMenuPress={toggleSidebar}
              onDelete={() => deleteChat(selectedChat)}
            />
          )
        ) : (
          <View style={[styles.noChatSelected, { backgroundColor: colors.background }]}>
            <View style={styles.noChatContent}>
              <View style={[styles.noChatIconContainer, { backgroundColor: isNewTheme ? colors.surface : legacyColors.primaryLight }]}>
                <Ionicons name="chatbubbles" size={40} color={colors.primary} />
              </View>
              <Text style={[styles.noChatTitle, { color: colors.textPrimary }]}>Select a conversation</Text>
              <Text style={[styles.noChatSubtitle, { color: colors.textSecondary }]}>
                Choose from your existing chats or start a new conversation
              </Text>
              <TouchableOpacity style={[styles.openSidebarButton, { backgroundColor: colors.primary }]} onPress={toggleSidebar}>
                <Ionicons name="menu" size={20} color={legacyColors.white} />
                <Text style={styles.openSidebarButtonText}>View All Chats</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: legacyColors.background,
  },

  // Loading State
  loadingContainer: {
    flex: 1,
    backgroundColor: legacyColors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContent: {
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.base,
    fontSize: typography.fontSize.base,
    color: legacyColors.textSecondary,
    fontWeight: typography.fontWeight.medium,
  },

  // Header
  header: {
    backgroundColor: legacyColors.white,
    paddingTop: 50,
    paddingBottom: spacing.base,
    ...shadows.sm,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.lg,
  },
  headerGreeting: {
    fontSize: typography.fontSize.sm,
    color: legacyColors.textSecondary,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs,
  },
  headerTitle: {
    fontSize: typography.fontSize['3xl'],
    fontWeight: typography.fontWeight.bold,
    color: legacyColors.textPrimary,
  },

  // Sidebar
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: legacyColors.textPrimary,
    zIndex: 10,
  },
  sidebar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: SIDEBAR_WIDTH,
    backgroundColor: legacyColors.white,
    zIndex: 20,
    paddingTop: 50,
    ...shadows.lg,
  },
  sidebarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: legacyColors.borderLight,
  },
  sidebarTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: legacyColors.textPrimary,
  },
  sidebarCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    backgroundColor: legacyColors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sidebarTabs: {
    flexDirection: 'row',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.base,
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: legacyColors.borderLight,
  },
  sidebarTab: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: legacyColors.backgroundSecondary,
  },
  sidebarTabActive: {
    backgroundColor: legacyColors.primary,
  },
  sidebarTabText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: legacyColors.textSecondary,
  },
  sidebarTabTextActive: {
    color: legacyColors.white,
  },
  sidebarScroll: {
    flex: 1,
  },
  sidebarEmpty: {
    alignItems: 'center',
    paddingVertical: spacing['3xl'],
  },
  sidebarEmptyText: {
    marginTop: spacing.base,
    fontSize: typography.fontSize.base,
    color: legacyColors.textTertiary,
  },

  // Chat Cards
  chatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.base,
    backgroundColor: legacyColors.white,
    borderBottomWidth: 1,
    borderBottomColor: legacyColors.borderLight,
  },
  chatCardSelected: {
    backgroundColor: legacyColors.primaryLight,
    borderLeftWidth: 3,
    borderLeftColor: legacyColors.primary,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: spacing.base,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  avatarPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dmAvatar: {
    backgroundColor: legacyColors.secondary,
  },
  podAvatar: {
    backgroundColor: legacyColors.primary,
  },
  avatarText: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: legacyColors.white,
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: legacyColors.success,
    borderWidth: 2,
    borderColor: legacyColors.white,
  },
  chatInfo: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  chatNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: spacing.sm,
  },
  chatName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: legacyColors.textPrimary,
    flex: 1,
  },
  chatNameUnread: {
    fontWeight: typography.fontWeight.bold,
  },
  podBadge: {
    backgroundColor: legacyColors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    marginLeft: spacing.sm,
  },
  podBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: legacyColors.primary,
  },
  chatTime: {
    fontSize: typography.fontSize.xs,
    color: legacyColors.textTertiary,
  },
  chatTimeUnread: {
    color: legacyColors.primary,
    fontWeight: typography.fontWeight.semibold,
  },
  chatPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chatPreview: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: legacyColors.textSecondary,
  },
  chatPreviewUnread: {
    color: legacyColors.textPrimary,
    fontWeight: typography.fontWeight.medium,
  },
  unreadBadge: {
    backgroundColor: legacyColors.primary,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  unreadBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: legacyColors.white,
  },

  // Empty State
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing['2xl'],
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: legacyColors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: legacyColors.textPrimary,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    fontSize: typography.fontSize.base,
    color: legacyColors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },

  // No Chat Selected State
  chatArea: {
    flex: 1,
  },
  noChatSelected: {
    flex: 1,
    backgroundColor: legacyColors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noChatContent: {
    alignItems: 'center',
    paddingHorizontal: spacing['2xl'],
  },
  noChatIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: legacyColors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  noChatTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: legacyColors.textPrimary,
    marginBottom: spacing.sm,
  },
  noChatSubtitle: {
    fontSize: typography.fontSize.base,
    color: legacyColors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.xl,
  },
  openSidebarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: legacyColors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.base,
    borderRadius: borderRadius.lg,
    gap: spacing.sm,
    ...shadows.sm,
  },
  openSidebarButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: legacyColors.white,
  },
});
