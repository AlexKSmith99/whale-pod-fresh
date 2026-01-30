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
  Alert,
  Keyboard,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import PodMemberCollage from '../components/PodMemberCollage';
import { podChatService, PodChatMessage } from '../services/podChatService';
import { notificationService } from '../services/notificationService';
import { supabase } from '../config/supabase';
import { colors as legacyColors } from '../theme/designSystem';
import { useTheme } from '../theme/ThemeContext';
import { getThemedStyles } from '../theme/themedStyles';
import GrainTexture from '../components/ui/GrainTexture';

interface Props {
  pursuitId: string;
  pursuitTitle: string;
  customName?: string;
  podPicture?: string;
  onBack: () => void;
  onNameChanged?: (newName: string) => void;
  navigation?: any;
  showMenuButton?: boolean;
  onMenuPress?: () => void;
  onDelete?: () => void;
}

export default function PodChatScreen({ pursuitId, pursuitTitle, customName, podPicture, onBack, onNameChanged, navigation, showMenuButton, onMenuPress, onDelete }: Props) {
  const { user } = useAuth();
  const { theme, isNewTheme } = useTheme();
  const colors = theme.colors;
  const themedStyles = getThemedStyles(colors, isNewTheme);
  const [messages, setMessages] = useState<PodChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<any[]>([]);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [chatName, setChatName] = useState(customName || pursuitTitle);
  const [tempChatName, setTempChatName] = useState('');
  const flatListRef = useRef<FlatList>(null);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [myProfile, setMyProfile] = useState<any>(null);
  const [expandedMessageId, setExpandedMessageId] = useState<string | null>(null);

  // Update chatName when props change (e.g., when switching to a different chat)
  useEffect(() => {
    setChatName(customName || pursuitTitle);
  }, [customName, pursuitTitle]);

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

  const handleRenameChat = () => {
    setShowOptionsMenu(false);
    setTempChatName(chatName);
    setShowRenameModal(true);
  };

  useEffect(() => {
    loadMessages();
    loadMembers();
    loadMyProfile();
    markAsRead();
    const interval = setInterval(loadMessages, 3000);
    return () => clearInterval(interval);
  }, [pursuitId]);

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
      const data = await podChatService.getMessages(pursuitId);
      setMessages(data);
    } catch (error) {
      console.error('Error loading pod chat messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMembers = async () => {
    try {
      const data = await podChatService.getPodMembers(pursuitId);
      setMembers(data);
    } catch (error) {
      console.error('Error loading pod members:', error);
    }
  };

  const markAsRead = async () => {
    try {
      if (user) {
        await podChatService.markAsRead(pursuitId, user.id);
      }
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const handleSend = async () => {
    if (!newMessage.trim() || !user) return;

    const messageText = newMessage.trim();
    setNewMessage('');
    Keyboard.dismiss();

    try {
      await podChatService.sendMessage(pursuitId, user.id, messageText);
      await loadMessages();
      // With inverted FlatList, newest messages are already at position 0 (bottom visually)
      
      // Send push notification to all other pod members (push only, no Alerts tab)
      const senderName = myProfile?.name || user.email || 'Someone';
      const messagePreview = messageText.length > 50 ? messageText.substring(0, 50) + '...' : messageText;
      const otherMemberIds = members
        .filter(m => m.user_id !== user.id)
        .map(m => m.user_id);
      
      if (otherMemberIds.length > 0) {
        await notificationService.sendPushOnly(
          otherMemberIds,
          `${senderName} in ${chatName}`,
          messagePreview,
          {
            type: 'pod_chat_message',
            pursuitId,
          }
        );
      }
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message');
    }
  };

  const handleRename = async () => {
    if (!tempChatName.trim()) return;

    try {
      await podChatService.updateChatName(pursuitId, tempChatName.trim());
      setChatName(tempChatName.trim());
      setShowRenameModal(false);
      onNameChanged?.(tempChatName.trim());
    } catch (error) {
      console.error('Error renaming chat:', error);
      Alert.alert('Error', 'Failed to rename chat');
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
  const isFirstInThread = (index: number): boolean => {
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

  const renderMessage = ({ item, index }: { item: PodChatMessage; index: number }) => {
    const isMyMessage = item.sender_id === user?.id;
    const sender = item.sender;
    const showTimeSeparator = hasTimeGap(item.created_at, index > 0 ? messages[index - 1]?.created_at : null);
    const showHeaderAndAvatar = isFirstInThread(index);

    // Avatar component for reuse
    const renderAvatar = (profile: any, isClickable: boolean = false) => {
      const avatarContent = profile?.profile_picture ? (
        <Image
          source={{ uri: profile.profile_picture }}
          style={styles.messageAvatar}
        />
      ) : (
        <View style={[styles.messageAvatar, { backgroundColor: isNewTheme ? colors.accentGreen : legacyColors.primary }]}>
          <Text style={[styles.messageAvatarText, { color: isNewTheme ? colors.background : '#fff' }]}>
            {profile?.name?.charAt(0).toUpperCase() ||
             profile?.email?.charAt(0).toUpperCase() || '?'}
          </Text>
        </View>
      );

      if (isClickable) {
        return (
          <TouchableOpacity onPress={() => navigation?.navigate('UserProfile', { userId: item.sender_id })}>
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
            <Text style={[styles.timeSeparatorText, { color: colors.textTertiary, backgroundColor: colors.surfaceAlt, fontFamily: isNewTheme ? 'Magra_400Regular' : undefined }]}>
              {formatTimeSeparator(item.created_at)}
            </Text>
          </View>
        )}

        {/* Message */}
        <View
          style={[
            styles.messageContainer,
            isMyMessage ? styles.myMessageContainer : styles.theirMessageContainer,
            !showHeaderAndAvatar && styles.consecutiveMessage,
          ]}
        >
          {isMyMessage ? (
            <>
              <View style={styles.myMessageContent}>
                {/* Sender name for my messages - only on first in thread */}
                {showHeaderAndAvatar && (
                  <Text style={[styles.senderName, styles.mySenderName, { color: colors.textSecondary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>
                    {myProfile?.name || 'You'}
                  </Text>
                )}
                <View style={styles.bubbleWrapper}>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setExpandedMessageId(expandedMessageId === item.id ? null : item.id)}
                    style={[styles.messageBubble, styles.myMessageBubble, { backgroundColor: isNewTheme ? colors.accentGreen : '#8b5cf6' }]}
                  >
                    <Text style={[styles.messageText, styles.myMessageText, { color: isNewTheme ? colors.background : '#fff', fontFamily: isNewTheme ? 'Magra_400Regular' : undefined }]}>{item.content}</Text>
                  </TouchableOpacity>
                  {expandedMessageId === item.id && (
                    <Text style={[styles.expandedTimestamp, styles.expandedTimestampRight, { color: colors.textTertiary }]}>
                      {new Date(item.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                    </Text>
                  )}
                </View>
              </View>
              {/* Avatar placeholder to maintain alignment */}
              <View style={showHeaderAndAvatar ? undefined : styles.avatarPlaceholder}>
                {showHeaderAndAvatar && renderAvatar(myProfile)}
              </View>
            </>
          ) : (
            <>
              {/* Avatar placeholder to maintain alignment */}
              <View style={showHeaderAndAvatar ? undefined : styles.avatarPlaceholder}>
                {showHeaderAndAvatar && renderAvatar(sender, true)}
              </View>
              <View style={styles.theirMessageContent}>
                {/* Sender name - only on first in thread */}
                {showHeaderAndAvatar && (
                  <Text style={[styles.senderName, { color: colors.textSecondary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>
                    {sender?.name || 'User'}
                  </Text>
                )}
                <View style={styles.bubbleWrapper}>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setExpandedMessageId(expandedMessageId === item.id ? null : item.id)}
                    style={[styles.messageBubble, styles.theirMessageBubble, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  >
                    <Text style={[styles.messageText, { color: colors.textPrimary, fontFamily: isNewTheme ? 'Magra_400Regular' : undefined }]}>{item.content}</Text>
                  </TouchableOpacity>
                  {expandedMessageId === item.id && (
                    <Text style={[styles.expandedTimestamp, styles.expandedTimestampLeft, { color: colors.textTertiary }]}>
                      {new Date(item.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                    </Text>
                  )}
                </View>
              </View>
            </>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isNewTheme ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      {isNewTheme && <GrainTexture opacity={0.06} />}
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={handleMenuPress} style={styles.backButton}>
          <Ionicons name={showMenuButton ? "ellipsis-vertical" : "arrow-back"} size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.headerInfo}
          onPress={() => setShowMembersModal(true)}
        >
          {podPicture ? (
            <Image source={{ uri: podPicture }} style={styles.groupImage} />
          ) : (
            <PodMemberCollage members={members} size={40} />
          )}
          <View style={styles.headerTextContainer}>
            <Text style={[styles.headerTitle, { color: colors.textPrimary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]} numberOfLines={1}>
              {chatName}
            </Text>
            <Text style={[styles.memberCount, { color: colors.textSecondary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>
              {members.length} members
            </Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.menuButton}
          onPress={() => {
            setTempChatName(chatName);
            setShowRenameModal(true);
          }}
        >
          <Ionicons name="create-outline" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Messages */}
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
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbubbles-outline" size={48} color={colors.textTertiary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary, fontFamily: isNewTheme ? 'Magra_400Regular' : undefined }]}>
                {loading ? 'Loading...' : 'No messages yet'}
              </Text>
              <Text style={[styles.emptySubtext, { color: colors.textTertiary, fontFamily: isNewTheme ? 'Magra_400Regular' : undefined }]}>
                Start the conversation!
              </Text>
            </View>
          }
        />
      </View>

      {/* Input */}
      <View style={[styles.inputContainer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <TextInput
          style={[styles.input, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.background, fontFamily: isNewTheme ? 'Magra_400Regular' : undefined }]}
          placeholder="Type a message..."
          placeholderTextColor={colors.textTertiary}
          value={newMessage}
          onChangeText={setNewMessage}
          multiline
          spellCheck={true}
          autoCorrect={true}
        />
        <TouchableOpacity style={[styles.sendButton, { backgroundColor: isNewTheme ? colors.accentGreen : '#8b5cf6' }]} onPress={handleSend}>
          <Ionicons name="send" size={24} color={isNewTheme ? colors.background : '#fff'} />
        </TouchableOpacity>
      </View>

      {/* Members Modal */}
      <Modal
        visible={showMembersModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowMembersModal(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: isNewTheme ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.5)' }]}>
          <View style={[styles.modalContainer, { backgroundColor: colors.surface }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>Pod Members</Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setShowMembersModal(false)}
              >
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={members}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.memberCard, { borderBottomColor: colors.border }]}
                  onPress={() => {
                    setShowMembersModal(false);
                    navigation?.navigate('UserProfile', { userId: item.id });
                  }}
                >
                  {item.profile_picture ? (
                    <Image source={{ uri: item.profile_picture }} style={styles.memberAvatar} />
                  ) : (
                    <View style={[styles.memberAvatar, { backgroundColor: isNewTheme ? colors.accentGreen : '#10b981' }]}>
                      <Text style={[styles.memberAvatarText, { color: isNewTheme ? colors.background : '#fff' }]}>
                        {item.name?.charAt(0).toUpperCase() || '?'}
                      </Text>
                    </View>
                  )}
                  <View style={styles.memberInfo}>
                    <Text style={[styles.memberName, { color: colors.textPrimary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>{item.name || 'Team Member'}</Text>
                    {item.isCreator && (
                      <View style={[styles.creatorBadge, { backgroundColor: isNewTheme ? colors.accentGreen : '#8b5cf6' }]}>
                        <Text style={[styles.creatorBadgeText, { color: isNewTheme ? colors.background : '#fff' }]}>Creator</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Rename Modal */}
      <Modal
        visible={showRenameModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowRenameModal(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: isNewTheme ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.5)' }]}>
          <View style={[styles.renameModalContainer, { backgroundColor: colors.surface }]}>
            <Text style={[styles.renameModalTitle, { color: colors.textPrimary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>Rename Chat</Text>
            <TextInput
              style={[styles.renameInput, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.background, fontFamily: isNewTheme ? 'Magra_400Regular' : undefined }]}
              value={tempChatName}
              onChangeText={setTempChatName}
              placeholder="Enter new chat name"
              placeholderTextColor={colors.textTertiary}
              autoFocus
            />
            <View style={styles.renameButtons}>
              <TouchableOpacity
                style={[styles.cancelButton, { backgroundColor: colors.surfaceAlt }]}
                onPress={() => setShowRenameModal(false)}
              >
                <Text style={[styles.cancelButtonText, { color: colors.textSecondary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, { backgroundColor: isNewTheme ? colors.accentGreen : '#8b5cf6' }]}
                onPress={handleRename}
              >
                <Text style={[styles.saveButtonText, { color: isNewTheme ? colors.background : '#fff', fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Options Menu Modal */}
      <Modal
        visible={showOptionsMenu}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowOptionsMenu(false)}
      >
        <TouchableOpacity
          style={[styles.optionsOverlay, { backgroundColor: isNewTheme ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.5)' }]}
          activeOpacity={1}
          onPress={() => setShowOptionsMenu(false)}
        >
          <View style={[styles.optionsContainer, { backgroundColor: colors.surface }]}>
            <TouchableOpacity style={styles.optionItem} onPress={handleSwitchChats}>
              <Ionicons name="chatbubbles-outline" size={22} color={colors.textPrimary} />
              <Text style={[styles.optionText, { color: colors.textPrimary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>Switch Chats</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.optionItem} onPress={handleRenameChat}>
              <Ionicons name="create-outline" size={22} color={colors.textPrimary} />
              <Text style={[styles.optionText, { color: colors.textPrimary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>Rename Chat</Text>
            </TouchableOpacity>
            {onDelete && (
              <TouchableOpacity style={styles.optionItemDanger} onPress={handleDeleteChat}>
                <Ionicons name="trash-outline" size={22} color={colors.error} />
                <Text style={[styles.optionTextDanger, { color: colors.error, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>Delete Chat</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[styles.optionCancel, { borderTopColor: colors.border }]} onPress={() => setShowOptionsMenu(false)}>
              <Text style={[styles.optionCancelText, { color: colors.textSecondary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>Cancel</Text>
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
    backgroundColor: legacyColors.background,
  },
  header: {
    flexDirection: 'row',
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
  headerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
  },
  groupIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#8b5cf6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  headerTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  memberCount: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  menuButton: {
    padding: 8,
  },
  messagesList: {
    padding: 10,
    paddingBottom: 20,
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
  myMessageContainer: {
    justifyContent: 'flex-end',
  },
  theirMessageContainer: {
    justifyContent: 'flex-start',
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
  myMessageContent: {
    alignItems: 'flex-end',
    flex: 1,
  },
  theirMessageContent: {
    alignItems: 'flex-start',
    flex: 1,
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
    marginLeft: 4,
  },
  mySenderName: {
    textAlign: 'right',
    marginRight: 4,
    marginLeft: 0,
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
    maxWidth: '80%',
  },
  messageBubble: {
    padding: 12,
    borderRadius: 16,
  },
  myMessageBubble: {
    backgroundColor: '#8b5cf6',
    borderBottomRightRadius: 4,
  },
  theirMessageBubble: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: legacyColors.border,
  },
  messageText: {
    fontSize: 15,
    color: '#333',
  },
  myMessageText: {
    color: '#fff',
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
    backgroundColor: '#8b5cf6',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
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
    marginTop: 5,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  modalCloseButton: {
    padding: 4,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  memberAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#10b981',
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberAvatarText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  memberInfo: {
    flex: 1,
    marginLeft: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  creatorBadge: {
    backgroundColor: '#8b5cf6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  creatorBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#fff',
  },
  // Rename modal
  renameModalContainer: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginTop: 'auto',
    marginBottom: 'auto',
    borderRadius: 16,
    padding: 20,
  },
  renameModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  renameInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  renameButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#8b5cf6',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  // Options menu
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
