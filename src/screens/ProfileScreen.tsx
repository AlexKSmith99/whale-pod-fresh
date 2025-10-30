import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Linking, Image, Alert } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../config/supabase';
import { connectionService } from '../services/connectionService';
import { reviewService } from '../services/reviewService';
import EditProfileScreen from './EditProfileScreen';
import ReviewScreen from './ReviewScreen';

export default function ProfileScreen({ navigation }: any) {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [activeTeams, setActiveTeams] = useState<any[]>([]);
  const [pendingApplications, setPendingApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
const [activeTab, setActiveTab] = useState<'info' | 'received' | 'give' | 'connections'>('info');
const [connections, setConnections] = useState<any[]>([]);
const [pendingRequests, setPendingRequests] = useState<any[]>([]);
const [reviews, setReviews] = useState<any[]>([]);
const [averageRatings, setAverageRatings] = useState<any>(null);
const [reviewableTeammates, setReviewableTeammates] = useState<any[]>([]);
const [showReviewScreen, setShowReviewScreen] = useState(false);
const [selectedReviewee, setSelectedReviewee] = useState<any>(null);

  useEffect(() => {
  loadProfile();
  loadActiveTeams();
  loadPendingApplications();
  loadReviews();
  loadReviewableTeammates();
  loadConnections();
}, []);

  const loadProfile = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadActiveTeams = async () => {
    if (!user) return;

    try {
      // Get pursuits where user is creator or member
      const { data: createdPursuits } = await supabase
        .from('pursuits')
        .select('id, title, status')
        .eq('creator_id', user.id);

      const { data: memberships } = await supabase
        .from('team_members')
        .select('pursuit_id')
        .eq('user_id', user.id);

      const memberPursuitIds = memberships?.map(m => m.pursuit_id) || [];
      
      let memberPursuits = [];
      if (memberPursuitIds.length > 0) {
        const { data } = await supabase
          .from('pursuits')
          .select('id, title, status')
          .in('id', memberPursuitIds);
        memberPursuits = data || [];
      }

      const allTeams = [...(createdPursuits || []), ...memberPursuits];
      setActiveTeams(allTeams);
    } catch (error) {
      console.error('Error loading teams:', error);
    }
  };

  const loadPendingApplications = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('pursuit_applications')
        .select('*, pursuits(id, title)')
        .eq('applicant_id', user.id)
        .eq('status', 'pending');

      if (error) throw error;
      setPendingApplications(data || []);
    } catch (error) {
      console.error('Error loading applications:', error);
    }
  };

const loadReviews = async () => {
  if (!user) return;
  try {
    const [reviewsData, ratingsData] = await Promise.all([
      reviewService.getReviewsForUser(user.id),
      reviewService.getAverageRatings(user.id),
    ]);
    setReviews(reviewsData);
    setAverageRatings(ratingsData);
  } catch (error) {
    console.error('Error loading reviews:', error);
  }
};

const loadReviewableTeammates = async () => {
  if (!user) return;
  try {
    // Get all pursuits where user was a team member (active or closed)
    const { data: userTeams, error: teamsError } = await supabase
      .from('team_members')
      .select('pursuit_id, pursuits(id, title, status)')
      .eq('user_id', user.id);

    if (teamsError) throw teamsError;

    // Filter for active or closed pursuits
    const activeOrClosedPursuits = (userTeams || [])
      .filter(
        (t: any) =>
          t.pursuits?.status === 'active' || t.pursuits?.status === 'closed'
      )
      .map((t: any) => t.pursuit_id);

    if (activeOrClosedPursuits.length === 0) {
      setReviewableTeammates([]);
      return;
    }

    // Get all teammates from those pursuits
    const { data: teammates, error: teammatesError } = await supabase
      .from('team_members')
      .select('user_id, pursuit_id, pursuits(title), profiles(name, profile_picture)')
      .in('pursuit_id', activeOrClosedPursuits)
      .neq('user_id', user.id);

    if (teammatesError) throw teammatesError;

    // Check which ones haven't been reviewed yet
    const reviewableList = [];
    for (const teammate of teammates || []) {
      const hasReviewed = await reviewService.hasReviewed(
        user.id,
        teammate.user_id,
        teammate.pursuit_id
      );
      if (!hasReviewed) {
        reviewableList.push({
          userId: teammate.user_id,
          userName: teammate.profiles?.name || 'Unknown',
          userPicture: teammate.profiles?.profile_picture,
          pursuitId: teammate.pursuit_id,
          pursuitTitle: teammate.pursuits?.title || 'Unknown Pursuit',
        });
      }
    }

    setReviewableTeammates(reviewableList);
  } catch (error) {
    console.error('Error loading reviewable teammates:', error);
  }
};

