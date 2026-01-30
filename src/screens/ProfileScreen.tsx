import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Linking, Image, Alert, Modal, TextInput, KeyboardAvoidingView, Platform, StatusBar, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../config/supabase';
import { connectionService } from '../services/connectionService';
import { reviewService } from '../services/reviewService';
import { privacyService } from '../services/privacyService';
import EditProfileScreen from './EditProfileScreen';
import PrivacyPreferencesScreen from './PrivacyPreferencesScreen';
import ReviewScreen from './ReviewScreen';
import PodMemberCollage from '../components/PodMemberCollage';
import { colors as legacyColors, typography, spacing, borderRadius, shadows } from '../theme/designSystem';
import { useTheme } from '../theme/ThemeContext';
import { getThemedStyles } from '../theme/themedStyles';
import GrainTexture from '../components/ui/GrainTexture';

export default function ProfileScreen({ navigation }: any) {
  const { user, signOut } = useAuth();
  const { theme, isNewTheme, toggleTheme } = useTheme();
  const colors = theme.colors;
  const themedStyles = getThemedStyles(colors, isNewTheme);
  const [profile, setProfile] = useState<any>(null);
  const [activeTeams, setActiveTeams] = useState<any[]>([]);
  const [pendingApplications, setPendingApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
const [activeTab, setActiveTab] = useState<'info' | 'received' | 'give' | 'connections' | 'pods'>('info');
const [connections, setConnections] = useState<any[]>([]);
const [pendingRequests, setPendingRequests] = useState<any[]>([]);
const [connectionSearchQuery, setConnectionSearchQuery] = useState('');
const [reviews, setReviews] = useState<any[]>([]);
const [averageRatings, setAverageRatings] = useState<any>(null);
const [reviewableTeammates, setReviewableTeammates] = useState<any[]>([]);
const [showReviewScreen, setShowReviewScreen] = useState(false);
const [selectedReviewee, setSelectedReviewee] = useState<any>(null);
const [showMenu, setShowMenu] = useState(false);
const [showPrivacyPreferences, setShowPrivacyPreferences] = useState(false);
const [userPods, setUserPods] = useState<any[]>([]);
const [podsLoading, setPodsLoading] = useState(false);

  useEffect(() => {
  loadProfile();
  loadActiveTeams();
  loadPendingApplications();
  loadReviews();
  loadReviewableTeammates();
  loadConnections();
  loadUserPods();
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
      
      let memberPursuits: any[] = [];
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
    const profile = Array.isArray(teammate.profiles) ? teammate.profiles[0] : teammate.profiles;
    const pursuit = Array.isArray(teammate.pursuits) ? teammate.pursuits[0] : teammate.pursuits;
    
    reviewableList.push({
      userId: teammate.user_id,
      userName: (profile as any)?.name || 'Unknown',
      userPicture: (profile as any)?.profile_picture,
      pursuitId: teammate.pursuit_id,
      pursuitTitle: (pursuit as any)?.title || 'Unknown Pursuit',
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

const loadUserPods = async () => {
  if (!user) return;
  setPodsLoading(true);
  try {
    const pods = await privacyService.getUserPods(user.id);
    setUserPods(pods);
  } catch (error) {
    console.error('Error loading user pods:', error);
  } finally {
    setPodsLoading(false);
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

  if (showPrivacyPreferences) {
    return (
      <PrivacyPreferencesScreen 
        onBack={() => {
          setShowPrivacyPreferences(false);
        }} 
      />
    );
  }

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
      <View style={[styles.loadingContainer, themedStyles.container]}>
        <ActivityIndicator size="large" color={themedStyles.accentIconColor} />
      </View>
    );
  }

  return (
    <View style={[styles.container, themedStyles.container]}>
      <StatusBar barStyle={isNewTheme ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      {isNewTheme && <GrainTexture opacity={0.06} />}

      {/* Modern Header - matches FeedScreen */}
      <View style={[styles.header, themedStyles.surface]}>
        <View style={styles.headerTop}>
          <View>
            <Text style={[styles.headerGreeting, themedStyles.headerSubtitle]}>Your</Text>
            <Text style={[styles.headerTitle, themedStyles.headerTitle]}>Profile</Text>
          </View>
          <TouchableOpacity onPress={() => setShowMenu(true)} style={styles.menuButton}>
            <Ionicons name="settings-outline" size={24} color={themedStyles.accentIconColor} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>

      {/* Settings Menu Modal */}
      <Modal
        visible={showMenu}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowMenu(false)}
      >
        <TouchableOpacity
          style={styles.menuOverlay}
          activeOpacity={1}
          onPress={() => setShowMenu(false)}
        >
          <View style={[styles.menuContainer, themedStyles.surface]}>
            <View style={[styles.menuHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.menuTitle, themedStyles.cardTitle]}>Settings</Text>
              <TouchableOpacity onPress={() => setShowMenu(false)}>
                <Ionicons name="close" size={24} color={themedStyles.accentIconColor} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.menuItem, themedStyles.listItem]}
              onPress={() => {
                setShowMenu(false);
                setShowEdit(true);
              }}
            >
              <View style={[styles.menuItemIcon, themedStyles.iconContainer]}>
                <Ionicons name="person-outline" size={22} color={themedStyles.accentIconColor} />
              </View>
              <View style={styles.menuItemContent}>
                <Text style={[styles.menuItemText, themedStyles.listItemTitle]}>Account Details</Text>
                <Text style={[styles.menuItemSubtext, themedStyles.listItemSubtitle]}>Edit your profile information</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={themedStyles.accentIconColor} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.menuItem, themedStyles.listItem]}
              onPress={() => {
                setShowMenu(false);
                setShowPrivacyPreferences(true);
              }}
            >
              <View style={[styles.menuItemIcon, themedStyles.iconContainer]}>
                <Ionicons name="shield-outline" size={22} color={themedStyles.accentIconColor} />
              </View>
              <View style={styles.menuItemContent}>
                <Text style={[styles.menuItemText, themedStyles.listItemTitle]}>Privacy Preferences</Text>
                <Text style={[styles.menuItemSubtext, themedStyles.listItemSubtitle]}>Manage your privacy settings</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={themedStyles.accentIconColor} />
            </TouchableOpacity>

            {/* Dark Mode Toggle */}
            <View style={[styles.menuItem, themedStyles.listItem]}>
              <View style={[styles.menuItemIcon, themedStyles.iconContainer]}>
                <Ionicons name="moon-outline" size={22} color={themedStyles.accentIconColor} />
              </View>
              <View style={styles.menuItemContent}>
                <Text style={[styles.menuItemText, themedStyles.listItemTitle]}>Dark Mode</Text>
                <Text style={[styles.menuItemSubtext, themedStyles.listItemSubtitle]}>Switch to {isNewTheme ? 'light' : 'dark'} theme</Text>
              </View>
              <Switch
                value={isNewTheme}
                onValueChange={toggleTheme}
                trackColor={{ false: '#d1d5db', true: isNewTheme ? colors.accentGreen : colors.secondary }}
                thumbColor={isNewTheme ? colors.white : '#f4f3f4'}
              />
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      <View style={styles.content}>
        <View style={styles.avatarContainer}>
          {profile?.profile_picture ? (
            <Image source={{ uri: profile.profile_picture }} style={styles.avatarImage} />
          ) : (
            <View style={[styles.avatar, themedStyles.avatar]}>
              <Text style={[styles.avatarText, themedStyles.avatarText]}>
                {profile?.name?.charAt(0).toUpperCase() || '?'}
              </Text>
            </View>
          )}
          <Text style={[styles.name, themedStyles.textPrimary, { fontSize: typography.fontSize.xl, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>{profile?.name || 'No name set'}</Text>
          <Text style={[styles.email, themedStyles.textTertiary]}>{profile?.email}</Text>
        </View>
{/* Modern Pill Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={[styles.tabsScrollView, themedStyles.surface]}
          contentContainerStyle={styles.tabsContainer}
        >
          <TouchableOpacity
            style={[styles.tabPill, themedStyles.surfaceAlt, activeTab === 'info' && [styles.tabPillActive, { backgroundColor: isNewTheme ? colors.accentGreen : colors.primary, borderColor: isNewTheme ? colors.accentGreen : colors.primary }]]}
            onPress={() => setActiveTab('info')}
          >
            <Ionicons
              name="person-outline"
              size={16}
              color={activeTab === 'info' ? (isNewTheme ? colors.background : colors.white) : colors.textSecondary}
            />
            <Text style={[styles.tabPillText, themedStyles.textSecondary, activeTab === 'info' && { color: isNewTheme ? colors.background : colors.white }]}>
              Info
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabPill, themedStyles.surfaceAlt, activeTab === 'received' && [styles.tabPillActive, { backgroundColor: isNewTheme ? colors.accentGreen : colors.primary, borderColor: isNewTheme ? colors.accentGreen : colors.primary }]]}
            onPress={() => setActiveTab('received')}
          >
            <Ionicons
              name="star-outline"
              size={16}
              color={activeTab === 'received' ? (isNewTheme ? colors.background : colors.white) : colors.textSecondary}
            />
            <Text style={[styles.tabPillText, themedStyles.textSecondary, activeTab === 'received' && { color: isNewTheme ? colors.background : colors.white }]}>
              Reviews
            </Text>
            {reviews.length > 0 && (
              <View style={[styles.tabBadge, activeTab === 'received' && styles.tabBadgeActive]}>
                <Text style={[styles.tabBadgeText, { color: themedStyles.accentIconColor }, activeTab === 'received' && { color: isNewTheme ? colors.background : colors.white }]}>
                  {reviews.length}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabPill, themedStyles.surfaceAlt, activeTab === 'connections' && [styles.tabPillActive, { backgroundColor: isNewTheme ? colors.accentGreen : colors.primary, borderColor: isNewTheme ? colors.accentGreen : colors.primary }]]}
            onPress={() => setActiveTab('connections')}
          >
            <Ionicons
              name="people-outline"
              size={16}
              color={activeTab === 'connections' ? (isNewTheme ? colors.background : colors.white) : colors.textSecondary}
            />
            <Text style={[styles.tabPillText, themedStyles.textSecondary, activeTab === 'connections' && { color: isNewTheme ? colors.background : colors.white }]}>
              Connections
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabPill, themedStyles.surfaceAlt, activeTab === 'pods' && [styles.tabPillActive, { backgroundColor: isNewTheme ? colors.accentGreen : colors.primary, borderColor: isNewTheme ? colors.accentGreen : colors.primary }]]}
            onPress={() => setActiveTab('pods')}
          >
            <Ionicons
              name="rocket-outline"
              size={16}
              color={activeTab === 'pods' ? (isNewTheme ? colors.background : colors.white) : colors.textSecondary}
            />
            <Text style={[styles.tabPillText, themedStyles.textSecondary, activeTab === 'pods' && { color: isNewTheme ? colors.background : colors.white }]}>
              Pods
            </Text>
            {userPods.length > 0 && (
              <View style={[styles.tabBadge, activeTab === 'pods' && styles.tabBadgeActive]}>
                <Text style={[styles.tabBadgeText, { color: themedStyles.accentIconColor }, activeTab === 'pods' && { color: isNewTheme ? colors.background : colors.white }]}>
                  {userPods.length}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </ScrollView>

{activeTab === 'info' && (
          <>
        {(profile?.age || profile?.gender || profile?.hometown) && (
          <View style={[styles.section, themedStyles.card]}>
            <Text style={[styles.sectionTitle, themedStyles.cardTitle]}>Basic Info</Text>
            {profile?.age && (
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, themedStyles.labelText]}>Age:</Text>
                <Text style={[styles.infoValue, themedStyles.bodyText, { fontFamily: isNewTheme ? 'Magra_400Regular' : undefined }]}>{profile.age}</Text>
              </View>
            )}
            {profile?.gender && (
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, themedStyles.labelText]}>Gender:</Text>
                <Text style={[styles.infoValue, themedStyles.bodyText, { fontFamily: isNewTheme ? 'Magra_400Regular' : undefined }]}>{profile.gender}</Text>
              </View>
            )}
            {profile?.hometown && (
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, themedStyles.labelText]}>Hometown:</Text>
                <Text style={[styles.infoValue, themedStyles.bodyText, { fontFamily: isNewTheme ? 'Magra_400Regular' : undefined }]}>{profile.hometown}</Text>
              </View>
            )}
          </View>
        )}

        {profile?.bio && (
          <View style={[styles.section, themedStyles.card]}>
            <Text style={[styles.sectionTitle, themedStyles.cardTitle]}>Bio</Text>
            <Text style={[styles.bioText, themedStyles.bodyText, { fontFamily: isNewTheme ? 'Magra_400Regular' : undefined }]}>{profile.bio}</Text>
          </View>
        )}

        {(profile?.instagram || profile?.linkedin || profile?.facebook || profile?.github || profile?.portfolio_website) && (
          <View style={[styles.section, themedStyles.card]}>
            <Text style={[styles.sectionTitle, themedStyles.cardTitle]}>Social Links</Text>
            {profile?.instagram && (
              <TouchableOpacity style={[styles.linkRow, { borderBottomColor: colors.border }]} onPress={() => handleOpenLink(profile.instagram)}>
                <Ionicons name="logo-instagram" size={20} color={themedStyles.accentIconColor} style={styles.linkIconNew} />
                <Text style={[styles.linkText, themedStyles.listItemTitle]}>Instagram</Text>
                <Ionicons name="chevron-forward" size={16} color={themedStyles.accentIconColor} />
              </TouchableOpacity>
            )}
            {profile?.linkedin && (
              <TouchableOpacity style={[styles.linkRow, { borderBottomColor: colors.border }]} onPress={() => handleOpenLink(profile.linkedin)}>
                <Ionicons name="logo-linkedin" size={20} color={themedStyles.accentIconColor} style={styles.linkIconNew} />
                <Text style={[styles.linkText, themedStyles.listItemTitle]}>LinkedIn</Text>
                <Ionicons name="chevron-forward" size={16} color={themedStyles.accentIconColor} />
              </TouchableOpacity>
            )}
            {profile?.facebook && (
              <TouchableOpacity style={[styles.linkRow, { borderBottomColor: colors.border }]} onPress={() => handleOpenLink(profile.facebook)}>
                <Ionicons name="logo-facebook" size={20} color={themedStyles.accentIconColor} style={styles.linkIconNew} />
                <Text style={[styles.linkText, themedStyles.listItemTitle]}>Facebook</Text>
                <Ionicons name="chevron-forward" size={16} color={themedStyles.accentIconColor} />
              </TouchableOpacity>
            )}
            {profile?.github && (
              <TouchableOpacity style={[styles.linkRow, { borderBottomColor: colors.border }]} onPress={() => handleOpenLink(profile.github)}>
                <Ionicons name="logo-github" size={20} color={themedStyles.accentIconColor} style={styles.linkIconNew} />
                <Text style={[styles.linkText, themedStyles.listItemTitle]}>GitHub</Text>
                <Ionicons name="chevron-forward" size={16} color={themedStyles.accentIconColor} />
              </TouchableOpacity>
            )}
            {profile?.portfolio_website && (
              <TouchableOpacity style={[styles.linkRow, { borderBottomColor: colors.border }]} onPress={() => handleOpenLink(profile.portfolio_website)}>
                <Ionicons name="globe-outline" size={20} color={themedStyles.accentIconColor} style={styles.linkIconNew} />
                <Text style={[styles.linkText, themedStyles.listItemTitle]}>Portfolio</Text>
                <Ionicons name="chevron-forward" size={16} color={themedStyles.accentIconColor} />
              </TouchableOpacity>
            )}
          </View>
        )}

        {!profile?.name && (
          <View style={styles.warningBox}>
            <Text style={[styles.warningText, themedStyles.bodyText]}>Please add your name to complete your profile</Text>
          </View>
        )}

        <TouchableOpacity style={[styles.signOutButton, { backgroundColor: colors.error }]} onPress={signOut}>
          <Text style={[styles.signOutText, themedStyles.buttonPrimaryText, { color: colors.white }]}>Sign Out</Text>
        </TouchableOpacity>
</>
        )}
 {activeTab === 'connections' && (
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
          >
          <ScrollView
            style={styles.tabContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Search Bar */}
            <View style={[styles.connectionSearchContainer, themedStyles.searchContainer]}>
              <Ionicons name="search" size={18} color={themedStyles.accentIconColor} style={styles.connectionSearchIcon} />
              <TextInput
                style={[styles.connectionSearchInput, themedStyles.inputText, { fontFamily: isNewTheme ? 'Magra_400Regular' : undefined }]}
                placeholder="Search connections..."
                placeholderTextColor={colors.textTertiary}
                value={connectionSearchQuery}
                onChangeText={setConnectionSearchQuery}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {connectionSearchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setConnectionSearchQuery('')}>
                  <Ionicons name="close-circle" size={18} color={themedStyles.accentIconColor} />
                </TouchableOpacity>
              )}
            </View>

            {pendingRequests.length > 0 && !connectionSearchQuery && (
              <View style={[styles.section, themedStyles.card]}>
                <Text style={[styles.sectionTitle, themedStyles.cardTitle]}>Pending Requests ({pendingRequests.length})</Text>
                {pendingRequests.map((request: any) => (
                  <View key={request.id} style={[styles.connectionCard, { borderBottomColor: colors.border }]}>
                    {request.profile?.profile_picture ? (
                      <Image source={{ uri: request.profile.profile_picture }} style={styles.connectionAvatar} />
                    ) : (
                      <View style={[styles.connectionAvatarPlaceholder, themedStyles.avatar]}>
                        <Text style={[styles.connectionAvatarText, themedStyles.avatarText]}>
                          {request.profile?.name?.charAt(0).toUpperCase() || '?'}
                        </Text>
                      </View>
                    )}
                    <View style={styles.connectionInfo}>
                      <Text style={[styles.connectionName, themedStyles.listItemTitle]}>{request.profile?.name || 'Unknown'}</Text>
                      <Text style={[styles.connectionEmail, themedStyles.listItemSubtitle]}>{request.profile?.email}</Text>
                    </View>
                    <View style={styles.requestActions}>
                      <TouchableOpacity
                        style={[styles.acceptButton, { backgroundColor: colors.success }]}
                        onPress={() => handleAcceptConnection(request.id)}
                      >
                        <Text style={styles.acceptButtonText}>✓</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.rejectButton, { backgroundColor: colors.error }]}
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
                <Ionicons name="people-outline" size={64} color={themedStyles.accentIconColor} style={{ marginBottom: 16 }} />
                <Text style={[styles.emptyReviewsText, themedStyles.emptyText]}>No connections yet</Text>
                <Text style={[styles.emptyReviewsHint, themedStyles.emptySubtext]}>
                  Connect with teammates to build your network
                </Text>
              </View>
            ) : (
              <>
                {connections
                  .filter((conn: any) => {
                    if (!connectionSearchQuery) return true;
                    const name = (conn.profile?.name || '').toLowerCase();
                    const query = connectionSearchQuery.toLowerCase();
                    // Check if full name starts with query OR any word starts with query
                    if (name.startsWith(query)) return true;
                    const nameParts = name.split(' ');
                    return nameParts.some((part: string) => part.startsWith(query));
                  })
                  .map((conn: any) => (
  <TouchableOpacity
    key={conn.id}
    style={[styles.connectionCard, { borderBottomColor: colors.border }]}
    onPress={() => navigation.navigate('UserProfile', { userId: conn.otherUserId })}
  >
    {conn.profile?.profile_picture ? (
      <Image source={{ uri: conn.profile.profile_picture }} style={styles.connectionAvatar} />
    ) : (
      <View style={[styles.connectionAvatarPlaceholder, themedStyles.avatar]}>
        <Text style={[styles.connectionAvatarText, themedStyles.avatarText]}>
          {conn.profile?.name?.charAt(0).toUpperCase() || '?'}
        </Text>
      </View>
    )}
    <View style={styles.connectionInfo}>
      <Text style={[styles.connectionName, themedStyles.listItemTitle]}>{conn.profile?.name || 'Unknown'}</Text>
      <Text style={[styles.connectionEmail, themedStyles.listItemSubtitle]}>{conn.profile?.email}</Text>
    </View>
  </TouchableOpacity>
))}
                {connectionSearchQuery && connections.filter((conn: any) => {
                  const name = (conn.profile?.name || '').toLowerCase();
                  const query = connectionSearchQuery.toLowerCase();
                  if (name.startsWith(query)) return true;
                  const nameParts = name.split(' ');
                  return nameParts.some((part: string) => part.startsWith(query));
                }).length === 0 && (
                  <View style={styles.emptyReviews}>
                    <Text style={[styles.emptyReviewsText, themedStyles.emptyText]}>No matches found</Text>
                    <Text style={[styles.emptyReviewsHint, themedStyles.emptySubtext]}>Try a different search term</Text>
                  </View>
                )}
              </>
            )}
          </ScrollView>
          </KeyboardAvoidingView>
        )}

        {/* Pods Tab */}
        {activeTab === 'pods' && (
          <ScrollView style={styles.tabContent}>
            {podsLoading ? (
              <View style={styles.emptyReviews}>
                <ActivityIndicator size="large" color={themedStyles.accentIconColor} />
                <Text style={[styles.emptyReviewsHint, themedStyles.emptySubtext]}>Loading your pods...</Text>
              </View>
            ) : userPods.length === 0 ? (
              <View style={styles.emptyReviews}>
                <Ionicons name="rocket-outline" size={64} color={themedStyles.accentIconColor} style={{ marginBottom: 16 }} />
                <Text style={[styles.emptyReviewsText, themedStyles.emptyText]}>No pods yet</Text>
                <Text style={[styles.emptyReviewsHint, themedStyles.emptySubtext]}>
                  Join or create a pod to get started
                </Text>
              </View>
            ) : (
              <>
                {/* Current Pods */}
                {userPods.filter(p => !p.status || ['awaiting_kickoff', 'collecting_proposals', 'active'].includes(p.status) || ['active', 'accepted'].includes(p.membership_status)).length > 0 && (
                  <View style={[styles.section, themedStyles.card]}>
                    <Text style={[styles.sectionTitle, themedStyles.cardTitle]}>Current Pods</Text>
                    {userPods
                      .filter(p => !p.status || ['awaiting_kickoff', 'collecting_proposals', 'active'].includes(p.status) || ['active', 'accepted'].includes(p.membership_status))
                      .map((pod) => (
                        <TouchableOpacity
                          key={pod.id}
                          style={[styles.podCard, themedStyles.surfaceAlt]}
                          onPress={() => navigation.navigate('PursuitDetail', { pursuitId: pod.id })}
                        >
                          {pod.default_picture ? (
                            <Image source={{ uri: pod.default_picture }} style={styles.podCardImage} />
                          ) : (
                            <PodMemberCollage members={pod.members || []} size={50} borderRadius={10} />
                          )}
                          <View style={styles.podCardInfo}>
                            <Text style={[styles.podCardTitle, themedStyles.listItemTitle]}>{pod.title}</Text>
                            <View style={styles.podCardMeta}>
                              {pod.isCreator && (
                                <View style={[styles.podCreatorBadge, themedStyles.tag]}>
                                  <Ionicons name="star" size={10} color={themedStyles.accentIconColor} />
                                  <Text style={[styles.podCreatorBadgeText, themedStyles.tagText]}>Creator</Text>
                                </View>
                              )}
                              <Text style={[styles.podCardMembers, themedStyles.listItemSubtitle]}>
                                {pod.current_members_count || 1} member{(pod.current_members_count || 1) !== 1 ? 's' : ''}
                              </Text>
                            </View>
                          </View>
                          <Ionicons name="chevron-forward" size={20} color={themedStyles.accentIconColor} />
                        </TouchableOpacity>
                      ))}
                  </View>
                )}

                {/* Past Pods */}
                {userPods.filter(p => ['completed', 'archived'].includes(p.status) || ['left', 'removed'].includes(p.membership_status)).length > 0 && (
                  <View style={[styles.section, themedStyles.card]}>
                    <Text style={[styles.sectionTitle, themedStyles.cardTitle]}>Past Pods</Text>
                    {userPods
                      .filter(p => ['completed', 'archived'].includes(p.status) || ['left', 'removed'].includes(p.membership_status))
                      .map((pod) => (
                        <TouchableOpacity
                          key={pod.id}
                          style={[styles.podCard, styles.podCardPast, themedStyles.surfaceAlt, { opacity: 0.7 }]}
                          onPress={() => navigation.navigate('PursuitDetail', { pursuitId: pod.id })}
                        >
                          {pod.default_picture ? (
                            <Image source={{ uri: pod.default_picture }} style={[styles.podCardImage, styles.podCardImagePast]} />
                          ) : (
                            <View style={styles.podCardImagePast}>
                              <PodMemberCollage members={pod.members || []} size={50} borderRadius={10} />
                            </View>
                          )}
                          <View style={styles.podCardInfo}>
                            <Text style={[styles.podCardTitle, styles.podCardTitlePast, themedStyles.textSecondary]}>{pod.title}</Text>
                            <View style={styles.podCardMeta}>
                              {pod.isCreator && (
                                <View style={[styles.podCreatorBadge, styles.podCreatorBadgePast, themedStyles.surfaceAlt]}>
                                  <Ionicons name="star" size={10} color={colors.textTertiary} />
                                  <Text style={[styles.podCreatorBadgeTextPast, themedStyles.textTertiary]}>Creator</Text>
                                </View>
                              )}
                              <Text style={[styles.podCardStatus, themedStyles.textTertiary]}>
                                {pod.membership_status === 'left' ? 'Left' : pod.membership_status === 'removed' ? 'Removed' : 'Closed'}
                              </Text>
                            </View>
                          </View>
                          <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
                        </TouchableOpacity>
                      ))}
                  </View>
                )}
              </>
            )}
          </ScrollView>
        )}
      </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: legacyColors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: legacyColors.background,
  },

  // Header - matches FeedScreen
  header: {
    backgroundColor: legacyColors.white,
    paddingTop: 50,
    paddingBottom: spacing.base,
    ...shadows.sm,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.lg,
  },
  headerGreeting: {
    fontSize: typography.fontSize.sm,
    color: legacyColors.textSecondary,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs,
  },
  headerTitle: {
    fontSize: typography.fontSize['3xl'],
    fontWeight: typography.fontWeight.bold,
    color: legacyColors.textPrimary,
  },
  menuButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },

  scrollContent: {
    flex: 1,
  },
  // Menu Modal Styles
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 100,
    paddingRight: 16,
  },
  menuContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: 280,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    overflow: 'hidden',
  },
  menuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  menuTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  menuItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuItemContent: {
    flex: 1,
  },
  menuItemText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2,
  },
  menuItemSubtext: {
    fontSize: 12,
    color: '#9ca3af',
  },
  content: {
    padding: spacing.lg,
    paddingBottom: 100,
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: spacing.lg,
    marginTop: spacing.lg,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: legacyColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: spacing.md,
  },
  avatarText: {
    fontSize: 40,
    color: legacyColors.white,
    fontWeight: typography.fontWeight.bold,
  },
  name: {
    fontSize: typography.fontSize.xl,
    color: legacyColors.textPrimary,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.xs,
  },
  email: {
    fontSize: typography.fontSize.sm,
    color: legacyColors.textTertiary,
    fontWeight: typography.fontWeight.medium,
  },
  section: {
    backgroundColor: legacyColors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.base,
    marginBottom: spacing.base,
    ...shadows.sm,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: legacyColors.textPrimary,
    marginBottom: spacing.md,
  },

  // Modern Pill Tabs - matches FeedScreen filter buttons
  tabsScrollView: {
    backgroundColor: legacyColors.white,
    paddingVertical: spacing.md,
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  tabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: legacyColors.backgroundSecondary,
    borderWidth: 1,
    borderColor: legacyColors.borderLight,
    gap: spacing.xs,
  },
  tabPillActive: {
    backgroundColor: legacyColors.primary,
    borderColor: legacyColors.primary,
  },
  tabPillText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: legacyColors.textSecondary,
  },
  tabPillTextActive: {
    color: legacyColors.white,
  },
  tabBadge: {
    backgroundColor: legacyColors.white,
    borderRadius: borderRadius.full,
    minWidth: 20,
    height: 20,
    paddingHorizontal: spacing.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabBadgeActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  tabBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: legacyColors.primary,
  },
  tabBadgeTextActive: {
    color: legacyColors.white,
  },
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
  linkIconNew: { marginRight: 12 },
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
    backgroundColor: legacyColors.error,
    borderRadius: borderRadius.lg,
    padding: spacing.base,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  signOutText: {
    color: legacyColors.white,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
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
connectionSearchContainer: {
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: '#f3f4f6',
  borderRadius: 10,
  paddingHorizontal: 12,
  paddingVertical: 10,
  marginBottom: 16,
},
connectionSearchIcon: {
  marginRight: 8,
},
connectionSearchInput: {
  flex: 1,
  fontSize: 15,
  color: '#1f2937',
  padding: 0,
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
// Pod card styles
podCard: {
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: '#fff',
  borderRadius: 12,
  padding: 12,
  marginBottom: 10,
  borderWidth: 1,
  borderColor: '#e5e7eb',
},
podCardPast: {
  backgroundColor: '#f9fafb',
  borderColor: '#e5e7eb',
},
podCardImage: {
  width: 50,
  height: 50,
  borderRadius: 10,
},
podCardImagePast: {
  opacity: 0.6,
},
podCardImagePlaceholder: {
  width: 50,
  height: 50,
  borderRadius: 10,
  backgroundColor: '#f3f4f6',
  justifyContent: 'center',
  alignItems: 'center',
},
podCardImagePlaceholderPast: {
  backgroundColor: '#e5e7eb',
},
podCardInfo: {
  flex: 1,
  marginLeft: 12,
},
podCardTitle: {
  fontSize: 15,
  fontWeight: '600',
  color: '#1f2937',
},
podCardTitlePast: {
  color: '#6b7280',
},
podCardMeta: {
  flexDirection: 'row',
  alignItems: 'center',
  marginTop: 4,
  gap: 8,
},
podCreatorBadge: {
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: '#fef3c7',
  paddingHorizontal: 6,
  paddingVertical: 2,
  borderRadius: 4,
  gap: 2,
},
podCreatorBadgePast: {
  backgroundColor: '#f3f4f6',
},
podCreatorBadgeText: {
  fontSize: 10,
  fontWeight: '600',
  color: '#d97706',
},
podCreatorBadgeTextPast: {
  color: '#9ca3af',
},
podCardMembers: {
  fontSize: 13,
  color: '#6b7280',
},
podCardStatus: {
  fontSize: 12,
  color: '#9ca3af',
  fontStyle: 'italic',
},
});
