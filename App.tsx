import React, { useState } from 'react';
import { View, ActivityIndicator, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import LoginScreen from './src/screens/LoginScreen';
import FeedScreen from './src/screens/FeedScreen';
import CreateScreen from './src/screens/CreateScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import UserProfileScreen from './src/screens/UserProfileScreen';
import MessagesListScreen from './src/screens/MessagesListScreen';
import ChatScreen from './src/screens/ChatScreen';
import TeamBoardScreen from './src/screens/team/TeamBoardScreen';
import PodsScreen from './src/screens/PodsScreen';
import ConnectionsScreen from './src/screens/connections/ConnectionsScreen';
import PursuitDetailScreen from './src/screens/PursuitDetailScreen';
// VideoCallScreen temporarily disabled for web - requires native modules
// import VideoCallScreen from './src/screens/VideoCallScreen';

function AppContent() {
  const auth = useAuth();
  const [currentScreen, setCurrentScreen] = useState('Feed');
  const [chatPartnerId, setChatPartnerId] = useState<string | null>(null);
  const [chatPartnerEmail, setChatPartnerEmail] = useState<string | null>(null);
  const [teamBoardPursuitId, setTeamBoardPursuitId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);
  const [showConnections, setShowConnections] = useState(false);
  const [viewingPodDetail, setViewingPodDetail] = useState<any | null>(null);
  const [videoCallChannel, setVideoCallChannel] = useState<string | null>(null);
  const [videoCallPodTitle, setVideoCallPodTitle] = useState<string>('');

  if (auth.loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#0ea5e9" />
      </View>
    );
  }

  if (!auth.user) {
    return <LoginScreen />;
  }

  // Navigation object to pass to screens
  const navigation = {
    navigate: (screen: string, params?: any) => {
      if (screen === 'UserProfile' && params?.userId) {
        setViewingUserId(params.userId);
        // Don't clear chat state - when going back, user returns to chat
      } else if (screen === 'Connections') {
        setShowConnections(true);
      } else if (screen === 'Chat' && params?.partnerId) {
        setChatPartnerId(params.partnerId);
        setChatPartnerEmail(params.partnerEmail || 'User');
      } else if (screen === 'Profile') {
        setCurrentScreen('Profile');
        setViewingUserId(null);
      }
    },
    goBack: () => {
      setViewingUserId(null);
      setShowConnections(false);
      // Chat state preserved - if returning from profile, chat will show again
    },
    replace: (screen: string) => {
      if (screen === 'Profile') {
        setCurrentScreen('Profile');
        setViewingUserId(null);
      }
    },
  };

  // Show Create screen as modal
if (showCreate) {
  return (
    <View style={{ flex: 1 }}>
      <CreateScreen />
      <TouchableOpacity 
        style={styles.closeCreateButton}
        onPress={() => setShowCreate(false)}
      >
        <Text style={styles.closeCreateText}>✕ Close</Text>
      </TouchableOpacity>
    </View>
  );
}

// Video calls temporarily disabled for web development
// Requires native modules (Agora) that don't work on web
// Will be re-enabled for iOS/Android builds
/*
if (videoCallChannel) {
  const agoraAppId = process.env.EXPO_PUBLIC_AGORA_APP_ID || '';
  if (!agoraAppId || agoraAppId === 'your_agora_app_id_here') {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <Text style={{ fontSize: 18, textAlign: 'center', marginBottom: 20 }}>
          ⚠️ Agora App ID not configured
        </Text>
        <Text style={{ textAlign: 'center', color: '#666', marginBottom: 20 }}>
          Please add your Agora App ID to the .env file
        </Text>
        <TouchableOpacity
          style={{ backgroundColor: '#8b5cf6', padding: 15, borderRadius: 8 }}
          onPress={() => setVideoCallChannel(null)}
        >
          <Text style={{ color: '#fff', fontWeight: 'bold' }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <VideoCallScreen
      channelName={videoCallChannel}
      podTitle={videoCallPodTitle}
      agoraAppId={agoraAppId}
      onEndCall={() => {
        setVideoCallChannel(null);
        setVideoCallPodTitle('');
      }}
    />
  );
}
*/

// Show User Profile screen (before chat so it takes priority when clicked from chat)
if (viewingUserId) {
  return (
    <UserProfileScreen
      route={{ params: { userId: viewingUserId } }}
      navigation={navigation}
    />
  );
}

// Show Connections screen
if (showConnections) {
  return <ConnectionsScreen navigation={navigation} />;
}

// Show chat screen if a conversation is selected
if (chatPartnerId && chatPartnerEmail) {
  return (
    <ChatScreen
      partnerId={chatPartnerId}
      partnerEmail={chatPartnerEmail}
      navigation={navigation}
      onBack={() => {
        setChatPartnerId(null);
        setChatPartnerEmail(null);
      }}
    />
  );
}

// Show Pod Detail Screen if viewing from Pods tab
if (viewingPodDetail) {
  return (
    <PursuitDetailScreen
      pursuit={viewingPodDetail}
      onBack={() => {
        setViewingPodDetail(null);
      }}
      isOwner={viewingPodDetail.creator_id === auth.user?.id || viewingPodDetail.is_creator}
      onOpenTeamBoard={(pursuitId) => {
        setViewingPodDetail(null);
        setTeamBoardPursuitId(pursuitId);
      }}
      onSendMessage={(userId, userEmail) => {
        setViewingPodDetail(null);
        setChatPartnerId(userId);
        setChatPartnerEmail(userEmail);
        setCurrentScreen('Messages');
      }}
    />
  );
}

// Show Team Board if a pursuit board is selected
if (teamBoardPursuitId) {
  return (
    <TeamBoardScreen
      pursuitId={teamBoardPursuitId}
      onBack={() => {
        setTeamBoardPursuitId(null);
      }}
      // onStartVideoCall disabled for web - requires native Agora SDK
      // onStartVideoCall={(channelName, podTitle) => {
      //   setVideoCallChannel(channelName);
      //   setVideoCallPodTitle(podTitle);
      // }}
    />
  );
}

  const startMessage = (userId: string, userEmail: string) => {
    setChatPartnerId(userId);
    setChatPartnerEmail(userEmail);
    setCurrentScreen('Messages');
  };

  const openTeamBoard = (pursuitId: string) => {
    setTeamBoardPursuitId(pursuitId);
  };

  return (
    <View style={{ flex: 1 }}>
      {currentScreen === 'Feed' && (
        <FeedScreen 
          onStartMessage={startMessage} 
          onOpenTeamBoard={openTeamBoard}
          onOpenCreate={() => setShowCreate(true)}
        />
      )}
      {currentScreen === 'Messages' && (
  <MessagesListScreen
    navigation={navigation}
    onSelectConversation={(partnerId: string, partnerEmail: string) => {
      setChatPartnerId(partnerId);
      setChatPartnerEmail(partnerEmail);
    }}
  />
)}
      {currentScreen === 'Pods' && (
        <PodsScreen
          onOpenPodDetails={(pod) => setViewingPodDetail(pod)}
          onOpenTeamBoard={openTeamBoard}
        />
      )}
      {currentScreen === 'Profile' && <ProfileScreen navigation={navigation} />}
      
      <View style={styles.tabBar}>
        <TouchableOpacity style={styles.tab} onPress={() => setCurrentScreen('Feed')}>
          <Text style={[styles.tabText, currentScreen === 'Feed' && styles.tabTextActive]}>
            🏠 Feed
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tab} onPress={() => setCurrentScreen('Messages')}>
          <Text style={[styles.tabText, currentScreen === 'Messages' && styles.tabTextActive]}>
            💬 Messages
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tab} onPress={() => setCurrentScreen('Pods')}>
          <Text style={[styles.tabText, currentScreen === 'Pods' && styles.tabTextActive]}>
            🐋 Pods
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tab} onPress={() => setCurrentScreen('Profile')}>
          <Text style={[styles.tabText, currentScreen === 'Profile' && styles.tabTextActive]}>
            👤 Profile
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingBottom: 20,
    paddingTop: 10,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
  },
  tabText: {
    fontSize: 14,
    color: '#999',
  },
  tabTextActive: {
    color: '#0ea5e9',
    fontWeight: 'bold',
  },
  closeCreateButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    backgroundColor: '#ef4444',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    zIndex: 1000,
  },
  closeCreateText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
      <StatusBar style="auto" />
    </AuthProvider>
  );
}