const loadConnections = async () => {
  if (!user) return;
  try {
    const [conns, pending] = await Promise.all([
      connectionService.getMyConnections(user.id),
      connectionService.getPendingRequests(user.id),
    ]);
    setConnections(conns);
    setPendingRequests(pending);
  } catch (error) {
    console.error('Error loading connections:', error);
  }
};

const handleAcceptConnection = async (connectionId: string) => {
  try {
    await connectionService.acceptConnection(connectionId);
    loadConnections();
  } catch (error: any) {
    Alert.alert('Error', error.message);
  }
};

const handleRejectConnection = async (connectionId: string) => {
  try {
    await connectionService.rejectConnection(connectionId);
    loadConnections();
  } catch (error: any) {
    Alert.alert('Error', error.message);
  }
};

  const handleOpenLink = (url: string) => {
    if (!url) return;
    
    let fullUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      fullUrl = 'https://' + url;
    }
    
    Linking.openURL(fullUrl);
  };

  if (showEdit) {
    return (
      <EditProfileScreen 
        onBack={() => {
          setShowEdit(false);
          loadProfile();
        }} 
      />
    );
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0ea5e9" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Profile</Text>
        <TouchableOpacity onPress={() => setShowEdit(true)} style={styles.editButton}>
          <Text style={styles.editButtonText}>Edit</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={styles.avatarContainer}>
          {profile?.profile_picture ? (
            <Image source={{ uri: profile.profile_picture }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {profile?.name?.charAt(0).toUpperCase() || profile?.email?.charAt(0).toUpperCase() || '?'}
              </Text>
            </View>
          )}
          <Text style={styles.name}>{profile?.name || 'No name set'}</Text>
          <Text style={styles.email}>{profile?.email}</Text>
        </View>
{/* Tabs */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[styles.profileTab, activeTab === 'info' && styles.profileTabActive]}
            onPress={() => setActiveTab('info')}
          >
            <Text style={[styles.profileTabText, activeTab === 'info' && styles.profileTabTextActive]}>
              Info
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.profileTab, activeTab === 'received' && styles.profileTabActive]}
            onPress={() => setActiveTab('received')}
          >
            <Text style={[styles.profileTabText, activeTab === 'received' && styles.profileTabTextActive]}>
              Reviews ({reviews.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.profileTab, activeTab === 'give' && styles.profileTabActive]}
            onPress={() => setActiveTab('give')}
          >
            <Text style={[styles.profileTabText, activeTab === 'give' && styles.profileTabTextActive]}>
              Give Review
            </Text>
          </TouchableOpacity>
<TouchableOpacity
            style={[styles.profileTab, activeTab === 'connections' && styles.profileTabActive]}
            onPress={() => setActiveTab('connections')}
          >
            <Text style={[styles.profileTabText, activeTab === 'connections' && styles.profileTabTextActive]}>
              Connections ({connections.length})
            </Text>
          </TouchableOpacity>
        </View>

