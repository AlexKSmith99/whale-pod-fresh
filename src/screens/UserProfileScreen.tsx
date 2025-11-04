import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../config/supabase';
import { useAuth } from '../contexts/AuthContext';
import { connectionService } from '../services/connectionService';

interface Props {
  // React Navigation pattern
  route?: { params: { userId: string } };
  navigation?: any;
  // Direct props pattern (from PursuitDetailScreen)
  userId?: string;
  userEmail?: string;
  onBack?: () => void;
  onSendMessage?: (userId: string, userEmail: string) => void;
}

export default function UserProfileScreen({ route, navigation, userId: propUserId, userEmail, onBack, onSendMessage }: Props) {
  // Support both patterns: route.params.userId OR direct userId prop
  const userId = route?.params?.userId || propUserId;
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [pendingRequest, setPendingRequest] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      console.error('No userId provided to UserProfileScreen');
      return;
    }

    // Redirect to own profile if viewing yourself (only when using navigation)
    if (user && userId === user.id && navigation) {
      navigation.replace('Profile');
      return;
    }

    loadProfile();
    checkConnection();
  }, [userId, user]);

  const loadProfile = async () => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      setProfile(data);
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkConnection = async () => {
    if (user) {
      const connected = await connectionService.areConnected(user.id, userId);
      setIsConnected(connected);

      // Check for pending connection request from current user to this user
      if (!connected) {
        const { data } = await supabase
          .from('connections')
          .select('*')
          .eq('user_id_1', user.id)
          .eq('user_id_2', userId)
          .eq('status', 'pending')
          .maybeSingle();

        setPendingRequest(!!data);
      }
    }
  };

  const handleConnect = async () => {
    try {
      if (user) {
        await connectionService.sendConnectionRequest(user.id, userId);
        setPendingRequest(true);
        Alert.alert('Success', 'Connection request sent!');
      }
    } catch (error) {
      console.error('Error sending connection request:', error);
      Alert.alert('Error', 'Failed to send connection request');
    }
  };

  const handleMessage = () => {
    if (onSendMessage && userId) {
      // Direct props pattern - call the provided callback
      onSendMessage(userId, profile?.email || userEmail || 'User');
    } else if (navigation) {
      // Navigation pattern - navigate to Chat screen
      navigation.navigate('Chat', {
        partnerId: userId,
        partnerEmail: profile?.email || 'User',
      });
    }
  };

  const handleBack = () => {
    if (onBack) {
      // Direct props pattern
      onBack();
    } else if (navigation) {
      // Navigation pattern
      navigation.goBack();
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      <View style={styles.profileSection}>
        {profile?.profile_picture ? (
          <Image source={{ uri: profile.profile_picture }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarText}>
              {profile?.name?.charAt(0).toUpperCase() || '?'}
            </Text>
          </View>
        )}

        <Text style={styles.name}>
          {profile?.name || 'Name not set'}
        </Text>
        <Text style={styles.email}>{profile?.email}</Text>

        {profile?.bio && <Text style={styles.bio}>{profile.bio}</Text>}
      </View>

      <View style={styles.actionButtons}>
        {!isConnected && !pendingRequest && (
          <TouchableOpacity style={styles.connectButton} onPress={handleConnect}>
            <Ionicons name="person-add" size={20} color="#fff" />
            <Text style={styles.connectButtonText}>Connect</Text>
          </TouchableOpacity>
        )}
        {!isConnected && pendingRequest && (
          <View style={styles.connectButtonPending}>
            <Ionicons name="checkmark-circle" size={20} color="#6b7280" />
            <Text style={styles.connectButtonPendingText}>Request Sent</Text>
          </View>
        )}
        <TouchableOpacity style={styles.messageButton} onPress={handleMessage}>
          <Ionicons name="chatbubble" size={20} color="#0ea5e9" />
          <Text style={styles.messageButtonText}>Message</Text>
        </TouchableOpacity>
      </View>

      {/* Basic Info */}
      {(profile?.age || profile?.gender || profile?.hometown) && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Basic Info</Text>
          {profile?.age && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Age:</Text>
              <Text style={styles.infoValue}>{profile.age}</Text>
            </View>
          )}
          {profile?.gender && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Gender:</Text>
              <Text style={styles.infoValue}>{profile.gender}</Text>
            </View>
          )}
          {profile?.hometown && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Hometown:</Text>
              <Text style={styles.infoValue}>{profile.hometown}</Text>
            </View>
          )}
        </View>
      )}

      {/* Social Links */}
      {(profile?.linkedin || profile?.instagram || profile?.github || profile?.portfolio_website) && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Links</Text>
          {profile?.linkedin && (
            <View style={styles.linkItem}>
              <Ionicons name="logo-linkedin" size={20} color="#0077b5" />
              <Text style={styles.linkText}>LinkedIn</Text>
            </View>
          )}
          {profile?.instagram && (
            <View style={styles.linkItem}>
              <Ionicons name="logo-instagram" size={20} color="#e4405f" />
              <Text style={styles.linkText}>Instagram</Text>
            </View>
          )}
          {profile?.github && (
            <View style={styles.linkItem}>
              <Ionicons name="logo-github" size={20} color="#333" />
              <Text style={styles.linkText}>GitHub</Text>
            </View>
          )}
          {profile?.portfolio_website && (
            <View style={styles.linkItem}>
              <Ionicons name="globe-outline" size={20} color="#0ea5e9" />
              <Text style={styles.linkText}>Portfolio</Text>
            </View>
          )}
        </View>
      )}
    </ScrollView>
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
  },
  header: {
    padding: 20,
    paddingTop: 50,
    backgroundColor: '#fff',
  },
  backButton: {
    padding: 4,
  },
  profileSection: {
    backgroundColor: '#fff',
    alignItems: 'center',
    padding: 30,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#0ea5e9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#fff',
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
  },
  email: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  bio: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 20,
  },
  actionButtons: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
  },
  connectButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#0ea5e9',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  connectButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  connectButtonPending: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  connectButtonPendingText: {
    color: '#6b7280',
    fontSize: 16,
    fontWeight: '600',
  },
  messageButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#0ea5e9',
  },
  messageButtonText: {
    color: '#0ea5e9',
    fontSize: 16,
    fontWeight: '600',
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 10,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
    width: 100,
  },
  infoValue: {
    fontSize: 14,
    color: '#1f2937',
    flex: 1,
  },
  linkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  linkText: {
    fontSize: 15,
    color: '#333',
    marginLeft: 12,
  },
});