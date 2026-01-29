import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  Modal,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { messageService } from '../services/messageService';
import { notificationService } from '../services/notificationService';
import { supabase } from '../config/supabase';
import { colors } from '../theme/designSystem';

interface Props {
  partnerId: string;
  partnerEmail: string;
  onBack: () => void;
  navigation?: any;
  showMenuButton?: boolean;
  onMenuPress?: () => void;
  onDelete?: () => void;
}

export default function ChatScreen({ partnerId, partnerEmail, onBack, navigation, showMenuButton, onMenuPress, onDelete }: Props) {
  const { user } = useAuth();
  const flatListRef = useRef<FlatList>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [otherUserProfile, setOtherUserProfile] = useState<any>(null);
  const [myProfile, setMyProfile] = useState<any>(null);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [expandedMessageId, setExpandedMessageId] = useState<string | null>(null);

  const handleMenuPress = () => {
    if (showMenuButton && onMenuPress) {
      setShowOptionsMenu(true);
    } else {
      onBack();
    }
  };

  const handleSwitchChats = () => {
    setShowOptionsMenu(false);
    onMenuPress?.();
  };

  const handleDeleteChat = () => {
    setShowOptionsMenu(false);
    onDelete?.();
  };

  useEffect(() => {
    loadUserProfile();
    loadMyProfile();
    loadMessages();
    markMessagesAsRead();
    const interval = setInterval(loadMessages, 3000);
    return () => clearInterval(interval);
  }, [partnerId]);

  const loadUserProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('name, profile_picture, email')
        .eq('id', partnerId)
        .single();

      if (!error && data) {
        setOtherUserProfile(data);
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  };

  const loadMyProfile = async () => {
    try {
      if (user) {
        const { data, error } = await supabase
          .from('profiles')
          .select('name, profile_picture, email')
          .eq('id', user.id)
          .single();

        if (!error && data) {
          setMyProfile(data);
        }
      }
    } catch (error) {
      console.error('Error loading my profile:', error);
    }
  };

  const loadMessages = async () => {
    try {
      if (user) {
        const data = await messageService.getConversation(user.id, partnerId);
        setMessages(data);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const markMessagesAsRead = async () => {
    try {
      if (user) {
        console.log('📧 Marking messages as read for conversation with:', partnerId);
        await messageService.markConversationAsRead(user.id, partnerId);
        console.log('✅ Messages marked as read successfully');
      }
    } catch (error) {
      console.error('❌ Error marking messages as read:', error);
    }
  };

  const handleSend = async () => {
    if (!newMessage.trim() || !user) return;

    const messageText = newMessage.trim();
    setNewMessage('');
    Keyboard.dismiss();

    try {
      await messageService.sendMessage(user.id, partnerId, messageText);
      await loadMessages();
      // With inverted FlatList, newest messages are already at position 0 (bottom visually)
      
      // Send notification to recipient
      const senderName = myProfile?.name || user.email || 'Someone';
      const messagePreview = messageText.length > 50 ? messageText.substring(0, 50) + '...' : messageText;
      await notificationService.notifyNewMessage(
        partnerId,
        senderName,
        messagePreview,
        partnerId // Using partnerId as conversationId
      );
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  // Check if there's more than 1 hour gap between two messages
  const hasTimeGap = (currentTime: string, previousTime: string | null): boolean => {
    if (!previousTime) return true; // First message always shows timestamp
    const current = new Date(currentTime).getTime();
    const previous = new Date(previousTime).getTime();
    const hourInMs = 60 * 60 * 1000;
    return (current - previous) >= hourInMs;
  };

  // Check if this is the first message in a consecutive thread from the same sender
  const isFirstInThread = (index: number, messages: any[]): boolean => {
    if (index === 0) return true;
    const currentMessage = messages[index];
    const previousMessage = messages[index - 1];
    
    // Different sender = start of new thread
    if (currentMessage.sender_id !== previousMessage.sender_id) return true;
    
    // More than 1 hour gap = start of new thread
    if (hasTimeGap(currentMessage.created_at, previousMessage.created_at)) return true;
    
    return false;
  };

  // Format timestamp for the separator
  const formatTimeSeparator = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    const timeStr = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    
    if (isToday) {
      return `Today at ${timeStr}`;
    } else if (isYesterday) {
      return `Yesterday at ${timeStr}`;
    } else {
      return date.toLocaleDateString([], { 
        month: 'short', 
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined 
      }) + ` at ${timeStr}`;
    }
  };

  const renderMessage = ({ item, index }: { item: any; index: number }) => {
    const isMyMessage = item.sender_id === user?.id;
    const showTimeSeparator = hasTimeGap(item.created_at, index > 0 ? messages[index - 1]?.created_at : null);
    const showAvatar = isFirstInThread(index, messages);

    // Avatar component for reuse
    const renderAvatar = (profile: any, isClickable: boolean = false) => {
      const avatarContent = profile?.profile_picture ? (
        <Image
          source={{ uri: profile.profile_picture }}
          style={styles.messageAvatar}
        />
      ) : (
        <View style={styles.messageAvatar}>
          <Text style={styles.messageAvatarText}>
            {profile?.name?.charAt(0).toUpperCase() ||
             profile?.email?.charAt(0).toUpperCase() || '?'}
          </Text>
        </View>
      );

      if (isClickable) {
        return (
          <TouchableOpacity onPress={() => navigation?.navigate('UserProfile', { userId: partnerId })}>
            {avatarContent}
          </TouchableOpacity>
        );
      }
      return avatarContent;
    };

    return (
      <View>
        {/* Time separator - shown when 1+ hour gap */}
        {showTimeSeparator && (
          <View style={styles.timeSeparator}>
            <Text style={styles.timeSeparatorText}>
              {formatTimeSeparator(item.created_at)}
            </Text>
          </View>
        )}

        {/* Message */}
        <View
          style={[
            styles.messageContainer,
            isMyMessage ? styles.myMessageContainer : styles.theirMessageContainer,
            !showAvatar && styles.consecutiveMessage,
          ]}
        >
          {isMyMessage ? (
            <>
              <View style={styles.bubbleWrapper}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setExpandedMessageId(expandedMessageId === item.id ? null : item.id)}
                  style={[
                    styles.messageBubble,
                    styles.myMessageBubble,
                  ]}
                >
                  <Text style={[styles.messageText, styles.myMessageText]}>{item.content}</Text>
                </TouchableOpacity>
                {expandedMessageId === item.id && (
                  <Text style={[styles.expandedTimestamp, styles.expandedTimestampRight]}>
                    {new Date(item.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                  </Text>
                )}
              </View>
              {/* Avatar placeholder to maintain alignment, only visible on first message of thread */}
              <View style={showAvatar ? undefined : styles.avatarPlaceholder}>
                {showAvatar && renderAvatar(myProfile)}
              </View>
            </>
          ) : (
            <>
              {/* Avatar placeholder to maintain alignment, only visible on first message of thread */}
              <View style={showAvatar ? undefined : styles.avatarPlaceholder}>
                {showAvatar && renderAvatar(otherUserProfile, true)}
              </View>
              <View style={styles.bubbleWrapper}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setExpandedMessageId(expandedMessageId === item.id ? null : item.id)}
                  style={[
                    styles.messageBubble,
                    styles.theirMessageBubble,
                  ]}
                >
                  <Text style={styles.messageText}>{item.content}</Text>
                </TouchableOpacity>
                {expandedMessageId === item.id && (
                  <Text style={[styles.expandedTimestamp, styles.expandedTimestampLeft]}>
                    {new Date(item.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                  </Text>
                )}
              </View>
            </>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleMenuPress} style={styles.backButton}>
          <Ionicons name={showMenuButton ? "ellipsis-vertical" : "arrow-back"} size={24} color="#333" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.headerUserInfo}
          onPress={() => navigation?.navigate('UserProfile', { userId: partnerId })}
        >
          {otherUserProfile?.profile_picture ? (
            <Image
              source={{ uri: otherUserProfile.profile_picture }}
              style={styles.headerAvatar}
            />
          ) : (
            <View style={styles.headerAvatar}>
              <Text style={styles.headerAvatarText}>
                {otherUserProfile?.name?.charAt(0).toUpperCase() ||
                 otherUserProfile?.email?.charAt(0).toUpperCase() || '?'}
              </Text>
            </View>
          )}
          <Text style={styles.headerUserName}>
            {otherUserProfile?.name || 'User'}
          </Text>
        </TouchableOpacity>
        <View style={{ width: 24 }} />
      </View>

      <View style={{ flex: 1 }}>
        <FlatList
          ref={flatListRef}
          data={[...messages].reverse()}
          renderItem={({ item, index }) => renderMessage({ item, index: messages.length - 1 - index })}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          inverted={true}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        />
      </View>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Type a message..."
          value={newMessage}
          onChangeText={setNewMessage}
          multiline
          spellCheck={true}
          autoCorrect={true}
        />
        <TouchableOpacity style={styles.sendButton} onPress={handleSend}>
          <Ionicons name="send" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Options Menu Modal */}
      <Modal
        visible={showOptionsMenu}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowOptionsMenu(false)}
      >
        <TouchableOpacity
          style={styles.optionsOverlay}
          activeOpacity={1}
          onPress={() => setShowOptionsMenu(false)}
        >
          <View style={styles.optionsContainer}>
            <TouchableOpacity style={styles.optionItem} onPress={handleSwitchChats}>
              <Ionicons name="chatbubbles-outline" size={22} color="#333" />
              <Text style={styles.optionText}>Switch Chats</Text>
            </TouchableOpacity>
            {onDelete && (
              <TouchableOpacity style={styles.optionItemDanger} onPress={handleDeleteChat}>
                <Ionicons name="trash-outline" size={22} color="#ef4444" />
                <Text style={styles.optionTextDanger}>Delete Chat</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.optionCancel} onPress={() => setShowOptionsMenu(false)}>
              <Text style={styles.optionCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    paddingTop: 50,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    padding: 4,
  },
  headerUserInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  headerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#0ea5e9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerAvatarText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerUserName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  messagesList: {
    padding: 10,
    flexGrow: 1,
  },
  messageContainer: {
    marginBottom: 4,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  consecutiveMessage: {
    marginBottom: 2,
  },
  messageAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#0ea5e9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageAvatarText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
  myMessageContainer: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  theirMessageContainer: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  messageBubble: {
    padding: 12,
    borderRadius: 16,
  },
  myMessageBubble: {
    backgroundColor: '#0ea5e9',
    borderBottomRightRadius: 4,
  },
  theirMessageBubble: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  messageText: {
    fontSize: 15,
    color: '#333',
  },
  myMessageText: {
    color: '#fff',
  },
  timeSeparator: {
    alignItems: 'center',
    marginVertical: 8,
  },
  timeSeparatorText: {
    fontSize: 12,
    color: '#999',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  avatarPlaceholder: {
    width: 32,
    height: 32,
  },
  bubbleWrapper: {
    maxWidth: '75%',
  },
  expandedTimestamp: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
    marginBottom: 2,
  },
  expandedTimestampRight: {
    textAlign: 'right',
    marginRight: 4,
  },
  expandedTimestampLeft: {
    textAlign: 'left',
    marginLeft: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 8,
    marginRight: 10,
    maxHeight: 100,
    fontSize: 15,
  },
  sendButton: {
    backgroundColor: '#0ea5e9',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  optionsContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    paddingBottom: 34,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 12,
  },
  optionText: {
    fontSize: 16,
    color: '#333',
  },
  optionItemDanger: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 12,
  },
  optionTextDanger: {
    fontSize: 16,
    color: '#ef4444',
  },
  optionCancel: {
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  optionCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
});