{activeTab === 'info' && (
          <>      
{activeTeams.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Active Teams ({activeTeams.length})</Text>
            {activeTeams.map((team) => (
              <View key={team.id} style={styles.teamRow}>
                <Text style={styles.teamTitle}>{team.title}</Text>
                <View style={[
                  styles.teamStatus,
                  team.status === 'active' ? styles.statusActive : styles.statusPending
                ]}>
                  <Text style={styles.teamStatusText}>
                    {team.status === 'active' ? 'Active' : 'Awaiting Kickoff'}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {pendingApplications.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pending Applications ({pendingApplications.length})</Text>
            {pendingApplications.map((app) => (
              <View key={app.id} style={styles.applicationRow}>
                <Text style={styles.applicationTitle}>{app.pursuits?.title}</Text>
                <View style={styles.pendingBadge}>
                  <Text style={styles.pendingText}>Pending</Text>
                </View>
              </View>
            ))}
          </View>
        )}

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

        {profile?.bio && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Bio</Text>
            <Text style={styles.bioText}>{profile.bio}</Text>
          </View>
        )}

        {(profile?.instagram || profile?.linkedin || profile?.facebook || profile?.github || profile?.portfolio_website) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Social Links</Text>
            {profile?.instagram && (
              <TouchableOpacity style={styles.linkRow} onPress={() => handleOpenLink(profile.instagram)}>
                <Text style={styles.linkIcon}>📷</Text>
                <Text style={styles.linkText}>Instagram</Text>
                <Text style={styles.linkArrow}>→</Text>
              </TouchableOpacity>
            )}
            {profile?.linkedin && (
              <TouchableOpacity style={styles.linkRow} onPress={() => handleOpenLink(profile.linkedin)}>
                <Text style={styles.linkIcon}>💼</Text>
                <Text style={styles.linkText}>LinkedIn</Text>
                <Text style={styles.linkArrow}>→</Text>
              </TouchableOpacity>
            )}
            {profile?.facebook && (
              <TouchableOpacity style={styles.linkRow} onPress={() => handleOpenLink(profile.facebook)}>
                <Text style={styles.linkIcon}>👤</Text>
                <Text style={styles.linkText}>Facebook</Text>
                <Text style={styles.linkArrow}>→</Text>
              </TouchableOpacity>
            )}
            {profile?.github && (
              <TouchableOpacity style={styles.linkRow} onPress={() => handleOpenLink(profile.github)}>
                <Text style={styles.linkIcon}>💻</Text>
                <Text style={styles.linkText}>GitHub</Text>
                <Text style={styles.linkArrow}>→</Text>
              </TouchableOpacity>
            )}
            {profile?.portfolio_website && (
              <TouchableOpacity style={styles.linkRow} onPress={() => handleOpenLink(profile.portfolio_website)}>
                <Text style={styles.linkIcon}>🌐</Text>
                <Text style={styles.linkText}>Portfolio</Text>
                <Text style={styles.linkArrow}>→</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

  {/* Calendar Integration */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📅 Calendar Integration</Text>
          <View style={styles.calendarRow}>
            <View style={styles.calendarInfo}>
              <Text style={styles.calendarLabel}>Google Calendar</Text>
              <Text style={styles.calendarStatus}>
                {profile?.calendar_connected ? '✓ Connected' : 'Not connected'}
              </Text>
            </View>
            <TouchableOpacity
              style={[
                styles.calendarButton,
                profile?.calendar_connected && styles.calendarButtonConnected
              ]}
              onPress={() => {
                Alert.alert(
                  'Coming Soon',
                  'Google Calendar integration will be available soon! This will create shared team calendars for your pursuits.',
                  [{ text: 'OK' }]
                );
              }}
            >
              <Text style={styles.calendarButtonText}>
                {profile?.calendar_connected ? 'Disconnect' : 'Connect'}
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.calendarHint}>
            Connect to automatically sync meeting dates to a shared team calendar
          </Text>
        </View>

        {!profile?.name && (
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>⚠️ Please add your name to complete your profile</Text>
          </View>
        )}

        <TouchableOpacity style={styles.signOutButton} onPress={signOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
</>
        )}
 {activeTab === 'connections' && (
          <ScrollView style={styles.tabContent}>
            {pendingRequests.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Pending Requests ({pendingRequests.length})</Text>
                {pendingRequests.map((request: any) => (
                  <View key={request.id} style={styles.connectionCard}>
                    {request.profile?.profile_picture ? (
                      <Image source={{ uri: request.profile.profile_picture }} style={styles.connectionAvatar} />
                    ) : (
                      <View style={styles.connectionAvatarPlaceholder}>
                        <Text style={styles.connectionAvatarText}>
                          {request.profile?.name?.charAt(0).toUpperCase() || '?'}
                        </Text>
                      </View>
                    )}
                    <View style={styles.connectionInfo}>
                      <Text style={styles.connectionName}>{request.profile?.name || 'Unknown'}</Text>
                      <Text style={styles.connectionEmail}>{request.profile?.email}</Text>
                    </View>
                    <View style={styles.requestActions}>
                      <TouchableOpacity 
                        style={styles.acceptButton}
                        onPress={() => handleAcceptConnection(request.id)}
                      >
                        <Text style={styles.acceptButtonText}>✓</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={styles.rejectButton}
                        onPress={() => handleRejectConnection(request.id)}
                      >
                        <Text style={styles.rejectButtonText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {connections.length === 0 && pendingRequests.length === 0 ? (
              <View style={styles.emptyReviews}>
                <Text style={styles.emptyReviewsEmoji}>🤝</Text>
                <Text style={styles.emptyReviewsText}>No connections yet</Text>
                <Text style={styles.emptyReviewsHint}>
                  Connect with teammates to build your network
                </Text>
              </View>
            ) : (
              <>
                {connections.map((conn: any) => (
  <TouchableOpacity 
    key={conn.id} 
    style={styles.connectionCard}
    onPress={() => navigation.navigate('UserProfile', { userId: conn.otherUserId })}
  >
    {conn.profile?.profile_picture ? (
      <Image source={{ uri: conn.profile.profile_picture }} style={styles.connectionAvatar} />
    ) : (
      <View style={styles.connectionAvatarPlaceholder}>
        <Text style={styles.connectionAvatarText}>
          {conn.profile?.name?.charAt(0).toUpperCase() || '?'}
        </Text>
      </View>
    )}
    <View style={styles.connectionInfo}>
      <Text style={styles.connectionName}>{conn.profile?.name || 'Unknown'}</Text>
      <Text style={styles.connectionEmail}>{conn.profile?.email}</Text>
    </View>
  </TouchableOpacity>
))}
              </>
            )}
          </ScrollView>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { 
    backgroundColor: '#fff', 
    padding: 20, 
    paddingTop: 60, 
    borderBottomWidth: 1, 
    borderBottomColor: '#eee',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: { fontSize: 28, fontWeight: 'bold', color: '#0ea5e9' },
  editButton: { backgroundColor: '#0ea5e9', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  editButtonText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  content: { padding: 20, paddingBottom: 100 },
  avatarContainer: { alignItems: 'center', marginBottom: 20 },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#0ea5e9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 12,
  },
  avatarText: { fontSize: 40, color: '#fff', fontWeight: 'bold' },
  name: { fontSize: 20, color: '#1f2937', fontWeight: 'bold', marginBottom: 4 },
  email: { fontSize: 14, color: '#9ca3af', fontWeight: '500' },
  section: { 
    backgroundColor: '#fff', 
    borderRadius: 12, 
    padding: 16, 
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#1f2937', marginBottom: 12 },
  teamRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  teamTitle: { fontSize: 15, color: '#1f2937', fontWeight: '500', flex: 1 },
  teamStatus: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusActive: { backgroundColor: '#d1fae5' },
  statusPending: { backgroundColor: '#fef3c7' },
  teamStatusText: { fontSize: 11, fontWeight: '600', color: '#333' },
  applicationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  applicationTitle: { fontSize: 15, color: '#1f2937', fontWeight: '500', flex: 1 },
  pendingBadge: { backgroundColor: '#fef3c7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  pendingText: { fontSize: 11, fontWeight: '600', color: '#92400e' },
  infoRow: { flexDirection: 'row', marginBottom: 8 },
  infoLabel: { fontSize: 14, fontWeight: '600', color: '#6b7280', width: 100 },
  infoValue: { fontSize: 14, color: '#1f2937', flex: 1 },
  bioText: { fontSize: 15, color: '#4b5563', lineHeight: 22 },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  linkIcon: { fontSize: 20, marginRight: 12 },
  linkText: { flex: 1, fontSize: 15, color: '#1f2937', fontWeight: '500' },
  linkArrow: { fontSize: 16, color: '#9ca3af' },
  warningBox: {
    backgroundColor: '#fef3c7',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  warningText: { fontSize: 14, color: '#92400e', fontWeight: '600', textAlign: 'center' },
  signOutButton: {
    backgroundColor: '#ef4444',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  signOutText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },tabsContainer: {
  flexDirection: 'row',
  backgroundColor: '#fff',
  borderBottomWidth: 1,
  borderBottomColor: '#e5e7eb',
  marginTop: 16,
},
profileTab: {
  flex: 1,
  paddingVertical: 12,
  alignItems: 'center',
  borderBottomWidth: 2,
  borderBottomColor: 'transparent',
},
profileTabActive: {
  borderBottomColor: '#0ea5e9',
},
profileTabText: {
  fontSize: 14,
  color: '#6b7280',
  fontWeight: '500',
},
profileTabTextActive: {
  color: '#0ea5e9',
  fontWeight: 'bold',
},
tabContent: {
  flex: 1,
  padding: 16,
},
ratingsCard: {
  backgroundColor: '#fff',
  borderRadius: 12,
  padding: 20,
  marginBottom: 16,
  alignItems: 'center',
  borderWidth: 1,
  borderColor: '#e5e7eb',
},
ratingsTitle: {
  fontSize: 24,
  fontWeight: 'bold',
  color: '#1f2937',
  marginBottom: 4,
},
ratingsCount: {
  fontSize: 14,
  color: '#6b7280',
},
emptyReviews: {
  alignItems: 'center',
  paddingVertical: 60,
},
emptyReviewsEmoji: {
  fontSize: 64,
  marginBottom: 16,
},
emptyReviewsText: {
  fontSize: 18,
  fontWeight: 'bold',
  color: '#6b7280',
  marginBottom: 8,
},
emptyReviewsHint: {
  fontSize: 14,
  color: '#9ca3af',
  textAlign: 'center',
  paddingHorizontal: 40,
},
reviewCard: {
  backgroundColor: '#fff',
  borderRadius: 12,
  padding: 16,
  marginBottom: 12,
  borderWidth: 1,
  borderColor: '#e5e7eb',
},
reviewHeader: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  marginBottom: 8,
},
reviewerName: {
  fontSize: 16,
  fontWeight: 'bold',
  color: '#1f2937',
},
reviewDate: {
  fontSize: 12,
  color: '#6b7280',
},
reviewPursuit: {
  fontSize: 13,
  color: '#0ea5e9',
  marginBottom: 12,
},
reviewRatings: {
  marginBottom: 12,
},
reviewRatingText: {
  fontSize: 14,
  color: '#374151',
  marginBottom: 4,
},
reviewComment: {
  fontSize: 14,
  color: '#6b7280',
  fontStyle: 'italic',
  marginTop: 8,
  paddingTop: 8,
  borderTopWidth: 1,
  borderTopColor: '#e5e7eb',
},
reviewableTitle: {
  fontSize: 16,
  fontWeight: 'bold',
  color: '#1f2937',
  marginBottom: 16,
},
teammateCard: {
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: '#fff',
  borderRadius: 12,
  padding: 16,
  marginBottom: 12,
  borderWidth: 1,
  borderColor: '#e5e7eb',
},
teammateAvatar: {
  width: 48,
  height: 48,
  borderRadius: 24,
  marginRight: 12,
},
teammateAvatarPlaceholder: {
  width: 48,
  height: 48,
  borderRadius: 24,
  backgroundColor: '#0ea5e9',
  justifyContent: 'center',
  alignItems: 'center',
  marginRight: 12,
},
teammateAvatarText: {
  fontSize: 20,
  fontWeight: 'bold',
  color: '#fff',
},
teammateInfo: {
  flex: 1,
},
teammateName: {
  fontSize: 16,
  fontWeight: 'bold',
  color: '#1f2937',
  marginBottom: 4,
},
teammatePursuit: {
  fontSize: 13,
  color: '#6b7280',
},
reviewArrow: {
  fontSize: 20,
  color: '#0ea5e9',
},connectionCard: {
  flexDirection: 'row',
  alignItems: 'center',
  paddingVertical: 12,
  borderBottomWidth: 1,
  borderBottomColor: '#f3f4f6',
},
connectionAvatar: {
  width: 48,
  height: 48,
  borderRadius: 24,
  marginRight: 12,
},
connectionAvatarPlaceholder: {
  width: 48,
  height: 48,
  borderRadius: 24,
  backgroundColor: '#0ea5e9',
  justifyContent: 'center',
  alignItems: 'center',
  marginRight: 12,
},
connectionAvatarText: {
  fontSize: 20,
  fontWeight: 'bold',
  color: '#fff',
},
connectionInfo: {
  flex: 1,
},
connectionName: {
  fontSize: 16,
  fontWeight: 'bold',
  color: '#1f2937',
  marginBottom: 2,
},
connectionEmail: {
  fontSize: 13,
  color: '#6b7280',
},
requestActions: {
  flexDirection: 'row',
  gap: 8,
},
acceptButton: {
  backgroundColor: '#10b981',
  width: 36,
  height: 36,
  borderRadius: 18,
  justifyContent: 'center',
  alignItems: 'center',
},
acceptButtonText: {
  color: '#fff',
  fontSize: 20,
  fontWeight: 'bold',
},
rejectButton: {
  backgroundColor: '#ef4444',
  width: 36,
  height: 36,
  borderRadius: 18,
  justifyContent: 'center',
  alignItems: 'center',
},
rejectButtonText: {
  color: '#fff',
  fontSize: 20,
  fontWeight: 'bold',
}, calendarRow: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 12,
},
calendarInfo: {
  flex: 1,
},
calendarLabel: {
  fontSize: 15,
  fontWeight: '600',
  color: '#1f2937',
  marginBottom: 4,
},
calendarStatus: {
  fontSize: 13,
  color: '#6b7280',
},
calendarButton: {
  backgroundColor: '#10b981',
  paddingHorizontal: 16,
  paddingVertical: 8,
  borderRadius: 8,
},
calendarButtonConnected: {
  backgroundColor: '#6b7280',
},
calendarButtonText: {
  color: '#fff',
  fontSize: 14,
  fontWeight: '600',
},
calendarHint: {
  fontSize: 12,
  color: '#9ca3af',
  fontStyle: 'italic',
},
});
