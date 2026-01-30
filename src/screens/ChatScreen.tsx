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
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { messageService } from '../services/messageService';
import { notificationService } from '../services/notificationService';
import { supabase } from '../config/supabase';
import { colors as legacyColors, typography, spacing } from '../theme/designSystem';
import { useTheme } from '../theme/ThemeContext';
import { getThemedStyles } from '../theme/themedStyles';
import GrainTexture from '../components/ui/GrainTexture';

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
  const { theme, isNewTheme } = useTheme();
  const colors = theme.colors;
  const themedStyles = getThemedStyles(colors, isNewTheme);
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

  // Dynamic styles based on theme
  const dynamicStyles = {
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row' as const,
      justifyContent: 'space-between' as const,
      alignItems: 'center' as const,
      padding: spacing.base,
      paddingTop: 50,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerAvatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: isNewTheme ? colors.accentGreen : legacyColors.primary,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
    },
    headerAvatarText: {
      fontSize: 14,
      fontWeight: 'bold' as const,
      color: isNewTheme ? colors.background : legacyColors.white,
    },
    headerUserName: {
      fontSize: typography.fontSize.lg,
      fontWeight: typography.fontWeight.semibold as '600',
      color: colors.textPrimary,
      fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined,
    },
    messagesList: {
      padding: spacing.sm,
      flexGrow: 1,
      backgroundColor: colors.background,
    },
    messageAvatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: isNewTheme ? colors.accentGreen : legacyColors.primary,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
    },
    messageAvatarText: {
      fontSize: 14,
      fontWeight: 'bold' as const,
      color: isNewTheme ? colors.background : legacyColors.white,
    },
    myMessageBubble: {
      padding: spacing.md,
      borderRadius: 16,
      backgroundColor: isNewTheme ? colors.accentGreen : legacyColors.primary,
      borderBottomRightRadius: 4,
    },
    theirMessageBubble: {
      padding: spacing.md,
      borderRadius: 16,
      backgroundColor: isNewTheme ? colors.surface : legacyColors.white,
      borderBottomLeftRadius: 4,
      borderWidth: 1,
      borderColor: colors.border,
    },
    messageText: {
      fontSize: typography.fontSize.base,
      color: colors.textPrimary,
      fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined,
    },
    myMessageText: {
      color: isNewTheme ? colors.background : legacyColors.white,
    },
    timeSeparator: {
      alignItems: 'center' as const,
      marginVertical: spacing.sm,
    },
    timeSeparatorText: {
      fontSize: typography.fontSize.xs,
      color: colors.textSecondary,
      backgroundColor: isNewTheme ? colors.surfaceAlt : '#f5f5f5',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: 12,
      fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined,
    },
    expandedTimestamp: {
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 4,
      marginBottom: 2,
      fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined,
    },
    inputContainer: {
      flexDirection: 'row' as const,
      padding: spacing.sm,
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      alignItems: 'flex-end' as const,
    },
    input: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 20,
      paddingHorizontal: spacing.base,
      paddingVertical: spacing.sm,
      marginRight: spacing.sm,
      maxHeight: 100,
      fontSize: typography.fontSize.base,
      backgroundColor: isNewTheme ? colors.surfaceAlt : legacyColors.white,
      color: colors.textPrimary,
      fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined,
    },
    sendButton: {
      backgroundColor: isNewTheme ? colors.accentGreen : legacyColors.primary,
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
    },
    optionsOverlay: {
      flex: 1,
      backgroundColor: isNewTheme ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end' as const,
    },
    optionsContainer: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingTop: spacing.md,
      paddingBottom: 34,
    },
    optionItem: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      paddingVertical: spacing.base,
      paddingHorizontal: spacing.lg,
      gap: spacing.md,
    },
    optionText: {
      fontSize: typography.fontSize.base,
      color: colors.textPrimary,
      fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined,
    },
    optionTextDanger: {
      fontSize: typography.fontSize.base,
      color: colors.error,
      fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined,
    },
    optionCancel: {
      alignItems: 'center' as const,
      paddingVertical: spacing.base,
      marginTop: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    optionCancelText: {
      fontSize: typography.fontSize.base,
      fontWeight: typography.fontWeight.semibold as '600',
      color: colors.textSecondary,
      fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined,
    },
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
          style={dynamicStyles.messageAvatar}
        />
      ) : (
        <View style={dynamicStyles.messageAvatar}>
          <Text style={dynamicStyles.messageAvatarText}>
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
          <View style={dynamicStyles.timeSeparator}>
            <Text style={dynamicStyles.timeSeparatorText}>
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
                  style={dynamicStyles.myMessageBubble}
                >
                  <Text style={[dynamicStyles.messageText, dynamicStyles.myMessageText]}>{item.content}</Text>
                </TouchableOpacity>
                {expandedMessageId === item.id && (
                  <Text style={[dynamicStyles.expandedTimestamp, styles.expandedTimestampRight]}>
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
                  style={dynamicStyles.theirMessageBubble}
                >
                  <Text style={dynamicStyles.messageText}>{item.content}</Text>
                </TouchableOpacity>
                {expandedMessageId === item.id && (
                  <Text style={[dynamicStyles.expandedTimestamp, styles.expandedTimestampLeft]}>
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
    <View style={dynamicStyles.container}>
      <StatusBar barStyle={isNewTheme ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      {isNewTheme && <GrainTexture opacity={0.06} />}
      <View style={dynamicStyles.header}>
        <TouchableOpacity onPress={handleMenuPress} style={styles.backButton}>
          <Ionicons name={showMenuButton ? "ellipsis-vertical" : "arrow-back"} size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.headerUserInfo}
          onPress={() => navigation?.navigate('UserProfile', { userId: partnerId })}
        >
          {otherUserProfile?.profile_picture ? (
            <Image
              source={{ uri: otherUserProfile.profile_picture }}
              style={dynamicStyles.headerAvatar}
            />
          ) : (
            <View style={dynamicStyles.headerAvatar}>
              <Text style={dynamicStyles.headerAvatarText}>
                {otherUserProfile?.name?.charAt(0).toUpperCase() ||
                 otherUserProfile?.email?.charAt(0).toUpperCase() || '?'}
              </Text>
            </View>
          )}
          <Text style={dynamicStyles.headerUserName}>
            {otherUserProfile?.name || 'User'}
          </Text>
        </TouchableOpacity>
        <View style={{ width: 24 }} />
      </View>

      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <FlatList
          ref={flatListRef}
          data={[...messages].reverse()}
          renderItem={({ item, index }) => renderMessage({ item, index: messages.length - 1 - index })}
          keyExtractor={(item) => item.id}
          contentContainerStyle={dynamicStyles.messagesList}
          inverted={true}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        />
      </View>

      <View style={dynamicStyles.inputContainer}>
        <TextInput
          style={dynamicStyles.input}
          placeholder="Type a message..."
          placeholderTextColor={colors.textTertiary}
          value={newMessage}
          onChangeText={setNewMessage}
          multiline
          spellCheck={true}
          autoCorrect={true}
        />
        <TouchableOpacity style={dynamicStyles.sendButton} onPress={handleSend}>
          <Ionicons name="send" size={24} color={isNewTheme ? colors.background : legacyColors.white} />
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
          style={dynamicStyles.optionsOverlay}
          activeOpacity={1}
          onPress={() => setShowOptionsMenu(false)}
        >
          <View style={dynamicStyles.optionsContainer}>
            <TouchableOpacity style={dynamicStyles.optionItem} onPress={handleSwitchChats}>
              <Ionicons name="chatbubbles-outline" size={22} color={colors.textPrimary} />
              <Text style={dynamicStyles.optionText}>Switch Chats</Text>
            </TouchableOpacity>
            {onDelete && (
              <TouchableOpacity style={dynamicStyles.optionItem} onPress={handleDeleteChat}>
                <Ionicons name="trash-outline" size={22} color={colors.error} />
                <Text style={dynamicStyles.optionTextDanger}>Delete Chat</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={dynamicStyles.optionCancel} onPress={() => setShowOptionsMenu(false)}>
              <Text style={dynamicStyles.optionCancelText}>Cancel</Text>
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
    borderColor: legacyColors.border,
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