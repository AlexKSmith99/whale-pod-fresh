import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  Animated,
  Alert,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { messageService } from '../services/messageService';
import { podChatService, PodChat } from '../services/podChatService';
import { supabase } from '../config/supabase';
import ChatScreen from './ChatScreen';
import PodChatScreen from './PodChatScreen';

const SIDEBAR_WIDTH = 300;
const LAST_CHAT_KEY = 'whale_pod_last_chat';

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
}

interface PodChatItem extends PodChat {
  type: 'pod';
}

type ChatItem = IndividualChat | PodChatItem;

type FilterTab = 'chats' | 'unread' | 'requests';

export default function MessagesListScreen({ navigation }: any) {
  const { user } = useAuth();
  const [individualChats, setIndividualChats] = useState<IndividualChat[]>([]);
  const [podChats, setPodChats] = useState<PodChatItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedChat, setSelectedChat] = useState<ChatItem | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const sidebarAnim = useRef(new Animated.Value(0)).current;
  const hasAutoSelected = useRef(false);
  const [activeTab, setActiveTab] = useState<FilterTab>('chats');

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

  // Auto-select chat after loading
  useEffect(() => {
    if (!loading && !hasAutoSelected.current && (individualChats.length > 0 || podChats.length > 0)) {
      hasAutoSelected.current = true;
      autoSelectChat();
    }
  }, [loading, individualChats, podChats]);

  const autoSelectChat = async () => {
    try {
      // Try to load last accessed chat
      const lastChatStr = await AsyncStorage.getItem(LAST_CHAT_KEY);
      if (lastChatStr) {
        const lastChat = JSON.parse(lastChatStr);
        // Find the chat in our lists
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

    // Fall back to most recent chat
    const allChats = getAllChats();
    if (allChats.length > 0) {
      setSelectedChat(allChats[0]);
    }
  };

  const saveLastChat = async (chat: ChatItem) => {
    try {
      const toSave = chat.type === 'individual'
        ? { type: 'individual', partnerId: chat.partnerId }
        : { type: 'pod', pursuit_id: chat.pursuit_id };
      await AsyncStorage.setItem(LAST_CHAT_KEY, JSON.stringify(toSave));
    } catch (error) {
      console.error('Error saving last chat:', error);
    }
  };

  const loadAllChats = async () => {
    try {
      if (user) {
        // Load individual chats
        const individualData = await messageService.getConversations(user.id);
        const chatsWithProfiles = await Promise.all(
          individualData.map(async (conversation: any) => {
            let partnerId = conversation.partnerId || conversation.partner_id;

            if (!partnerId && conversation.partnerEmail) {
              const { data: profileByEmail } = await supabase
                .from('profiles')
                .select('id')
                .eq('email', conversation.partnerEmail)
                .single();
              partnerId = profileByEmail?.id;
            }

            if (!partnerId) {
              return null;
            }

            const { data: profileData } = await supabase
              .from('profiles')
              .select('name, profile_picture, email')
              .eq('id', partnerId)
              .single();

            return {
              type: 'individual' as const,
              partnerId,
              partnerProfile: profileData || { email: conversation.partnerEmail },
              partnerEmail: conversation.partnerEmail,
              lastMessage: conversation.lastMessage || conversation.content,
              lastMessageTime: conversation.lastMessageTime || conversation.created_at,
              isRead: conversation.isRead !== false,
            };
          })
        );

        setIndividualChats(chatsWithProfiles.filter(Boolean) as IndividualChat[]);

        // Load pod chats
        const podData = await podChatService.getUserPodChats(user.id);
        setPodChats(podData.map(p => ({ ...p, type: 'pod' as const })));
      }
    } catch (error) {
      console.error('Error loading chats:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleSidebar = () => {
    const toValue = sidebarOpen ? 0 : 1;
    Animated.spring(sidebarAnim, {
      toValue,
      useNativeDriver: false,
      tension: 65,
      friction: 11,
    }).start();
    setSidebarOpen(!sidebarOpen);
  };

  const selectChat = (chat: ChatItem) => {
    setSelectedChat(chat);
    saveLastChat(chat);
    Animated.spring(sidebarAnim, {
      toValue: 0,
      useNativeDriver: false,
      tension: 65,
      friction: 11,
    }).start();
    setSidebarOpen(false);

    // Mark as read
    if (user) {
      if (chat.type === 'individual') {
        messageService.markConversationAsRead(user.id, chat.partnerId).catch(console.error);
        setIndividualChats(prev =>
          prev.map(c => c.partnerId === chat.partnerId ? { ...c, isRead: true } : c)
        );
      } else {
        podChatService.markAsRead(chat.pursuit_id, user.id).catch(console.error);
        setPodChats(prev =>
          prev.map(c => c.pursuit_id === chat.pursuit_id ? { ...c, unread_count: 0 } : c)
        );
      }
    }
  };

  const deleteChat = (chat: ChatItem) => {
    const chatName = chat.type === 'individual'
      ? (chat.partnerProfile?.name || chat.partnerEmail || 'this user')
      : (chat.custom_name || chat.pursuit_title);

    Alert.alert(
      'Delete Chat',
      `Are you sure you want to delete your chat with ${chatName}? This will only remove it from your view.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              if (chat.type === 'individual') {
                // Delete individual chat messages for this user
                if (user) {
                  await supabase
                    .from('messages')
                    .delete()
                    .or(`and(sender_id.eq.${user.id},receiver_id.eq.${chat.partnerId}),and(sender_id.eq.${chat.partnerId},receiver_id.eq.${user.id})`);
                }
                setIndividualChats(prev => prev.filter(c => c.partnerId !== chat.partnerId));
                // If this was the selected chat, select another one
                if (selectedChat?.type === 'individual' && (selectedChat as IndividualChat).partnerId === chat.partnerId) {
                  const remaining = [...individualChats.filter(c => c.partnerId !== chat.partnerId), ...podChats];
                  setSelectedChat(remaining.length > 0 ? remaining[0] : null);
                }
              } else {
                // For pod chats, just mark the read status very far in the future (hide from view)
                // We don't actually delete pod messages as other members need them
                if (user) {
                  await podChatService.markAsRead(chat.pursuit_id, user.id);
                }
                setPodChats(prev => prev.filter(c => c.pursuit_id !== chat.pursuit_id));
                if (selectedChat?.type === 'pod' && (selectedChat as PodChatItem).pursuit_id === chat.pursuit_id) {
                  const remaining = [...individualChats, ...podChats.filter(c => c.pursuit_id !== chat.pursuit_id)];
                  setSelectedChat(remaining.length > 0 ? remaining[0] : null);
                }
              }
            } catch (error) {
              console.error('Error deleting chat:', error);
              Alert.alert('Error', 'Failed to delete chat');
            }
          },
        },
      ]
    );
  };

  const getAllChats = (): ChatItem[] => {
    const all: ChatItem[] = [...individualChats, ...podChats];
    return all.sort((a, b) => {
      const timeA = a.type === 'individual' ? a.lastMessageTime : a.last_message_time;
      const timeB = b.type === 'individual' ? b.lastMessageTime : b.last_message_time;
      if (!timeA) return 1;
      if (!timeB) return -1;
      return new Date(timeB).getTime() - new Date(timeA).getTime();
    });
  };

  const getUnreadChats = (): ChatItem[] => {
    return getAllChats().filter(chat => {
      if (chat.type === 'individual') {
        return !chat.isRead;
      } else {
        return (chat.unread_count || 0) > 0;
      }
    });
  };

  const getUnreadCount = (): number => {
    return getUnreadChats().length;
  };

  // For now, requests tab shows empty - can be extended later for message requests
  const getRequestsCount = (): number => {
    return 0;
  };

  const sidebarTranslateX = sidebarAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-SIDEBAR_WIDTH, 0],
  });

  const overlayOpacity = sidebarAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.5],
  });

  const renderSidebarChat = (chat: ChatItem, isSelected: boolean) => {
    if (chat.type === 'individual') {
      return (
        <TouchableOpacity
          key={`ind-${chat.partnerId}`}
          style={[styles.sidebarItem, isSelected && styles.sidebarItemSelected]}
          onPress={() => selectChat(chat)}
        >
          {chat.partnerProfile?.profile_picture ? (
            <Image
              source={{ uri: chat.partnerProfile.profile_picture }}
              style={styles.sidebarAvatar}
            />
          ) : (
            <View style={styles.sidebarAvatar}>
              <Text style={styles.sidebarAvatarText}>
                {chat.partnerProfile?.name?.charAt(0).toUpperCase() || '?'}
              </Text>
            </View>
          )}
          <Text style={styles.sidebarItemText} numberOfLines={1}>
            {chat.partnerProfile?.name || chat.partnerEmail || 'User'}
          </Text>
          {!chat.isRead && <View style={styles.sidebarUnreadDot} />}
        </TouchableOpacity>
      );
    } else {
      return (
        <TouchableOpacity
          key={`pod-${chat.pursuit_id}`}
          style={[styles.sidebarItem, isSelected && styles.sidebarItemSelected]}
          onPress={() => selectChat(chat)}
        >
          {chat.default_picture ? (
            <Image source={{ uri: chat.default_picture }} style={styles.sidebarAvatarImage} />
          ) : (
            <View style={[styles.sidebarAvatar, styles.sidebarPodAvatar]}>
              <Text style={styles.sidebarAvatarText}>
                {(chat.custom_name || chat.pursuit_title).charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <Text style={styles.sidebarItemText} numberOfLines={1}>
            {chat.custom_name || chat.pursuit_title}
          </Text>
          {chat.unread_count > 0 && (
            <View style={styles.sidebarUnreadCount}>
              <Text style={styles.sidebarUnreadCountText}>{chat.unread_count}</Text>
            </View>
          )}
        </TouchableOpacity>
      );
    }
  };

  // Show loading state
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#8b5cf6" />
        <Text style={styles.loadingText}>Loading messages...</Text>
      </View>
    );
  }

  // No chats available
  if (!selectedChat && individualChats.length === 0 && podChats.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Messages</Text>
        </View>
        <View style={styles.emptyContainer}>
          <Ionicons name="chatbubbles-outline" size={64} color="#ccc" />
          <Text style={styles.emptyText}>No messages yet</Text>
          <Text style={styles.emptySubtext}>
            Start a conversation with your team members or join a pod to access pod chats
          </Text>
        </View>
      </View>
    );
  }

  // Determine which chat to show based on current selection
  const currentSelected = selectedChat as ChatItem | null;

  return (
    <View style={styles.container}>
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
        style={[
          styles.sidebar,
          { transform: [{ translateX: sidebarTranslateX }] },
        ]}
      >
        <View style={styles.sidebarHeader}>
          <Text style={styles.sidebarTitle}>All Chats</Text>
          <TouchableOpacity onPress={toggleSidebar} style={styles.sidebarCloseBtn}>
            <Ionicons name="close" size={24} color="#333" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.sidebarScrollView}>
          {/* Direct Messages Section */}
          <Text style={styles.sidebarSectionTitle}>Direct Messages</Text>
          {individualChats.length === 0 ? (
            <Text style={styles.sidebarEmptyText}>No direct messages</Text>
          ) : (
            individualChats.map(chat => {
              const isSelected = currentSelected?.type === 'individual' &&
                (currentSelected as IndividualChat).partnerId === chat.partnerId;
              return renderSidebarChat(chat, isSelected);
            })
          )}

          {/* Pod Chats Section */}
          <Text style={styles.sidebarSectionTitle}>Pod Chats</Text>
          {podChats.length === 0 ? (
            <Text style={styles.sidebarEmptyText}>No pod chats</Text>
          ) : (
            podChats.map(chat => {
              const isSelected = currentSelected?.type === 'pod' &&
                (currentSelected as PodChatItem).pursuit_id === chat.pursuit_id;
              return renderSidebarChat(chat, isSelected);
            })
          )}
        </ScrollView>
      </Animated.View>

      {/* Header with Tabs */}
      <View style={styles.tabsHeader}>
        <Text style={styles.headerTitle}>Messages</Text>
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'chats' && styles.tabActive]}
            onPress={() => setActiveTab('chats')}
          >
            <Text style={[styles.tabText, activeTab === 'chats' && styles.tabTextActive]}>
              Chats
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'unread' && styles.tabActive]}
            onPress={() => setActiveTab('unread')}
          >
            <Text style={[styles.tabText, activeTab === 'unread' && styles.tabTextActive]}>
              Unread
            </Text>
            {getUnreadCount() > 0 && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{getUnreadCount()}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'requests' && styles.tabActive]}
            onPress={() => setActiveTab('requests')}
          >
            <Text style={[styles.tabText, activeTab === 'requests' && styles.tabTextActive]}>
              Requests
            </Text>
            {getRequestsCount() > 0 && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{getRequestsCount()}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Chat Area */}
      <View style={styles.chatArea}>
        {activeTab === 'requests' ? (
          <View style={styles.noChatSelected}>
            <Ionicons name="mail-outline" size={64} color="#ccc" />
            <Text style={styles.noChatText}>No message requests</Text>
            <Text style={styles.emptySubtext}>
              Message requests from people you don't know will appear here
            </Text>
          </View>
        ) : activeTab === 'unread' && getUnreadCount() === 0 ? (
          <View style={styles.noChatSelected}>
            <Ionicons name="checkmark-circle-outline" size={64} color="#ccc" />
            <Text style={styles.noChatText}>All caught up!</Text>
            <Text style={styles.emptySubtext}>
              No unread messages
            </Text>
          </View>
        ) : selectedChat ? (
          selectedChat.type === 'individual' ? (
            <ChatScreen
              partnerId={selectedChat.partnerId}
              partnerEmail={selectedChat.partnerProfile?.email || selectedChat.partnerEmail || 'User'}
              onBack={toggleSidebar}
              navigation={navigation}
              showMenuButton={true}
              onMenuPress={toggleSidebar}
              onDelete={() => deleteChat(selectedChat)}
            />
          ) : (
            <PodChatScreen
              pursuitId={selectedChat.pursuit_id}
              pursuitTitle={selectedChat.pursuit_title}
              customName={selectedChat.custom_name}
              podPicture={selectedChat.default_picture}
              onBack={toggleSidebar}
              onNameChanged={(newName) => {
                setPodChats(prev =>
                  prev.map(c => c.pursuit_id === selectedChat.pursuit_id
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
          <View style={styles.noChatSelected}>
            <Ionicons name="chatbubbles-outline" size={64} color="#ccc" />
            <Text style={styles.noChatText}>Select a chat</Text>
            <TouchableOpacity style={styles.openSidebarButton} onPress={toggleSidebar}>
              <Text style={styles.openSidebarButtonText}>Open Chat List</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  header: {
    backgroundColor: '#fff',
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  // Sidebar styles
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    zIndex: 10,
  },
  sidebar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: SIDEBAR_WIDTH,
    backgroundColor: '#fff',
    zIndex: 20,
    paddingTop: 50,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  sidebarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  sidebarTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
  },
  sidebarCloseBtn: {
    padding: 4,
  },
  sidebarScrollView: {
    flex: 1,
  },
  sidebarSectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    backgroundColor: '#fff',
  },
  sidebarItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  sidebarItemSelected: {
    backgroundColor: '#f0f0ff',
    borderLeftWidth: 3,
    borderLeftColor: '#8b5cf6',
  },
  sidebarAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0ea5e9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  sidebarPodAvatar: {
    backgroundColor: '#8b5cf6',
  },
  sidebarAvatarText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
  sidebarAvatarImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12,
  },
  sidebarItemText: {
    flex: 1,
    fontSize: 15,
    color: '#333',
  },
  sidebarUnreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#0ea5e9',
  },
  sidebarUnreadCount: {
    backgroundColor: '#8b5cf6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    alignItems: 'center',
  },
  sidebarUnreadCountText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#fff',
  },
  sidebarEmptyText: {
    fontSize: 13,
    color: '#999',
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontStyle: 'italic',
  },
  // Empty state
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#999',
    marginTop: 20,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#ccc',
    marginTop: 8,
    textAlign: 'center',
  },
  noChatSelected: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noChatText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#999',
    marginTop: 20,
  },
  openSidebarButton: {
    marginTop: 16,
    backgroundColor: '#8b5cf6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  openSidebarButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Tabs header
  tabsHeader: {
    backgroundColor: '#fff',
    paddingTop: 50,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  tabsContainer: {
    flexDirection: 'row',
    marginTop: 16,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginRight: 8,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#8b5cf6',
  },
  tabText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#666',
  },
  tabTextActive: {
    color: '#8b5cf6',
    fontWeight: '600',
  },
  tabBadge: {
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
    paddingHorizontal: 6,
  },
  tabBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  chatArea: {
    flex: 1,
  },
});
