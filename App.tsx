import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, TouchableOpacity, Text, StyleSheet, Alert } from 'react-native';
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
import TimeSlotProposalScreen from './src/screens/TimeSlotProposalScreen';
import CreatorTimeSelectionScreen from './src/screens/CreatorTimeSelectionScreen';
import EditPursuitScreen from './src/screens/EditPursuitScreen';
import NotificationBadge from './src/components/NotificationBadge';
import { notificationService } from './src/services/notificationService';

function AppContent() {
  const auth = useAuth();
  const [currentScreen, setCurrentScreen] = useState('Feed');
  const [chatPartnerId, setChatPartnerId] = useState<string | null>(null);
  const [chatPartnerEmail, setChatPartnerEmail] = useState<string | null>(null);
  const [teamBoardPursuitId, setTeamBoardPursuitId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);
  const [showConnections, setShowConnections] = useState(false);

  // Kickoff scheduling screens
  const [showTimeSlotProposal, setShowTimeSlotProposal] = useState(false);
  const [showCreatorTimeSelection, setShowCreatorTimeSelection] = useState(false);
  const [selectedPursuitForKickoff, setSelectedPursuitForKickoff] = useState<any>(null);

  // Edit pursuit screen
  const [showEditPursuit, setShowEditPursuit] = useState(false);
  const [selectedPursuitForEdit, setSelectedPursuitForEdit] = useState<any>(null);

  // Notification badge counts
  const [feedNotifications, setFeedNotifications] = useState(0);
  const [messagesNotifications, setMessagesNotifications] = useState(0);
  const [podsNotifications, setPodsNotifications] = useState(0);
  const [profileNotifications, setProfileNotifications] = useState(0);

  // Load notification counts
  const loadNotificationCounts = async () => {
    if (!auth.user?.id) return;

    try {
      const [feed, messages, pods, profile] = await Promise.all([
        notificationService.getFeedUnreadCount(auth.user.id).catch(() => 0),
        notificationService.getMessagesUnreadCount(auth.user.id).catch(() => 0),
        notificationService.getPodsUnreadCount(auth.user.id).catch(() => 0),
        notificationService.getProfileUnreadCount(auth.user.id).catch(() => 0),
      ]);

      setFeedNotifications(feed);
      setMessagesNotifications(messages);
      setPodsNotifications(pods);
      setProfileNotifications(profile);
    } catch (error: any) {
      // Silently fail - notifications table may not exist yet
      console.log('Notifications not available:', error?.message || 'Unknown error');
      setFeedNotifications(0);
      setMessagesNotifications(0);
      setPodsNotifications(0);
      setProfileNotifications(0);
    }
  };

  // Load notifications on mount and refresh every 30 seconds
  useEffect(() => {
    loadNotificationCounts();
    const interval = setInterval(loadNotificationCounts, 30000);
    return () => clearInterval(interval);
  }, [auth.user?.id]);

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

// Show chat screen if a conversation is selected (MOVED UP!)
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

// Show Team Board if a pursuit board is selected
if (teamBoardPursuitId) {
  return (
    <TeamBoardScreen
      pursuitId={teamBoardPursuitId}
      onBack={() => {
        setTeamBoardPursuitId(null);
      }}
      onViewProfile={openUserProfile}
    />
  );
}

// Show Connections screen
if (showConnections) {
  return <ConnectionsScreen navigation={navigation} />;
}

// Show User Profile screen
if (viewingUserId) {
  return (
    <UserProfileScreen
      route={{ params: { userId: viewingUserId } }}
      navigation={navigation}
    />
  );
}

  const startMessage = (userId: string, userEmail: string) => {
    setChatPartnerId(userId);
    setChatPartnerEmail(userEmail);
    setCurrentScreen('Messages');
  };

  const openUserProfile = (userId: string) => {
    setViewingUserId(userId);
  };

  const openTeamBoard = (pursuitId: string) => {
    setTeamBoardPursuitId(pursuitId);
  };

  const openTimeSlotProposal = (pursuit: any) => {
    setSelectedPursuitForKickoff(pursuit);
    setShowTimeSlotProposal(true);
  };

  const openCreatorTimeSelection = (pursuit: any) => {
    setSelectedPursuitForKickoff(pursuit);
    setShowCreatorTimeSelection(true);
  };

  const openEditPursuit = (pursuit: any) => {
    setSelectedPursuitForEdit(pursuit);
    setShowEditPursuit(true);
  };

  // Show Time Slot Proposal Screen
  if (showTimeSlotProposal && selectedPursuitForKickoff) {
    return (
      <TimeSlotProposalScreen
        pursuit={selectedPursuitForKickoff}
        onBack={() => {
          setShowTimeSlotProposal(false);
          setSelectedPursuitForKickoff(null);
          loadNotificationCounts(); // Refresh badges after submission
        }}
        onSubmitted={() => {
          setShowTimeSlotProposal(false);
          setSelectedPursuitForKickoff(null);
          loadNotificationCounts();
          Alert.alert(
            '✅ Success!',
            'Your time slot proposals have been submitted. The pursuit creator will select the best time and notify you.'
          );
        }}
      />
    );
  }

  // Show Creator Time Selection Screen
  if (showCreatorTimeSelection && selectedPursuitForKickoff) {
    return (
      <CreatorTimeSelectionScreen
        pursuit={selectedPursuitForKickoff}
        onBack={() => {
          setShowCreatorTimeSelection(false);
          setSelectedPursuitForKickoff(null);
        }}
        onScheduled={() => {
          setShowCreatorTimeSelection(false);
          setSelectedPursuitForKickoff(null);
          loadNotificationCounts();
          // Navigate to Pods tab to see the now-active pursuit
          setCurrentScreen('Pods');
        }}
      />
    );
  }

  // Show Edit Pursuit Screen
  if (showEditPursuit && selectedPursuitForEdit) {
    return (
      <EditPursuitScreen
        pursuit={selectedPursuitForEdit}
        onBack={() => {
          setShowEditPursuit(false);
          setSelectedPursuitForEdit(null);
        }}
        onUpdated={() => {
          setShowEditPursuit(false);
          setSelectedPursuitForEdit(null);
          loadNotificationCounts();
        }}
      />
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {currentScreen === 'Feed' && (
        <FeedScreen
          onStartMessage={startMessage}
          onOpenTeamBoard={openTeamBoard}
          onOpenCreate={() => setShowCreate(true)}
          onOpenCreatorTimeSelection={openCreatorTimeSelection}
          onEditPursuit={openEditPursuit}
          onViewProfile={openUserProfile}
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
          onOpenTeamBoard={openTeamBoard}
          onOpenTimeSlotProposal={openTimeSlotProposal}
          onOpenCreatorTimeSelection={openCreatorTimeSelection}
          onEditPursuit={openEditPursuit}
          onViewProfile={openUserProfile}
          onSendMessage={startMessage}
        />
      )}
      {currentScreen === 'Profile' && <ProfileScreen navigation={navigation} />}
      
      <View style={styles.tabBar}>
        <TouchableOpacity style={styles.tab} onPress={() => setCurrentScreen('Feed')}>
          <View>
            <Text style={[styles.tabText, currentScreen === 'Feed' && styles.tabTextActive]}>
              🏠 Feed
            </Text>
            <NotificationBadge show={feedNotifications > 0} />
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tab} onPress={() => setCurrentScreen('Messages')}>
          <View>
            <Text style={[styles.tabText, currentScreen === 'Messages' && styles.tabTextActive]}>
              💬 Messages
            </Text>
            <NotificationBadge show={messagesNotifications > 0} />
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tab} onPress={() => setCurrentScreen('Pods')}>
          <View>
            <Text style={[styles.tabText, currentScreen === 'Pods' && styles.tabTextActive]}>
              🐋 My Pods
            </Text>
            <NotificationBadge show={podsNotifications > 0} />
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tab} onPress={() => setCurrentScreen('Profile')}>
          <View>
            <Text style={[styles.tabText, currentScreen === 'Profile' && styles.tabTextActive]}>
              👤 Profile
            </Text>
            <NotificationBadge show={profileNotifications > 0} />
          </View>
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