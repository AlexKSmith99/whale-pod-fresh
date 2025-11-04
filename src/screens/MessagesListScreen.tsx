import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  StatusBar,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { messageService } from '../services/messageService';
import { supabase } from '../config/supabase';
import { colors, typography, spacing, borderRadius, shadows } from '../theme/designSystem';

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
        <TouchableOpacity
          onPress={(e) => {
            e.stopPropagation();
            navigation.navigate('UserProfile', { userId: item.partnerId });
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
        </TouchableOpacity>
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
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />

      {/* Modern Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerGreeting}>Your</Text>
            <Text style={styles.headerTitle}>Messages</Text>
          </View>
        </View>
      </View>

      <FlatList
        data={conversations.filter(c => c.partnerId)}
        keyExtractor={(item, index) => item.partnerId || `conversation-${index}`}
        renderItem={renderConversation}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={loadConversations}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconContainer}>
              <Ionicons name="chatbubbles-outline" size={48} color={colors.textTertiary} />
            </View>
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
    backgroundColor: colors.background,
  },

  // Header Styles
  header: {
    backgroundColor: colors.white,
    paddingTop: 50,
    paddingBottom: spacing.base,
    ...shadows.sm,
  },

  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },

  headerGreeting: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs,
  },

  headerTitle: {
    fontSize: typography.fontSize['3xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
  },

  // List Styles
  list: {
    padding: spacing.lg,
    paddingBottom: spacing['4xl'],
  },

  // Conversation Card
  conversationCard: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.base,
    alignItems: 'center',
    ...shadows.base,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },

  avatar: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },

  avatarText: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.white,
  },

  conversationInfo: {
    flex: 1,
  },

  userName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },

  lastMessage: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    lineHeight: typography.fontSize.sm * typography.lineHeight.normal,
  },

  metaInfo: {
    alignItems: 'flex-end',
  },

  timestamp: {
    fontSize: typography.fontSize.xs,
    color: colors.textTertiary,
    marginBottom: spacing.xs,
  },

  unreadBadge: {
    width: 10,
    height: 10,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
  },

  // Empty State
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing['5xl'],
    paddingHorizontal: spacing.lg,
  },

  emptyIconContainer: {
    width: 96,
    height: 96,
    borderRadius: borderRadius.full,
    backgroundColor: colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },

  emptyText: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },

  emptySubtext: {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});