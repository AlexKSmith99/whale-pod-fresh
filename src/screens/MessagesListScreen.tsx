import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { messageService } from '../services/messageService';
import { supabase } from '../config/supabase';

export default function MessagesListScreen({ navigation }: any) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadConversations();
    const interval = setInterval(loadConversations, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadConversations = async () => {
    try {
      if (user) {
        console.log('Loading conversations for user:', user.id);
        const data = await messageService.getConversations(user.id);
        console.log('Raw conversations data:', JSON.stringify(data, null, 2));

        const conversationsWithProfiles = await Promise.all(
          data.map(async (conversation: any) => {
            let partnerId = conversation.partnerId || conversation.partner_id;
            
            if (!partnerId && conversation.partnerEmail) {
              const { data: profileByEmail } = await supabase
                .from('profiles')
                .select('id')
                .eq('email', conversation.partnerEmail)
                .single();
              
              partnerId = profileByEmail?.id;
            }

            console.log('Partner ID:', partnerId);

            if (!partnerId) {
              console.error('Could not determine partnerId for conversation:', conversation);
              return {
                ...conversation,
                partnerProfile: null,
                partnerId: null,
              };
            }

            const { data: profileData, error } = await supabase
              .from('profiles')
              .select('name, profile_picture, email')
              .eq('id', partnerId)
              .single();

            if (error) {
              console.error('Error fetching profile:', error);
            }

            return {
              ...conversation,
              partnerProfile: profileData || { email: conversation.partnerEmail },
              partnerId: partnerId,
            };
          })
        );

        console.log('Conversations with profiles:', conversationsWithProfiles);
        setConversations(conversationsWithProfiles);
      }
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderConversation = ({ item }: any) => {
    if (!item.partnerId) {
      return null;
    }

    return (
      <TouchableOpacity
        style={styles.conversationCard}
        onPress={() => {
          console.log('Navigating to chat with:', item.partnerId);
          navigation.navigate('Chat', {
            partnerId: item.partnerId,
            partnerEmail: item.partnerProfile?.email || item.partnerEmail || 'User',
          });
        }}
      >
        {item.partnerProfile?.profile_picture ? (
          <Image
            source={{ uri: item.partnerProfile.profile_picture }}
            style={styles.avatar}
          />
        ) : (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {item.partnerProfile?.name?.charAt(0).toUpperCase() ||
               item.partnerProfile?.email?.charAt(0).toUpperCase() ||
               item.partnerEmail?.charAt(0).toUpperCase() || '?'}
            </Text>
          </View>
        )}
        <View style={styles.conversationInfo}>
          <Text style={styles.userName}>
            {item.partnerProfile?.name || 
             item.partnerProfile?.email?.split('@')[0] ||
             item.partnerEmail?.split('@')[0] || 'User'}
          </Text>
          <Text style={styles.lastMessage} numberOfLines={1}>
            {item.lastMessage || item.content || 'No message'}
          </Text>
        </View>
        <View style={styles.metaInfo}>
          <Text style={styles.timestamp}>
            {item.lastMessageTime || item.created_at 
              ? new Date(item.lastMessageTime || item.created_at).toLocaleDateString()
              : ''}
          </Text>
          {!item.isRead && <View style={styles.unreadBadge} />}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
      </View>

      <FlatList
        data={conversations.filter(c => c.partnerId)}
        keyExtractor={(item, index) => item.partnerId || `conversation-${index}`}
        renderItem={renderConversation}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubbles-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>
              {loading ? 'Loading...' : 'No messages yet'}
            </Text>
            <Text style={styles.emptySubtext}>
              Start a conversation with your team members
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 20,
    paddingTop: 50,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  list: {
    padding: 10,
  },
  conversationCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    alignItems: 'center',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#0ea5e9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  conversationInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  lastMessage: {
    fontSize: 14,
    color: '#666',
  },
  metaInfo: {
    alignItems: 'flex-end',
  },
  timestamp: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  unreadBadge: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#0ea5e9',
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
    textAlign: 'center',
  },
});