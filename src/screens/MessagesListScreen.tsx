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
  Dimensions,
  Modal,
  TextInput,
  FlatList,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { messageService } from '../services/messageService';
import { podChatService, PodChat } from '../services/podChatService';
import { supabase } from '../config/supabase';
import { connectionService } from '../services/connectionService';
import ChatScreen from './ChatScreen';
import PodChatScreen from './PodChatScreen';
import PodMemberCollage from '../components/PodMemberCollage';
import { colors as legacyColors, typography, spacing, borderRadius, shadows } from '../theme/designSystem';
import { useTheme } from '../theme/ThemeContext';
import { getThemedStyles } from '../theme/themedStyles';
import GrainTexture from '../components/ui/GrainTexture';

// Sidebar width is 90% of screen width for the drawer
const SIDEBAR_WIDTH = Dimensions.get('window').width * 0.9;
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
  const themedStyles = getThemedStyles(colors, isNewTheme);
  const [individualChats, setIndividualChats] = useState<IndividualChat[]>([]);
  const [podChats, setPodChats] = useState<PodChatItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedChat, setSelectedChat] = useState<ChatItem | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const sidebarAnim = useRef(new Animated.Value(0)).current;
  const hasAutoSelected = useRef(false);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [connections, setConnections] = useState<any[]>([]);
  const [connectionsLoading, setConnectionsLoading] = useState(false);
  const [connectionSearch, setConnectionSearch] = useState('');

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

  // Removed auto-select behavior - conversations list is now the default view
  // Users must explicitly select a chat to view it

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

  const openNewChatModal = async () => {
    setShowNewChatModal(true);
    setConnectionsLoading(true);
    try {
      const conns = await connectionService.getMyConnections(user!.id);
      setConnections(conns);
    } catch (error) {
      console.error('Error loading connections:', error);
    } finally {
      setConnectionsLoading(false);
    }
  };

  const handleSelectConnection = (conn: any) => {
    setShowNewChatModal(false);
    setConnectionSearch('');

    const partnerId = conn.otherUserId;
    const partnerEmail = conn.profile?.email || conn.profile?.name || 'User';

    const chat: IndividualChat = {
      type: 'individual',
      partnerId,
      partnerProfile: conn.profile,
      partnerEmail,
      lastMessage: undefined,
      lastMessageTime: undefined,
      isRead: true,
      unreadCount: 0,
    };
    setSelectedChat(chat);
  };

  const filteredConnections = connections.filter((conn) => {
    if (!connectionSearch) return true;
    const name = (conn.profile?.name || '').toLowerCase();
    const query = connectionSearch.toLowerCase();
    if (name.startsWith(query)) return true;
    const nameParts = name.split(' ');
    return nameParts.some((part: string) => part.startsWith(query));
  });

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
            themedStyles.listItem,
            isSelected && { backgroundColor: isNewTheme ? colors.surfaceAlt : legacyColors.primaryLight, borderLeftWidth: 3, borderLeftColor: themedStyles.accentIconColor }
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
              <View style={[styles.avatarPlaceholder, themedStyles.avatar, { width: 52, height: 52, borderRadius: 26 }]}>
                <Text style={[styles.avatarText, themedStyles.avatarText]}>
                  {(chat.partnerProfile?.name || chat.partnerEmail || '?')[0].toUpperCase()}
                </Text>
              </View>
            )}
            {hasUnread && <View style={[styles.onlineIndicator, { backgroundColor: themedStyles.accentIconColor, borderColor: isNewTheme ? colors.surface : legacyColors.white }]} />}
          </View>

          <View style={styles.chatInfo}>
            <View style={styles.chatHeader}>
              <Text style={[styles.chatName, themedStyles.listItemTitle, hasUnread && styles.chatNameUnread]} numberOfLines={1}>
                {chat.partnerProfile?.name || chat.partnerEmail || 'User'}
              </Text>
              <Text style={[styles.chatTime, themedStyles.textTertiary, hasUnread && { color: themedStyles.accentIconColor }]}>
                {formatTime(chat.lastMessageTime)}
              </Text>
            </View>
            <View style={styles.chatPreviewRow}>
              <Text style={[styles.chatPreview, themedStyles.listItemSubtitle, hasUnread && { color: colors.textPrimary }]} numberOfLines={1}>
                {chat.lastMessage || 'Start a conversation'}
              </Text>
              {hasUnread && (
                <View style={[styles.unreadBadge, themedStyles.badge, { minWidth: 22, height: 22, borderRadius: 11 }]}>
                  <Text style={[styles.unreadBadgeText, themedStyles.badgeText]}>{chat.unreadCount}</Text>
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
            themedStyles.listItem,
            isSelected && { backgroundColor: isNewTheme ? colors.surfaceAlt : legacyColors.primaryLight, borderLeftWidth: 3, borderLeftColor: themedStyles.accentIconColor }
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
            {hasUnread && <View style={[styles.onlineIndicator, { backgroundColor: themedStyles.accentIconColor, borderColor: isNewTheme ? colors.surface : legacyColors.white }]} />}
          </View>

          <View style={styles.chatInfo}>
            <View style={styles.chatHeader}>
              <View style={styles.chatNameRow}>
                <Text style={[styles.chatName, themedStyles.listItemTitle, hasUnread && styles.chatNameUnread]} numberOfLines={1}>
                  {chat.custom_name || chat.pursuit_title}
                </Text>
                <View style={[styles.podBadge, themedStyles.tag]}>
                  <Text style={[styles.podBadgeText, themedStyles.tagText]}>Pod</Text>
                </View>
              </View>
              <Text style={[styles.chatTime, themedStyles.textTertiary, hasUnread && { color: themedStyles.accentIconColor }]}>
                {formatTime(chat.last_message_time)}
              </Text>
            </View>
            <View style={styles.chatPreviewRow}>
              <Text style={[styles.chatPreview, themedStyles.listItemSubtitle, hasUnread && { color: colors.textPrimary }]} numberOfLines={1}>
                {chat.last_message || 'No messages yet'}
              </Text>
              {hasUnread && (
                <View style={[styles.unreadBadge, themedStyles.badge, { minWidth: 22, height: 22, borderRadius: 11 }]}>
                  <Text style={[styles.unreadBadgeText, themedStyles.badgeText]}>{chat.unread_count}</Text>
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
      <View style={[styles.loadingContainer, themedStyles.container]}>
        <StatusBar barStyle={isNewTheme ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
        {isNewTheme && <GrainTexture opacity={0.06} />}
        <View style={styles.loadingContent}>
          <ActivityIndicator size="large" color={themedStyles.refreshColor} />
          <Text style={[styles.loadingText, themedStyles.textSecondary]}>Loading conversations...</Text>
        </View>
      </View>
    );
  }

  const filteredChats = getFilteredChats();
  const totalUnread = getTotalUnreadCount();

  // If no chat is selected, show the full-screen conversations list
  if (!selectedChat) {
    return (
      <View style={[styles.container, themedStyles.container]}>
        <StatusBar barStyle={isNewTheme ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
        {isNewTheme && <GrainTexture opacity={0.06} />}

        {/* Full-screen header */}
        <View style={[styles.header, themedStyles.header]}>
          <View style={styles.headerTop}>
            <View>
              <Text style={[styles.headerGreeting, themedStyles.headerSubtitle]}>Your conversations</Text>
              <Text style={[styles.headerTitle, themedStyles.headerTitle]}>Chats</Text>
            </View>
            <View style={styles.headerActions}>
              {totalUnread > 0 && (
                <View style={[styles.headerBadge, themedStyles.badge]}>
                  <Text style={[styles.headerBadgeText, themedStyles.badgeText]}>{totalUnread}</Text>
                </View>
              )}
              <TouchableOpacity onPress={openNewChatModal} style={styles.newChatButton}>
                <Ionicons name="add-circle-outline" size={28} color={isNewTheme ? colors.accentGreen : legacyColors.primary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Filter Tabs */}
          <View style={styles.filterTabs}>
            {(['all', 'direct', 'pods'] as FilterTab[]).map((tab) => (
              <TouchableOpacity
                key={tab}
                style={[
                  styles.filterTab,
                  themedStyles.surfaceAlt,
                  activeTab === tab && { backgroundColor: themedStyles.accentIconColor }
                ]}
                onPress={() => setActiveTab(tab)}
              >
                <Text style={[
                  styles.filterTabText,
                  themedStyles.textSecondary,
                  activeTab === tab && { color: isNewTheme ? colors.background : legacyColors.white }
                ]}>
                  {tab === 'all' ? 'All' : tab === 'direct' ? 'Direct' : 'Pods'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Conversations List */}
        {filteredChats.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={[styles.emptyIconContainer, themedStyles.surfaceAlt]}>
              <Ionicons name="chatbubbles-outline" size={48} color={themedStyles.accentIconColor} />
            </View>
            <Text style={[styles.emptyTitle, themedStyles.emptyText]}>No conversations yet</Text>
            <Text style={[styles.emptySubtitle, themedStyles.emptySubtext]}>
              Start chatting with team members or join a pod to access group chats
            </Text>
          </View>
        ) : (
          <ScrollView style={styles.conversationsList} showsVerticalScrollIndicator={false}>
            {filteredChats.map(chat => renderChatCard(chat))}
          </ScrollView>
        )}

        {/* New Chat Modal */}
        <Modal
          visible={showNewChatModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => { setShowNewChatModal(false); setConnectionSearch(''); }}
        >
          <View style={[styles.newChatModalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
            <View style={[styles.newChatModalContainer, { backgroundColor: colors.background }]}>
              <View style={[styles.newChatModalHeader, { borderBottomColor: colors.border }]}>
                <Text style={[styles.newChatModalTitle, themedStyles.headerTitle, { fontSize: 20 }]}>New Chat</Text>
                <TouchableOpacity onPress={() => { setShowNewChatModal(false); setConnectionSearch(''); }}>
                  <Ionicons name="close" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>

              <View style={[styles.newChatSearchContainer, { backgroundColor: colors.surfaceAlt }]}>
                <Ionicons name="search" size={18} color={colors.textTertiary} style={{ marginRight: 8 }} />
                <TextInput
                  style={[styles.newChatSearchInput, { color: colors.textPrimary, fontFamily: isNewTheme ? 'KleeOne_400Regular' : undefined }]}
                  placeholder="Search connections..."
                  placeholderTextColor={colors.textTertiary}
                  value={connectionSearch}
                  onChangeText={setConnectionSearch}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {connectionSearch.length > 0 && (
                  <TouchableOpacity onPress={() => setConnectionSearch('')}>
                    <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
                  </TouchableOpacity>
                )}
              </View>

              {connectionsLoading ? (
                <View style={styles.newChatLoading}>
                  <ActivityIndicator size="small" color={isNewTheme ? colors.accentGreen : legacyColors.primary} />
                  <Text style={[styles.newChatLoadingText, { color: colors.textSecondary, fontFamily: isNewTheme ? 'KleeOne_400Regular' : undefined }]}>Loading connections...</Text>
                </View>
              ) : filteredConnections.length === 0 ? (
                <View style={styles.newChatEmpty}>
                  <Ionicons name="people-outline" size={48} color={colors.textTertiary} />
                  <Text style={[styles.newChatEmptyText, { color: colors.textSecondary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>
                    {connectionSearch ? 'No matches found' : 'No connections yet'}
                  </Text>
                  <Text style={[styles.newChatEmptyHint, { color: colors.textTertiary, fontFamily: isNewTheme ? 'KleeOne_400Regular' : undefined }]}>
                    {connectionSearch ? 'Try a different name' : 'Connect with people to start chatting'}
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={filteredConnections}
                  keyExtractor={(item) => item.id || item.otherUserId}
                  renderItem={({ item: conn }) => (
                    <TouchableOpacity
                      style={[styles.newChatConnectionCard, { borderBottomColor: colors.border }]}
                      onPress={() => handleSelectConnection(conn)}
                      activeOpacity={0.7}
                    >
                      {conn.profile?.profile_picture ? (
                        <Image source={{ uri: conn.profile.profile_picture }} style={styles.newChatAvatar} />
                      ) : (
                        <View style={[styles.newChatAvatarPlaceholder, { backgroundColor: isNewTheme ? colors.accentGreen : legacyColors.primary }]}>
                          <Text style={[styles.newChatAvatarText, { color: isNewTheme ? colors.background : '#fff' }]}>
                            {(conn.profile?.name || '?')[0].toUpperCase()}
                          </Text>
                        </View>
                      )}
                      <View style={styles.newChatConnectionInfo}>
                        <Text style={[styles.newChatConnectionName, { color: colors.textPrimary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>
                          {conn.profile?.name || 'Unknown'}
                        </Text>
                        {conn.profile?.bio && (
                          <Text style={[styles.newChatConnectionBio, { color: colors.textSecondary, fontFamily: isNewTheme ? 'KleeOne_400Regular' : undefined }]} numberOfLines={1}>
                            {conn.profile.bio}
                          </Text>
                        )}
                      </View>
                      <Ionicons name="chatbubble-outline" size={20} color={isNewTheme ? colors.accentGreen : legacyColors.primary} />
                    </TouchableOpacity>
                  )}
                />
              )}
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  // When a chat is selected, show the chat with sidebar drawer functionality
  return (
    <KeyboardAvoidingView
      style={[styles.container, themedStyles.container]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <StatusBar barStyle={isNewTheme ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      {isNewTheme && <GrainTexture opacity={0.06} />}

      {/* Sidebar Overlay - only when in a chat */}
      {sidebarOpen && (
        <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            onPress={toggleSidebar}
            activeOpacity={1}
          />
        </Animated.View>
      )}

      {/* Sidebar Drawer - 90% width when switching chats */}
      <Animated.View
        style={[styles.sidebar, { transform: [{ translateX: sidebarTranslateX }] }, themedStyles.surface]}
      >
        <View style={[styles.sidebarHeader, { borderBottomColor: colors.border }]}>
          <Text style={[styles.sidebarTitle, themedStyles.headerTitle]}>Conversations</Text>
          <TouchableOpacity onPress={toggleSidebar} style={[styles.sidebarCloseBtn, themedStyles.iconContainer]}>
            <Ionicons name="close" size={24} color={themedStyles.accentIconColor} />
          </TouchableOpacity>
        </View>

        {/* Sidebar Tabs */}
        <View style={[styles.sidebarTabs, { borderBottomColor: colors.border }]}>
          {(['all', 'direct', 'pods'] as FilterTab[]).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[
                styles.sidebarTab,
                themedStyles.surfaceAlt,
                activeTab === tab && { backgroundColor: themedStyles.accentIconColor }
              ]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[
                styles.sidebarTabText,
                themedStyles.textSecondary,
                activeTab === tab && { color: isNewTheme ? colors.background : legacyColors.white }
              ]}>
                {tab === 'all' ? 'All' : tab === 'direct' ? 'Direct' : 'Pods'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView style={styles.sidebarScroll} showsVerticalScrollIndicator={false}>
          {filteredChats.length === 0 ? (
            <View style={styles.sidebarEmpty}>
              <Ionicons name="chatbubble-outline" size={32} color={themedStyles.accentIconColor} />
              <Text style={[styles.sidebarEmptyText, themedStyles.emptySubtext]}>No conversations</Text>
            </View>
          ) : (
            filteredChats.map(chat => renderChatCard(chat))
          )}
        </ScrollView>
      </Animated.View>

      {/* Main Chat Area */}
      <View style={styles.chatArea}>
        {selectedChat.type === 'individual' ? (
          <ChatScreen
            partnerId={(selectedChat as IndividualChat).partnerId}
            partnerEmail={(selectedChat as IndividualChat).partnerEmail || ''}
            navigation={navigation}
            onBack={() => setSelectedChat(null)}
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
            onBack={() => setSelectedChat(null)}
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
  headerBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
  },
  headerBadgeText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },

  // Filter Tabs (full-screen view)
  filterTabs: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.base,
    gap: spacing.sm,
  },
  filterTab: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
  },
  filterTabText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },

  // Conversations List (full-screen view)
  conversationsList: {
    flex: 1,
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

  // Header actions
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  newChatButton: {
    padding: 4,
  },

  // New Chat Modal
  newChatModalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  newChatModalContainer: {
    height: '85%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  newChatModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  newChatModalTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
  },
  newChatSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginVertical: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  newChatSearchInput: {
    flex: 1,
    fontSize: 15,
    padding: 0,
  },
  newChatLoading: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  newChatLoadingText: {
    marginTop: 8,
    fontSize: 14,
  },
  newChatEmpty: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  newChatEmptyText: {
    fontSize: 18,
    fontWeight: '600' as const,
    marginTop: 12,
  },
  newChatEmptyHint: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  newChatConnectionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  newChatAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  newChatAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  newChatAvatarText: {
    fontSize: 20,
    fontWeight: '600' as const,
  },
  newChatConnectionInfo: {
    flex: 1,
    marginLeft: 12,
  },
  newChatConnectionName: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  newChatConnectionBio: {
    fontSize: 13,
    marginTop: 2,
  },
});
