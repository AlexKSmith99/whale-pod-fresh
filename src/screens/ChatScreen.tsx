import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { messageService } from '../services/messageService';
import { supabase } from '../config/supabase';

interface Props {
  partnerId: string;
  partnerEmail: string;
  onBack: () => void;
  navigation?: any;
}

export default function ChatScreen({ partnerId, partnerEmail, onBack, navigation }: Props) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [otherUserProfile, setOtherUserProfile] = useState<any>(null);
  const [myProfile, setMyProfile] = useState<any>(null);

  useEffect(() => {
    loadUserProfile();
    loadMyProfile();
    loadMessages();
    const interval = setInterval(loadMessages, 3000);
    return () => clearInterval(interval);
  }, []);

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

  const handleSend = async () => {
    if (!newMessage.trim() || !user) return;

    const messageText = newMessage.trim();
    setNewMessage('');

    try {
      await messageService.sendMessage(user.id, partnerId, messageText);
      await loadMessages();
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const renderMessage = ({ item }: any) => {
    const isMyMessage = item.sender_id === user?.id;

    return (
      <View
        style={[
          styles.messageContainer,
          isMyMessage ? styles.myMessageContainer : styles.theirMessageContainer,
        ]}
      >
        {isMyMessage ? (
          <>
            <View
              style={[
                styles.messageBubble,
                styles.myMessageBubble,
              ]}
            >
              <Text style={styles.messageText}>{item.content}</Text>
              <Text style={styles.timestamp}>
                {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
            <View>
              {myProfile?.profile_picture ? (
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
              )}
            </View>
          </>
        ) : (
          <>
            <TouchableOpacity
              onPress={() => navigation?.navigate('UserProfile', { userId: partnerId })}
            >
              {otherUserProfile?.profile_picture ? (
                <Image
                  source={{ uri: otherUserProfile.profile_picture }}
                  style={styles.messageAvatar}
                />
              ) : (
                <View style={styles.messageAvatar}>
                  <Text style={styles.messageAvatarText}>
                    {otherUserProfile?.name?.charAt(0).toUpperCase() ||
                     otherUserProfile?.email?.charAt(0).toUpperCase() || '?'}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            <View
              style={[
                styles.messageBubble,
                styles.theirMessageBubble,
              ]}
            >
              <Text style={styles.messageText}>{item.content}</Text>
              <Text style={styles.timestamp}>
                {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          </>
        )}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
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
            {otherUserProfile?.name || otherUserProfile?.email?.split('@')[0] || 'User'}
          </Text>
        </TouchableOpacity>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesList}
        inverted={false}
      />

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Type a message..."
          value={newMessage}
          onChangeText={setNewMessage}
          multiline
        />
        <TouchableOpacity style={styles.sendButton} onPress={handleSend}>
          <Ionicons name="send" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
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
    padding: 15,
  },
  messageContainer: {
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
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
    maxWidth: '75%',
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
  },
  messageText: {
    fontSize: 15,
    color: '#333',
  },
  timestamp: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
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
});