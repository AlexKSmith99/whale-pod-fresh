import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Image,
  Modal,
  Alert,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { podChatService, PodChatMessage } from '../services/podChatService';
import { supabase } from '../config/supabase';

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
      // Scroll to bottom after sending
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
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

  const renderMessage = ({ item }: { item: PodChatMessage }) => {
    const isMyMessage = item.sender_id === user?.id;
    const sender = item.sender;

    return (
      <View
        style={[
          styles.messageContainer,
          isMyMessage ? styles.myMessageContainer : styles.theirMessageContainer,
        ]}
      >
        {!isMyMessage && (
          <TouchableOpacity
            onPress={() => navigation?.navigate('UserProfile', { userId: item.sender_id })}
          >
            {sender?.profile_picture ? (
              <Image
                source={{ uri: sender.profile_picture }}
                style={styles.messageAvatar}
              />
            ) : (
              <View style={styles.messageAvatar}>
                <Text style={styles.messageAvatarText}>
                  {sender?.name?.charAt(0).toUpperCase() ||
                   sender?.email?.charAt(0).toUpperCase() || '?'}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        )}
        <View style={isMyMessage ? styles.myMessageContent : styles.theirMessageContent}>
          {!isMyMessage && (
            <Text style={styles.senderName}>
              {sender?.name || 'User'}
            </Text>
          )}
          <View
            style={[
              styles.messageBubble,
              isMyMessage ? styles.myMessageBubble : styles.theirMessageBubble,
            ]}
          >
            <Text style={[styles.messageText, isMyMessage && styles.myMessageText]}>
              {item.content}
            </Text>
            <Text style={[styles.timestamp, isMyMessage && styles.myTimestamp]}>
              {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        </View>
        {isMyMessage && (
          myProfile?.profile_picture ? (
            <Image
              source={{ uri: myProfile.profile_picture }}
              style={styles.messageAvatar}
            />
          ) : (
            <View style={styles.messageAvatar}>
              <Text style={styles.messageAvatarText}>
                {myProfile?.name?.charAt(0).toUpperCase() ||
                 myProfile?.email?.charAt(0).toUpperCase() || '?'}
              </Text>
            </View>
          )
        )}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 140 : 0}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleMenuPress} style={styles.backButton}>
          <Ionicons name={showMenuButton ? "ellipsis-vertical" : "arrow-back"} size={24} color="#333" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.headerInfo}
          onPress={() => setShowMembersModal(true)}
        >
          {podPicture ? (
            <Image source={{ uri: podPicture }} style={styles.groupImage} />
          ) : (
            <View style={styles.groupIcon}>
              <Ionicons name="people" size={20} color="#fff" />
            </View>
          )}
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {chatName}
            </Text>
            <Text style={styles.memberCount}>
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
          <Ionicons name="create-outline" size={20} color="#333" />
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubbles-outline" size={48} color="#ccc" />
            <Text style={styles.emptyText}>
              {loading ? 'Loading...' : 'No messages yet'}
            </Text>
            <Text style={styles.emptySubtext}>
              Start the conversation!
            </Text>
          </View>
        }
      />

      {/* Input */}
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

      {/* Members Modal */}
      <Modal
        visible={showMembersModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowMembersModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Pod Members</Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setShowMembersModal(false)}
              >
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={members}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.memberCard}
                  onPress={() => {
                    setShowMembersModal(false);
                    navigation?.navigate('UserProfile', { userId: item.id });
                  }}
                >
                  {item.profile_picture ? (
                    <Image source={{ uri: item.profile_picture }} style={styles.memberAvatar} />
                  ) : (
                    <View style={styles.memberAvatar}>
                      <Text style={styles.memberAvatarText}>
                        {item.name?.charAt(0).toUpperCase() || '?'}
                      </Text>
                    </View>
                  )}
                  <View style={styles.memberInfo}>
                    <Text style={styles.memberName}>{item.name || 'Team Member'}</Text>
                    {item.isCreator && (
                      <View style={styles.creatorBadge}>
                        <Text style={styles.creatorBadgeText}>Creator</Text>
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
        <View style={styles.modalOverlay}>
          <View style={styles.renameModalContainer}>
            <Text style={styles.renameModalTitle}>Rename Chat</Text>
            <TextInput
              style={styles.renameInput}
              value={tempChatName}
              onChangeText={setTempChatName}
              placeholder="Enter new chat name"
              autoFocus
            />
            <View style={styles.renameButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowRenameModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleRename}
              >
                <Text style={styles.saveButtonText}>Save</Text>
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
          style={styles.optionsOverlay}
          activeOpacity={1}
          onPress={() => setShowOptionsMenu(false)}
        >
          <View style={styles.optionsContainer}>
            <TouchableOpacity style={styles.optionItem} onPress={handleSwitchChats}>
              <Ionicons name="chatbubbles-outline" size={22} color="#333" />
              <Text style={styles.optionText}>Switch Chats</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.optionItem} onPress={handleRenameChat}>
              <Ionicons name="create-outline" size={22} color="#333" />
              <Text style={styles.optionText}>Rename Chat</Text>
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
    padding: 15,
    paddingBottom: 20,
  },
  messageContainer: {
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
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
  messageBubble: {
    maxWidth: '80%',
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
  },
  messageText: {
    fontSize: 15,
    color: '#333',
  },
  myMessageText: {
    color: '#fff',
  },
  timestamp: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
  },
  myTimestamp: {
    color: 'rgba(255, 255, 255, 0.7)',
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
