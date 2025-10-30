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

export default function UserProfileScreen({ route, navigation }: any) {
  const { userId } = route.params;
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Redirect to own profile if viewing yourself
    if (user && userId === user.id) {
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
    }
  };

  const handleConnect = async () => {
    try {
      if (user) {
        await connectionService.sendConnectionRequest(user.id, userId);
        Alert.alert('Success', 'Connection request sent!');
      }
    } catch (error) {
      console.error('Error sending connection request:', error);
      Alert.alert('Error', 'Failed to send connection request');
    }
  };

  const handleMessage = () => {
    navigation.navigate('Chat', {
      partnerId: userId,
      partnerEmail: profile?.email || 'User',
    });
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
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
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
        {!isConnected && (
          <TouchableOpacity style={styles.connectButton} onPress={handleConnect}>
            <Ionicons name="person-add" size={20} color="#fff" />
            <Text style={styles.connectButtonText}>Connect</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.messageButton} onPress={handleMessage}>
          <Ionicons name="chatbubble" size={20} color="#0ea5e9" />
          <Text style={styles.messageButtonText}>Message</Text>
        </TouchableOpacity>
      </View>

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