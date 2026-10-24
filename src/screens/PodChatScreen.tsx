import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { KeyboardStickyView } from '../components/ui/KeyboardAwareScreen';
import { useAuth } from '../contexts/AuthContext';
import PodMemberCollage from '../components/PodMemberCollage';
import { podChatService, PodChatMessage } from '../services/podChatService';
import { messageLikeService } from '../services/messageLikeService';
import { notificationService } from '../services/notificationService';
import { HapticManager } from '../services/hapticManager';
import { supabase } from '../config/supabase';
import { colors as legacyColors, editorial } from '../theme/designSystem';
import { useTheme } from '../theme/ThemeContext';
import { getThemedStyles } from '../theme/themedStyles';
import GrainTexture from '../components/ui/GrainTexture';
import { AppAlert } from '../components/ui/AppAlert';
import { displayName, initialOf } from '../utils/displayName';
import RollCallCard from '../components/chat/RollCallCard';
import CreateRollCallSheet from '../components/chat/CreateRollCallSheet';
import { rollCallService, RollCall, RollCallAnswer } from '../services/rollCallService';
import PursuitDetailScreen from './PursuitDetailScreen';
import TeamWorkspaceScreen from './team/TeamWorkspaceScreen';

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
  const styles = React.useMemo(() => makeStyles(colors, isNewTheme), [colors, isNewTheme]);
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
  const [activeView, setActiveView] = useState<'chat' | 'pod' | 'board'>('chat');
  const [pursuitData, setPursuitData] = useState<any>(null);
  const [myProfile, setMyProfile] = useState<any>(null);
  const [expandedMessageId, setExpandedMessageId] = useState<string | null>(null);
  const [likes, setLikes] = useState<Record<string, string[]>>({});
  const lastTapRef = useRef<Record<string, number>>({});
  // Roll calls, keyed by id, loaded alongside the messages that reference them
  // so the 3-second poll keeps the IN/OUT tallies current without its own timer.
  const [rollCalls, setRollCalls] = useState<Record<string, RollCall>>({});
  const [showRollCallSheet, setShowRollCallSheet] = useState(false);
  const [busyRollCallId, setBusyRollCallId] = useState<string | null>(null);

  // Update chatName when props change (e.g., when switching to a different chat)
  useEffect(() => {
    setChatName(customName || pursuitTitle);
  }, [customName, pursuitTitle]);

  // Fetch pursuit data when switching to pod detail view
  useEffect(() => {
    if (activeView === 'pod' && !pursuitData) {
      (async () => {
        const { data } = await supabase.from('pursuits').select('*').eq('id', pursuitId).single();
        if (data) setPursuitData(data);
      })();
    }
  }, [activeView, pursuitId]);

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
          .select('name, profile_picture')
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
      // Load likes for all messages
      if (data.length > 0) {
        const messageIds = data.map((m: PodChatMessage) => m.id);
        const likesData = await messageLikeService.getLikesForMessages(messageIds, 'pod');
        setLikes(likesData);
      }
      // Roll calls referenced by this stream. Batched rather than one fetch per
      // card, and refreshed on the same poll as the messages.
      const rollCallIds = data
        .filter((m: PodChatMessage) => m.kind === 'roll_call' && m.roll_call_id)
        .map((m: PodChatMessage) => m.roll_call_id as string);
      if (rollCallIds.length > 0 && user) {
        setRollCalls(await rollCallService.getMany(rollCallIds, user.id));
      }
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
      const senderName = displayName(myProfile, 'Someone');
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
      AppAlert.alert('Error', 'Failed to send message');
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
      // Keep native Alert: fires from the catch path while the Rename Modal is still visible
      // (showRenameModal is only closed on success), and a JS overlay can't render above a native Modal.
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

    if (isToday) {
      return 'Today';
    } else if (isYesterday) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
      });
    }
  };

  const handleToggleLike = useCallback(async (messageId: string) => {
    if (!user) return;
    try {
      const liked = await messageLikeService.toggleLike(messageId, 'pod', user.id);
      if (liked) {
        HapticManager.pulse(1);
      }
      setLikes(prev => {
        const updated = { ...prev };
        if (liked) {
          updated[messageId] = [...(updated[messageId] || []), user.id];
        } else {
          updated[messageId] = (updated[messageId] || []).filter(id => id !== user.id);
          if (updated[messageId].length === 0) delete updated[messageId];
        }
        return updated;
      });
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  }, [user]);

  const handleMessageTap = useCallback((messageId: string) => {
    const now = Date.now();
    const lastTap = lastTapRef.current[messageId] || 0;

    if (now - lastTap < 300) {
      // Double tap - toggle like
      handleToggleLike(messageId);
      lastTapRef.current[messageId] = 0;
    } else {
      // Single tap - toggle timestamp
      setExpandedMessageId(prev => prev === messageId ? null : messageId);
      lastTapRef.current[messageId] = now;
    }
  }, [handleToggleLike]);

  // --- roll call handlers ---------------------------------------------------
  const handleRollCallAnswer = async (rollCallId: string, answer: RollCallAnswer) => {
    if (!user) return;
    setBusyRollCallId(rollCallId);
    // Optimistic: the poll is up to 3 seconds away and a tap that does nothing
    // visible reads as broken.
    setRollCalls(prev => {
      const rc = prev[rollCallId];
      if (!rc) return prev;
      const others = rc.responders.filter(r => r.userId !== user.id);
      const mine = {
        userId: user.id,
        name: myProfile?.name || 'You',
        profilePicture: myProfile?.profile_picture ?? null,
        answer,
      };
      const responders = [...others, mine];
      return {
        ...prev,
        [rollCallId]: {
          ...rc,
          responders,
          myAnswer: answer,
          inCount: responders.filter(r => r.answer === 'in').length,
          outCount: responders.filter(r => r.answer === 'out').length,
          pendingCount: Math.max(0, rc.pendingCount - (rc.myAnswer ? 0 : 1)),
        },
      };
    });

    const ok = await rollCallService.respond(rollCallId, user.id, answer);
    setBusyRollCallId(null);
    // Reconcile either way — on failure this puts the card back.
    await loadMessages();
    if (!ok) AppAlert.alert('Could not save', 'Your answer did not go through. Try again.');
  };

  const handleCloseRollCall = (rollCallId: string) => {
    AppAlert.alert(
      'Close this roll call?',
      'Nobody will be able to answer or change their answer.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Close it',
          style: 'destructive',
          onPress: async () => {
            setBusyRollCallId(rollCallId);
            await rollCallService.close(rollCallId);
            setBusyRollCallId(null);
            await loadMessages();
          },
        },
      ]
    );
  };

  const handlePromoteRollCall = (rollCallId: string) => {
    const rc = rollCalls[rollCallId];
    if (!rc || !user) return;
    AppAlert.alert(
      'Add to the calendar?',
      `This creates a meeting at that time and marks the ${rc.inCount} who said they're in as attending.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Add it',
          onPress: async () => {
            setBusyRollCallId(rollCallId);
            const meetingId = await rollCallService.promoteToMeeting(rollCallId, user.id, {
              title: chatName,
            });
            setBusyRollCallId(null);
            await loadMessages();
            if (!meetingId) {
              AppAlert.alert('Could not add it', 'The meeting was not created. Try again.');
            }
          },
        },
      ]
    );
  };

  const renderRollCall = (item: PodChatMessage) => {
    const rc = item.roll_call_id ? rollCalls[item.roll_call_id] : undefined;
    if (!rc) {
      // Still loading, or it was deleted. Fall back to the plain-text version
      // stored on the message rather than showing a gap.
      return (
        <Text style={[styles.messageText, { color: colors.textTertiary, textAlign: 'center', marginVertical: 12, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>
          {item.content}
        </Text>
      );
    }
    return (
      <RollCallCard
        rollCall={rc}
        currentUserId={user?.id || ''}
        isPodCreator={pursuitData?.creator_id === user?.id}
        busy={busyRollCallId === rc.id}
        onAnswer={answer => handleRollCallAnswer(rc.id, answer)}
        onClose={() => handleCloseRollCall(rc.id)}
        onPromote={() => handlePromoteRollCall(rc.id)}
        onOpenMeeting={meetingId => navigation?.navigate('MeetingInvitation', { meetingId })}
      />
    );
  };

  const renderMessage = ({ item, index }: { item: PodChatMessage; index: number }) => {
    // Roll calls belong to the group, not to whoever posted them, so they get a
    // full-width card instead of a sender-aligned bubble.
    if (item.kind === 'roll_call') {
      const showSep = hasTimeGap(item.created_at, index > 0 ? messages[index - 1]?.created_at : null);
      return (
        <View>
          {showSep && (
            <View style={styles.timeSeparator}>
              <Text style={[styles.timeSeparatorText, { color: colors.textTertiary, backgroundColor: colors.surfaceAlt, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>
                {formatTimeSeparator(item.created_at)}
              </Text>
            </View>
          )}
          {renderRollCall(item)}
        </View>
      );
    }

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
            {initialOf(profile)}
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
            <Text style={[styles.timeSeparatorText, { color: colors.textTertiary, backgroundColor: colors.surfaceAlt, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>
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
                  <Text style={[styles.senderName, styles.mySenderName, { color: colors.textSecondary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'PlayfairDisplay_700Bold' }]}>
                    {myProfile?.name || 'You'}
                  </Text>
                )}
                <View style={styles.bubbleWrapper}>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => handleMessageTap(item.id)}
                    style={[styles.messageBubble, styles.myMessageBubble, { backgroundColor: isNewTheme ? colors.accentGreen : editorial.carolina }]}
                  >
                    <Text style={[styles.messageText, styles.myMessageText, { color: isNewTheme ? colors.background : '#fff', fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>{item.content}</Text>
                  </TouchableOpacity>
                  {likes[item.id] && likes[item.id].length > 0 && (
                    <View style={[styles.likeIndicator, styles.likeIndicatorRight]}>
                      <Text style={styles.likeHeart}>❤️</Text>
                      {likes[item.id].length > 1 && (
                        <Text style={[styles.likeCount, { color: colors.textSecondary }]}>{likes[item.id].length}</Text>
                      )}
                    </View>
                  )}
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
                  <Text style={[styles.senderName, { color: colors.textSecondary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'PlayfairDisplay_700Bold' }]}>
                    {displayName(sender)}
                  </Text>
                )}
                <View style={styles.bubbleWrapper}>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => handleMessageTap(item.id)}
                    style={[
                      styles.messageBubble,
                      styles.theirMessageBubble,
                      isNewTheme
                        ? { backgroundColor: '#161616', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.10)' }
                        : { backgroundColor: editorial.surface, borderWidth: 1, borderColor: editorial.hairline },
                    ]}
                  >
                    <Text style={[styles.messageText, { color: colors.textPrimary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>{item.content}</Text>
                  </TouchableOpacity>
                  {likes[item.id] && likes[item.id].length > 0 && (
                    <View style={[styles.likeIndicator, styles.likeIndicatorLeft]}>
                      <Text style={styles.likeHeart}>❤️</Text>
                      {likes[item.id].length > 1 && (
                        <Text style={[styles.likeCount, { color: colors.textSecondary }]}>{likes[item.id].length}</Text>
                      )}
                    </View>
                  )}
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
      <View style={{ backgroundColor: isNewTheme ? colors.surface : colors.background, paddingTop: 50, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12 }}>
          <TouchableOpacity onPress={onBack} style={{ padding: 4 }} activeOpacity={0.6} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.textPrimary, fontFamily: isNewTheme ? 'Sora_700Bold' : 'PlayfairDisplay_700Bold', letterSpacing: isNewTheme ? 0 : -0.3 }} numberOfLines={1}>
              {chatName}
            </Text>
            <Text style={{ fontSize: 12, color: colors.textTertiary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold', marginTop: 2 }}>
              {members.length} members
            </Text>
          </View>
          <TouchableOpacity onPress={() => setShowOptionsMenu(true)} style={{ padding: 4 }} activeOpacity={0.6} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="ellipsis-horizontal" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>
        {/* Tab bar: chat / pod detail / team board */}
        <View style={{ flexDirection: 'row', paddingHorizontal: 16 }}>
          {([
            { key: 'chat', label: 'chat' },
            { key: 'pod', label: 'pod detail' },
            { key: 'board', label: 'team board' },
          ] as const).map(tab => {
            const active = activeView === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                activeOpacity={0.6}
                style={{ flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: active ? colors.accentGreen : 'transparent' }}
                onPress={() => setActiveView(tab.key)}
              >
                <Text style={{ fontSize: 14, fontWeight: active ? '700' : '500', color: active ? colors.accentGreen : colors.textTertiary, fontFamily: isNewTheme ? (active ? 'Sora_700Bold' : 'Sora_500Medium') : 'InterTight_600SemiBold', letterSpacing: isNewTheme ? 0 : 0.3 }}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Chat view */}
      {activeView === 'chat' && (
        <>
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
                  <Text style={[styles.emptyText, { color: colors.textSecondary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>
                    {loading ? 'Loading...' : 'No messages yet'}
                  </Text>
                  <Text style={[styles.emptySubtext, { color: colors.textTertiary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>
                    Start the conversation!
                  </Text>
                </View>
              }
            />
          </View>
          {/* Composer rides the keyboard's top edge (inverted list keeps layout) */}
          <KeyboardStickyView>
            <View style={[styles.inputContainer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
              <TouchableOpacity
                style={[styles.rollCallButton, { borderColor: colors.border }]}
                activeOpacity={0.6}
                onPress={() => setShowRollCallSheet(true)}
                accessibilityRole="button"
                accessibilityLabel="Call a roll call"
              >
                <Ionicons name="hand-left-outline" size={19} color={isNewTheme ? colors.accentGreen : editorial.carolina} />
              </TouchableOpacity>
              <TextInput
                style={[styles.input, { borderWidth: isNewTheme ? 0 : 1, borderColor: colors.border, color: colors.textPrimary, backgroundColor: isNewTheme ? colors.background : editorial.surface, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}
                placeholder="Type a message..."
                placeholderTextColor={colors.textTertiary}
                value={newMessage}
                onChangeText={setNewMessage}
                multiline
                spellCheck={true}
                autoCorrect={true}
              />
              <TouchableOpacity style={[styles.sendButton, { backgroundColor: isNewTheme ? colors.accentGreen : editorial.carolina }]} activeOpacity={0.85} onPress={handleSend}>
                <Ionicons name="send" size={20} color={isNewTheme ? colors.background : '#fff'} />
              </TouchableOpacity>
            </View>
          </KeyboardStickyView>
        </>
      )}

      {/* Pod Detail view — rendered inline */}
      {activeView === 'pod' && pursuitData && (
        <PursuitDetailScreen
          pursuit={pursuitData}
          onBack={() => setActiveView('chat')}
          isOwner={pursuitData.creator_id === user?.id}
          onSendMessage={(userId, userName) => navigation?.navigate('Chat', { partnerId: userId, partnerName: userName })}
        />
      )}

      {/* Team Board view — rendered inline */}
      {activeView === 'board' && (
        <TeamWorkspaceScreen
          onBack={() => setActiveView('chat')}
          initialPursuitId={pursuitId}
        />
      )}

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
              <Text style={[styles.modalTitle, { color: colors.textPrimary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'PlayfairDisplay_700Bold' }]}>Pod Members</Text>
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
                  activeOpacity={0.6}
                  onPress={() => {
                    setShowMembersModal(false);
                    navigation?.navigate('UserProfile', { userId: item.id });
                  }}
                >
                  {item.profile_picture ? (
                    <Image source={{ uri: item.profile_picture }} style={styles.memberAvatar} />
                  ) : (
                    <View style={[styles.memberAvatar, { backgroundColor: isNewTheme ? colors.accentGreen : editorial.carolina }]}>
                      <Text style={[styles.memberAvatarText, { color: isNewTheme ? colors.background : '#fff' }]}>
                        {item.name?.charAt(0).toUpperCase() || '?'}
                      </Text>
                    </View>
                  )}
                  <View style={styles.memberInfo}>
                    <Text style={[styles.memberName, { color: colors.textPrimary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'PlayfairDisplay_700Bold' }]}>{item.name || 'Team Member'}</Text>
                    {item.isCreator && (
                      <View style={[styles.creatorBadge, { backgroundColor: isNewTheme ? colors.accentGreen : editorial.carolina }]}>
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

      {/* Roll Call creation sheet */}
      {user && (
        <CreateRollCallSheet
          visible={showRollCallSheet}
          pursuitId={pursuitId}
          currentUserId={user.id}
          onClose={() => setShowRollCallSheet(false)}
          onCreated={loadMessages}
        />
      )}

      {/* Rename Modal */}
      <Modal
        visible={showRenameModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowRenameModal(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: isNewTheme ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.5)' }]}>
          <View style={[styles.renameModalContainer, { backgroundColor: colors.surface }]}>
            <Text style={[styles.renameModalTitle, { color: colors.textPrimary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'PlayfairDisplay_700Bold' }]}>Rename Chat</Text>
            <TextInput
              style={[styles.renameInput, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.background, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}
              value={tempChatName}
              onChangeText={setTempChatName}
              placeholder="Enter new chat name"
              placeholderTextColor={colors.textTertiary}
              autoFocus
            />
            <View style={styles.renameButtons}>
              <TouchableOpacity
                style={[styles.cancelButton, { backgroundColor: colors.surfaceAlt }]}
                activeOpacity={0.6}
                onPress={() => setShowRenameModal(false)}
              >
                <Text style={[styles.cancelButtonText, { color: colors.textSecondary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, { backgroundColor: isNewTheme ? colors.accentGreen : editorial.carolina }]}
                activeOpacity={0.85}
                onPress={handleRename}
              >
                <Text style={[styles.saveButtonText, { color: isNewTheme ? colors.background : '#fff', fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>Save</Text>
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
              <Text style={[styles.optionText, { color: colors.textPrimary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>Switch Chats</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.optionItem} onPress={handleRenameChat}>
              <Ionicons name="create-outline" size={22} color={colors.textPrimary} />
              <Text style={[styles.optionText, { color: colors.textPrimary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>Rename Chat</Text>
            </TouchableOpacity>
            {onDelete && (
              <TouchableOpacity style={styles.optionItemDanger} onPress={handleDeleteChat}>
                <Ionicons name="trash-outline" size={22} color={colors.error} />
                <Text style={[styles.optionTextDanger, { color: colors.error, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>Delete Chat</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[styles.optionCancel, { borderTopColor: colors.border }]} onPress={() => setShowOptionsMenu(false)}>
              <Text style={[styles.optionCancelText, { color: colors.textSecondary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

function makeStyles(colors: any, isNewTheme: boolean) {
  const surfaceCard = colors.surface;
  // Both palettes define accentGreen (dark: lime #C8FF6B, light: Carolina
  // #4B9CD3), so no branch is needed. This previously read `accent` inside its
  // own initializer, which threw a TDZ ReferenceError on every light-theme render.
  const accent = colors.accentGreen;
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    paddingTop: 50,
    backgroundColor: surfaceCard,
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
    backgroundColor: accent,
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
    color: colors.textPrimary,
  },
  memberCount: {
    fontSize: 13,
    color: colors.textSecondary,
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
    backgroundColor: accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageAvatarText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: surfaceCard,
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
    color: colors.textSecondary,
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
    fontSize: 11,
    color: colors.textTertiary,
    backgroundColor: surfaceCard,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold',
  },
  avatarPlaceholder: {
    width: 32,
    height: 32,
  },
  bubbleWrapper: {
    maxWidth: '80%',
  },
  likeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isNewTheme ? colors.surfaceAlt : '#FFFFFF',
    borderWidth: isNewTheme ? StyleSheet.hairlineWidth : 0,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: -8,
    marginBottom: 4,
    alignSelf: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: isNewTheme ? 0 : 0.1,
    shadowRadius: 2,
    elevation: isNewTheme ? 0 : 2,
    gap: 2,
  },
  likeIndicatorRight: {
    alignSelf: 'flex-end',
    marginRight: 8,
  },
  likeIndicatorLeft: {
    alignSelf: 'flex-start',
    marginLeft: 8,
  },
  likeHeart: {
    fontSize: 12,
  },
  likeCount: {
    fontSize: 11,
    fontWeight: '600',
  },
  messageBubble: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  myMessageBubble: {
    backgroundColor: accent,
    borderBottomRightRadius: 4,
  },
  theirMessageBubble: {
    backgroundColor: surfaceCard,
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    color: colors.textPrimary,
  },
  myMessageText: {
    color: surfaceCard,
  },
  expandedTimestamp: {
    fontSize: 11,
    color: colors.textTertiary,
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
    padding: 12,
    // 92 in BOTH themes, not just dark. Pod chat renders inside
    // PursuitDetailScreen, which sits under AppRouter's viewingPodDetail branch
    // and still shows the floating tab bar — so the composer has to clear the
    // pill (bottom 16 + ~64 tall). Light mode's old 28 only cleared the home
    // indicator, leaving the input unreachable in editorial theme.
    paddingBottom: 92,
    backgroundColor: surfaceCard,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    alignItems: 'flex-end',
  },
  // Roll call entry point, left of the text field. Outline icon button in both
  // themes per the icon-button recipe — no filled circle.
  rollCallButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  input: {
    flex: 1,
    borderWidth: 0,
    backgroundColor: surfaceCard,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 10,
    maxHeight: 100,
    fontSize: 15,
    fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold',
    color: colors.textPrimary,
  },
  sendButton: {
    backgroundColor: accent,
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
    color: colors.textTertiary,
    marginTop: 20,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textTertiary,
    marginTop: 5,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: surfaceCard,
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
    color: colors.textPrimary,
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
    backgroundColor: accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberAvatarText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: surfaceCard,
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
    color: colors.textPrimary,
  },
  creatorBadge: {
    backgroundColor: accent,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  creatorBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: surfaceCard,
  },
  // Rename modal
  renameModalContainer: {
    backgroundColor: surfaceCard,
    marginHorizontal: 20,
    marginTop: 'auto',
    marginBottom: 'auto',
    borderRadius: 16,
    padding: 20,
  },
  renameModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
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
    color: colors.textSecondary,
  },
  saveButton: {
    flex: 1,
    backgroundColor: accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: surfaceCard,
  },
  // Options menu
  optionsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  optionsContainer: {
    backgroundColor: surfaceCard,
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
    color: colors.textPrimary,
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
    color: colors.textSecondary,
  },
  });
}
