import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  Linking,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../config/supabase';
import { useAuth } from '../contexts/AuthContext';
import { connectionService } from '../services/connectionService';
import { privacyService, ViewerRelationship } from '../services/privacyService';
import PodMemberCollage from '../components/PodMemberCollage';
import { colors as legacyColors, typography, spacing, editorial } from '../theme/designSystem';
import { possessivePronoun } from '../utils/pronouns';
import { useTheme } from '../theme/ThemeContext';
import { getThemedStyles } from '../theme/themedStyles';
import GrainTexture from '../components/ui/GrainTexture';
import GradientBackground from '../components/ui/GradientBackground';
import { AppAlert } from '../components/ui/AppAlert';

interface PrivacyVisibility {
  canAccessProfile: boolean;
  canViewSocials: boolean;
  canViewReviews: boolean;
  canViewPodsTab: boolean;
  canViewConnections: boolean;
  relationship: ViewerRelationship;
}

export default function UserProfileScreen({ route, navigation }: any) {
  const { userId } = route.params;
  const { user } = useAuth();
  const { theme, isNewTheme } = useTheme();
  const colors = theme.colors;
  const themedStyles = getThemedStyles(colors, isNewTheme);
  const [profile, setProfile] = useState<any>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'about' | 'pods' | 'connections'>('about');
  const [userPods, setUserPods] = useState<any[]>([]);
  const [podsLoading, setPodsLoading] = useState(false);
  const [userConnections, setUserConnections] = useState<any[]>([]);
  const [connectionsLoading, setConnectionsLoading] = useState(false);
  const [connectionSearchQuery, setConnectionSearchQuery] = useState('');
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);
  
  // Privacy state
  const [privacyVisibility, setPrivacyVisibility] = useState<PrivacyVisibility | null>(null);

  useEffect(() => {
    // Redirect to own profile if viewing yourself
    if (user && userId === user.id) {
      navigation.replace('Profile');
      return;
    }

    loadAll();
  }, [userId, user]);

  const loadAll = async () => {
    setLoading(true);
    try {
      // First check privacy visibility
      const visibility = await privacyService.checkAllSectionVisibility(
        user?.id || null,
        userId
      );
      setPrivacyVisibility(visibility);

      // Always load basic profile for name/avatar (shown even on private profiles)
      await loadProfile();
      await checkConnection();

      // Only load sections if visible
      if (visibility.canViewPodsTab) {
        await loadUserPods();
      }
      if (visibility.canViewConnections) {
        await loadUserConnections();
      }
    } catch (error) {
      console.error('Error loading profile data:', error);
    } finally {
      setLoading(false);
    }
  };

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
    }
  };

  const checkConnection = async () => {
    if (user) {
      const connected = await connectionService.areConnected(user.id, userId);
      setIsConnected(connected);
    }
  };

  const loadUserPods = async () => {
    setPodsLoading(true);
    try {
      console.log('📦 Loading pods for user:', userId);
      const pods = await privacyService.getUserPods(userId);
      console.log('📦 Loaded pods:', pods.length, pods);
      setUserPods(pods);
    } catch (error) {
      console.error('Error loading user pods:', error);
    } finally {
      setPodsLoading(false);
    }
  };

  const loadUserConnections = async () => {
    setConnectionsLoading(true);
    try {
      const connections = await connectionService.getMyConnections(userId);
      setUserConnections(connections);
    } catch (error) {
      console.error('Error loading user connections:', error);
    } finally {
      setConnectionsLoading(false);
    }
  };

  const handleConnect = async () => {
    try {
      if (user) {
        await connectionService.sendConnectionRequest(user.id, userId);
        AppAlert.alert('Success', 'Connection request sent!');
      }
    } catch (error) {
      console.error('Error sending connection request:', error);
      AppAlert.alert('Error', 'Failed to send connection request');
    }
  };

  const handleMessage = () => {
    navigation.navigate('Chat', {
      partnerId: userId,
      partnerEmail: profile?.email || 'User',
    });
  };

  const handleOpenLink = (url: string) => {
    if (!url) return;

    let fullUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      fullUrl = 'https://' + url;
    }

    Linking.openURL(fullUrl).catch((err) => {
      console.error('Error opening link:', err);
      AppAlert.alert('Error', 'Could not open link');
    });
  };

  const handlePodPress = (podId: string) => {
    navigation.navigate('PursuitDetail', { pursuitId: podId });
  };

  if (loading) {
    return (
      <GradientBackground style={styles.loadingContainer}>
        <StatusBar barStyle={isNewTheme ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
        {isNewTheme && <GrainTexture opacity={0.06} />}
        <ActivityIndicator size="large" color={isNewTheme ? colors.accentGreen : legacyColors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>Loading profile...</Text>
      </GradientBackground>
    );
  }

  // Private Profile View - shown when profile access is blocked
  if (!privacyVisibility?.canAccessProfile) {
    return (
      <GradientBackground style={styles.container}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 120 }}>
        <StatusBar barStyle={isNewTheme ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
        {isNewTheme && <GrainTexture opacity={0.06} />}
        <View style={[styles.header, { backgroundColor: isNewTheme ? colors.surface : editorial.bg }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} activeOpacity={0.6} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="arrow-back" size={24} color={isNewTheme ? colors.textPrimary : editorial.ink} />
          </TouchableOpacity>
        </View>

        <View style={styles.privateProfileContainer}>
          {profile?.profile_picture ? (
            <Image source={{ uri: profile.profile_picture }} style={styles.avatarPrivate} />
          ) : (
            <View style={[styles.avatarPlaceholderPrivate, { backgroundColor: colors.surfaceAlt }]}>
              <Ionicons name="lock-closed" size={40} color={colors.textTertiary} />
            </View>
          )}

          <Text style={[styles.name, { color: colors.textPrimary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'PlayfairDisplay_700Bold' }]}>
            {profile?.name || 'User'}
          </Text>

          <View style={[styles.privateInfoBox, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
            <Ionicons name="shield-checkmark" size={32} color={colors.textSecondary} />
            <Text style={[styles.privateTitle, { color: colors.textPrimary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'PlayfairDisplay_700Bold' }]}>Private Profile</Text>
            <Text style={[styles.privateDescription, { color: colors.textSecondary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>
              {`This user has restricted access to ${possessivePronoun(profile?.gender)} profile. Connect with them to see more.`}
            </Text>
          </View>

          {!isConnected && user && (
            <TouchableOpacity style={[styles.connectButtonLarge, { backgroundColor: isNewTheme ? colors.accentGreen : editorial.ink }]} onPress={handleConnect} activeOpacity={0.85}>
              <Ionicons name="person-add" size={20} color={isNewTheme ? colors.background : legacyColors.white} />
              <Text style={[styles.connectButtonLargeText, { color: isNewTheme ? colors.background : legacyColors.white, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>Send Connection Request</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
      </GradientBackground>
    );
  }

  // Locked Section Placeholder Component
  const LockedSection = ({ title }: { title: string }) => (
    <View style={[styles.lockedSection, { backgroundColor: colors.surfaceAlt }]}>
      <Ionicons name="lock-closed" size={40} color={colors.textTertiary} />
      <Text style={[styles.lockedTitle, { color: colors.textSecondary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'PlayfairDisplay_700Bold' }]}>{title}</Text>
      <Text style={[styles.lockedDescription, { color: colors.textTertiary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>This section is private.</Text>
    </View>
  );

  // Social Links Section
  const renderSocialLinks = () => {
    if (!privacyVisibility?.canViewSocials) {
      return <LockedSection title="Social Links" />;
    }

    const hasSocialLinks = profile?.linkedin || profile?.instagram || profile?.github || profile?.facebook || profile?.portfolio_website;
    
    if (!hasSocialLinks) return null;

    return (
      <View style={[styles.section, { backgroundColor: colors.surface }, isNewTheme ? styles.sectionNew : styles.sectionEditorial]}>
        <Text style={[styles.sectionTitle, isNewTheme ? styles.sectionTitleNew : { color: colors.textPrimary, fontFamily: 'PlayfairDisplay_700Bold', letterSpacing: -0.3 }]}>Links</Text>
        {profile?.linkedin && (
          <TouchableOpacity style={[styles.linkItem, { borderBottomColor: colors.border }]} onPress={() => handleOpenLink(profile.linkedin)} activeOpacity={0.6}>
            <Ionicons name="logo-linkedin" size={20} color="#0077b5" />
            <Text style={[styles.linkText, { color: colors.textPrimary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>LinkedIn</Text>
            <Ionicons name="open-outline" size={16} color={colors.textTertiary} style={styles.linkArrow} />
          </TouchableOpacity>
        )}
        {profile?.instagram && (
          <TouchableOpacity style={[styles.linkItem, { borderBottomColor: colors.border }]} onPress={() => handleOpenLink(profile.instagram)} activeOpacity={0.6}>
            <Ionicons name="logo-instagram" size={20} color="#e4405f" />
            <Text style={[styles.linkText, { color: colors.textPrimary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>Instagram</Text>
            <Ionicons name="open-outline" size={16} color={colors.textTertiary} style={styles.linkArrow} />
          </TouchableOpacity>
        )}
        {profile?.facebook && (
          <TouchableOpacity style={[styles.linkItem, { borderBottomColor: colors.border }]} onPress={() => handleOpenLink(profile.facebook)} activeOpacity={0.6}>
            <Ionicons name="logo-facebook" size={20} color="#1877f2" />
            <Text style={[styles.linkText, { color: colors.textPrimary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>Facebook</Text>
            <Ionicons name="open-outline" size={16} color={colors.textTertiary} style={styles.linkArrow} />
          </TouchableOpacity>
        )}
        {profile?.github && (
          <TouchableOpacity style={[styles.linkItem, { borderBottomColor: colors.border }]} onPress={() => handleOpenLink(profile.github)} activeOpacity={0.6}>
            <Ionicons name="logo-github" size={20} color={isNewTheme ? colors.textPrimary : '#333'} />
            <Text style={[styles.linkText, { color: colors.textPrimary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>GitHub</Text>
            <Ionicons name="open-outline" size={16} color={colors.textTertiary} style={styles.linkArrow} />
          </TouchableOpacity>
        )}
        {profile?.portfolio_website && (
          <TouchableOpacity style={[styles.linkItem, { borderBottomColor: colors.border }]} onPress={() => handleOpenLink(profile.portfolio_website)} activeOpacity={0.6}>
            <Ionicons name="globe-outline" size={20} color={isNewTheme ? colors.accentGreen : editorial.carolina} />
            <Text style={[styles.linkText, { color: colors.textPrimary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>Portfolio</Text>
            <Ionicons name="open-outline" size={16} color={colors.textTertiary} style={styles.linkArrow} />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // Pods Tab Content
  const renderPodsTab = () => {
    if (!privacyVisibility?.canViewPodsTab) {
      return <LockedSection title="Pods" />;
    }

    return (
      <View style={styles.podsContainer}>
        {podsLoading ? (
          <View style={styles.podsLoading}>
            <ActivityIndicator size="small" color={isNewTheme ? colors.accentGreen : legacyColors.primary} />
            <Text style={[styles.podsLoadingText, { color: colors.textSecondary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>Loading pods...</Text>
          </View>
        ) : userPods.length === 0 ? (
          <View style={styles.noPods}>
            <Ionicons name="people-outline" size={48} color={colors.textTertiary} />
            <Text style={[styles.noPodsText, { color: colors.textSecondary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>No pods yet</Text>
            <Text style={[styles.noPodsSubtext, { color: colors.textTertiary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>
              This user has not joined any pods yet.
            </Text>
          </View>
        ) : (
          <>
            {/* Current Pods */}
            {userPods.filter(p => !p.status || ['awaiting_kickoff', 'collecting_proposals', 'active'].includes(p.status) || ['active', 'accepted'].includes(p.membership_status)).length > 0 && (
              <>
                <Text style={[styles.podsSectionTitle, isNewTheme ? styles.sectionTitleNew : { color: colors.textPrimary, fontFamily: 'PlayfairDisplay_700Bold' }]}>Current Pods</Text>
                {userPods
                  .filter(p => !p.status || ['awaiting_kickoff', 'collecting_proposals', 'active'].includes(p.status) || ['active', 'accepted'].includes(p.membership_status))
                  .map((pod) => (
                    <TouchableOpacity
                      key={pod.id}
                      style={[styles.podCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                      onPress={() => handlePodPress(pod.id)}
                      activeOpacity={0.7}
                    >
                      {pod.default_picture ? (
                        <Image source={{ uri: pod.default_picture }} style={styles.podImage} />
                      ) : (
                        <PodMemberCollage members={pod.members || []} size={50} borderRadius={10} />
                      )}
                      <View style={styles.podInfo}>
                        <Text style={[styles.podTitle, { color: colors.textPrimary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'PlayfairDisplay_700Bold' }]}>{pod.title}</Text>
                        <View style={styles.podMeta}>
                          {pod.isCreator && (
                            <View style={[styles.creatorBadge, isNewTheme ? { backgroundColor: 'rgba(168, 230, 163, 0.15)' } : { backgroundColor: editorial.goldTint, borderWidth: 1, borderColor: editorial.goldTint }]}>
                              <Ionicons name="star" size={12} color={isNewTheme ? colors.accentGreen : editorial.gold} />
                              <Text style={[styles.creatorBadgeText, { color: isNewTheme ? colors.accentGreen : editorial.gold, fontFamily: isNewTheme ? undefined : 'InterTight_600SemiBold' }]}>Creator</Text>
                            </View>
                          )}
                          <Text style={[styles.podMembers, { color: colors.textSecondary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>
                            {pod.current_members_count || 1} member{(pod.current_members_count || 1) !== 1 ? 's' : ''}
                          </Text>
                        </View>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
                    </TouchableOpacity>
                  ))}
              </>
            )}

            {/* Past Pods */}
            {userPods.filter(p => ['completed', 'archived'].includes(p.status) || ['left', 'removed'].includes(p.membership_status)).length > 0 && (
              <>
                <Text style={[styles.podsSectionTitle, isNewTheme ? [styles.sectionTitleNew, { marginTop: 24 }] : { marginTop: 24, color: colors.textPrimary, fontFamily: 'PlayfairDisplay_700Bold' }]}>Past Pods</Text>
                {userPods
                  .filter(p => ['completed', 'archived'].includes(p.status) || ['left', 'removed'].includes(p.membership_status))
                  .map((pod) => (
                    <TouchableOpacity
                      key={pod.id}
                      style={[styles.podCard, styles.podCardPast, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
                      onPress={() => handlePodPress(pod.id)}
                      activeOpacity={0.7}
                    >
                      {pod.default_picture ? (
                        <Image source={{ uri: pod.default_picture }} style={[styles.podImage, styles.podImagePast]} />
                      ) : (
                        <View style={styles.podImagePast}>
                          <PodMemberCollage members={pod.members || []} size={50} borderRadius={10} />
                        </View>
                      )}
                      <View style={styles.podInfo}>
                        <Text style={[styles.podTitle, styles.podTitlePast, { color: colors.textSecondary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'PlayfairDisplay_700Bold' }]}>{pod.title}</Text>
                        <View style={styles.podMeta}>
                          {pod.isCreator && (
                            <View style={[styles.creatorBadge, styles.creatorBadgePast, { backgroundColor: colors.surfaceAlt }]}>
                              <Ionicons name="star" size={12} color={colors.textTertiary} />
                              <Text style={[styles.creatorBadgeTextPast, { color: colors.textTertiary }]}>Creator</Text>
                            </View>
                          )}
                          <Text style={[styles.podStatus, { color: colors.textTertiary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>
                            {pod.membership_status === 'left' ? 'Left' : pod.membership_status === 'removed' ? 'Removed' : 'Closed'}
                          </Text>
                        </View>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
                    </TouchableOpacity>
                  ))}
              </>
            )}
          </>
        )}
      </View>
    );
  };

  return (
    <GradientBackground style={styles.container}>
    {/* paddingBottom keeps the last items in every tab (About/Pods/Network)
        scrollable above the floating tab bar */}
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 120 }}>
      <StatusBar barStyle={isNewTheme ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      {isNewTheme && <GrainTexture opacity={0.06} />}
      <View style={[styles.header, { backgroundColor: colors.surface }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} activeOpacity={0.6} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Photo gallery — same layout as own profile, sits above the profile section */}
      {(() => {
        const pics: string[] = profile?.profile_pictures?.length > 0
          ? profile.profile_pictures
          : profile?.profile_picture ? [profile.profile_picture] : [];
        const galleryW = Dimensions.get('window').width - 40;
        const galleryH = Dimensions.get('window').height * 0.38;

        if (pics.length === 0) {
          return (
            <View style={{ marginHorizontal: 20, height: galleryH, borderRadius: 16, backgroundColor: isNewTheme ? colors.surfaceAlt : '#F2F0EB', justifyContent: 'center', alignItems: 'center', marginBottom: 12, marginTop: 12 }}>
              <Text style={{ fontSize: 40, color: isNewTheme ? colors.textSecondary : '#8A8A85' }}>{profile?.name?.charAt(0).toUpperCase() || '?'}</Text>
            </View>
          );
        }

        return (
          <View style={{ marginHorizontal: 20, marginBottom: 12, marginTop: 12 }}>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => {
                const idx = Math.round(e.nativeEvent.contentOffset.x / galleryW);
                setActivePhotoIdx(idx);
              }}
              style={{ borderRadius: 16, overflow: 'hidden' }}
            >
              {pics.map((pic: string, i: number) => (
                <Image
                  key={i}
                  source={{ uri: pic }}
                  style={{ width: galleryW, height: galleryH, borderRadius: 16 }}
                  resizeMode="cover"
                />
              ))}
            </ScrollView>
            {pics.length > 1 && (
              <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 8 }}>
                {pics.map((_: string, i: number) => (
                  <View key={i} style={{ width: activePhotoIdx === i ? 18 : 6, height: 6, borderRadius: 3, backgroundColor: activePhotoIdx === i ? (isNewTheme ? colors.accentGreen : editorial.carolina) : (isNewTheme ? colors.border : editorial.hairline) }} />
                ))}
              </View>
            )}
          </View>
        );
      })()}

      <View style={[styles.profileSection, { backgroundColor: isNewTheme ? colors.surface : 'transparent' }]}>
        <Text style={[styles.name, { color: colors.textPrimary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'PlayfairDisplay_700Bold', letterSpacing: isNewTheme ? 0 : -0.5 }]}>
          {profile?.name || 'Name not set'}
        </Text>

        {profile?.bio && <Text style={[styles.bio, { color: colors.textSecondary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>{profile.bio}</Text>}
      </View>

      <View style={styles.actionButtons}>
        {!isConnected && user && (
          <TouchableOpacity style={[styles.connectButton, { backgroundColor: isNewTheme ? colors.accentGreen : editorial.ink }]} onPress={handleConnect} activeOpacity={0.85}>
            <Ionicons name="person-add" size={20} color={isNewTheme ? colors.background : legacyColors.white} />
            <Text style={[styles.connectButtonText, { color: isNewTheme ? colors.background : legacyColors.white, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>Connect</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={[styles.messageButton, { backgroundColor: 'transparent', borderColor: isNewTheme ? colors.accentGreen : editorial.hairline }]} onPress={handleMessage} activeOpacity={0.85}>
          <Ionicons name="chatbubble" size={20} color={isNewTheme ? colors.accentGreen : editorial.ink} />
          <Text style={[styles.messageButtonText, { color: isNewTheme ? colors.accentGreen : editorial.ink, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>Message</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={[styles.tabsContainer, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'about' && styles.tabActive, activeTab === 'about' && { borderBottomColor: isNewTheme ? colors.accentGreen : legacyColors.primary }]}
          onPress={() => setActiveTab('about')} activeOpacity={0.7}
        >
          <Text style={[styles.tabText, { color: colors.textSecondary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }, activeTab === 'about' && { color: isNewTheme ? colors.accentGreen : legacyColors.primary }]}>
            About
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'pods' && styles.tabActive, activeTab === 'pods' && { borderBottomColor: isNewTheme ? colors.accentGreen : legacyColors.primary }]}
          onPress={() => setActiveTab('pods')} activeOpacity={0.7}
        >
          <View style={styles.tabContent}>
            <Text style={[styles.tabText, { color: colors.textSecondary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }, activeTab === 'pods' && { color: isNewTheme ? colors.accentGreen : legacyColors.primary }]} numberOfLines={1}>
              Pods
            </Text>
            {!privacyVisibility?.canViewPodsTab && (
              <Ionicons name="lock-closed" size={12} color={colors.textTertiary} style={{ marginLeft: 4 }} />
            )}
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'connections' && styles.tabActive, activeTab === 'connections' && { borderBottomColor: isNewTheme ? colors.accentGreen : legacyColors.primary }]}
          onPress={() => setActiveTab('connections')} activeOpacity={0.7}
        >
          <View style={styles.tabContent}>
            <Text style={[styles.tabText, { color: colors.textSecondary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }, activeTab === 'connections' && { color: isNewTheme ? colors.accentGreen : legacyColors.primary }]} numberOfLines={1}>
              Network
            </Text>
            {!privacyVisibility?.canViewConnections && (
              <Ionicons name="lock-closed" size={12} color={colors.textTertiary} style={{ marginLeft: 4 }} />
            )}
          </View>
        </TouchableOpacity>
      </View>

      {activeTab === 'about' && (
        <>
          {/* Age & Gender */}
          {(profile?.age || profile?.gender) && (
            <View style={[styles.section, { backgroundColor: colors.surface }, isNewTheme ? styles.sectionNew : styles.sectionEditorial]}>
              {profile?.age && (
                <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.infoLabel, { color: colors.textSecondary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>Age:</Text>
                  <Text style={[styles.infoValue, { color: colors.textPrimary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>{profile.age}</Text>
                </View>
              )}
              {profile?.gender && (
                <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.infoLabel, { color: colors.textSecondary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>Gender:</Text>
                  <Text style={[styles.infoValue, { color: colors.textPrimary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>{profile.gender}</Text>
                </View>
              )}
            </View>
          )}

          {/* Location Section */}
          {(profile?.hometown || profile?.college || profile?.work) && (
            <View style={[styles.section, { backgroundColor: colors.surface }, isNewTheme ? styles.sectionNew : styles.sectionEditorial]}>
              <Text style={[styles.sectionTitle, isNewTheme ? styles.sectionTitleNew : { color: colors.textPrimary, fontFamily: 'PlayfairDisplay_700Bold', letterSpacing: -0.3 }]}>Location</Text>
              {profile?.hometown && (
                <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.infoLabel, { color: colors.textSecondary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>Hometown:</Text>
                  <Text style={[styles.infoValue, { color: colors.textPrimary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>{profile.hometown}</Text>
                </View>
              )}
              {profile?.college && (
                <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.infoLabel, { color: colors.textSecondary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>College:</Text>
                  <Text style={[styles.infoValue, { color: colors.textPrimary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>{profile.college}</Text>
                </View>
              )}
              {profile?.work && (
                <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.infoLabel, { color: colors.textSecondary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>Work:</Text>
                  <Text style={[styles.infoValue, { color: colors.textPrimary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>{profile.work}</Text>
                </View>
              )}
            </View>
          )}

          {/* Bio Section - show separately if not already in header */}
          {profile?.bio && (
            <View style={[styles.section, { backgroundColor: colors.surface }, isNewTheme ? styles.sectionNew : styles.sectionEditorial]}>
              <Text style={[styles.sectionTitle, isNewTheme ? styles.sectionTitleNew : { color: colors.textPrimary, fontFamily: 'PlayfairDisplay_700Bold', letterSpacing: -0.3 }]}>Bio</Text>
              <Text style={[styles.bioText, { color: colors.textSecondary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>{profile.bio}</Text>
            </View>
          )}

          {renderSocialLinks()}
        </>
      )}

      {activeTab === 'pods' && renderPodsTab()}

      {/* Connections Tab */}
      {activeTab === 'connections' && (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
        >
        <View style={styles.tabSection}>
          {!privacyVisibility?.canViewConnections ? (
            <View style={[styles.lockedSection, { backgroundColor: colors.surfaceAlt }]}>
              <Ionicons name="lock-closed" size={48} color={colors.textTertiary} />
              <Text style={[styles.lockedTitle, { color: colors.textSecondary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'PlayfairDisplay_700Bold' }]}>Network</Text>
              <Text style={[styles.lockedDescription, { color: colors.textTertiary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>This section is private.</Text>
            </View>
          ) : connectionsLoading ? (
            <View style={styles.emptyState}>
              <ActivityIndicator size="large" color={isNewTheme ? colors.accentGreen : legacyColors.primary} />
              <Text style={[styles.emptyHint, { color: colors.textTertiary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>Loading network...</Text>
            </View>
          ) : userConnections.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={48} color={colors.textTertiary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>No connections yet</Text>
            </View>
          ) : (
            <ScrollView keyboardShouldPersistTaps="handled">
              {/* Search Bar */}
              <View style={[styles.connectionSearchContainer, isNewTheme ? { backgroundColor: colors.surfaceAlt } : { backgroundColor: 'transparent', borderRadius: 0, borderBottomWidth: 1, borderBottomColor: editorial.hairline }]}>
                <Ionicons name="search" size={18} color={colors.textTertiary} style={styles.connectionSearchIcon} />
                <TextInput
                  style={[styles.connectionSearchInput, { color: colors.textPrimary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}
                  placeholder="Search network..."
                  placeholderTextColor={colors.textTertiary}
                  value={connectionSearchQuery}
                  onChangeText={setConnectionSearchQuery}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {connectionSearchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setConnectionSearchQuery('')}>
                    <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
                  </TouchableOpacity>
                )}
              </View>

              <Text style={[styles.sectionTitle, isNewTheme ? styles.sectionTitleNew : { color: colors.textPrimary, fontFamily: 'PlayfairDisplay_700Bold', letterSpacing: -0.3 }]}>
                Network ({userConnections.length})
              </Text>
              {userConnections
                .filter((conn) => {
                  if (!connectionSearchQuery) return true;
                  const name = (conn.profile?.name || '').toLowerCase();
                  const query = connectionSearchQuery.toLowerCase();
                  // Check if full name starts with query OR any word starts with query
                  if (name.startsWith(query)) return true;
                  const nameParts = name.split(' ');
                  return nameParts.some((part: string) => part.startsWith(query));
                })
                .map((conn) => (
                <TouchableOpacity
                  key={conn.id}
                  style={[styles.connectionCard, { backgroundColor: colors.surface, borderWidth: isNewTheme ? StyleSheet.hairlineWidth : 1, borderColor: isNewTheme ? colors.border : editorial.hairline }]}
                  onPress={() => {
                    // Use otherUserId which is already computed by connectionService
                    if (conn.otherUserId) {
                      navigation.navigate('UserProfile', { userId: conn.otherUserId });
                    }
                  }}
                  activeOpacity={0.7}
                >
                  {conn.profile?.profile_picture ? (
                    <Image source={{ uri: conn.profile.profile_picture }} style={styles.connectionAvatar} />
                  ) : (
                    <View style={[styles.connectionAvatarPlaceholder, { backgroundColor: isNewTheme ? colors.accentGreen : legacyColors.primary }]}>
                      <Text style={[styles.connectionAvatarText, { color: isNewTheme ? colors.background : legacyColors.white }]}>
                        {(conn.profile?.name || '?')[0].toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={styles.connectionInfo}>
                    <Text style={[styles.connectionName, { color: colors.textPrimary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'PlayfairDisplay_700Bold' }]}>{conn.profile?.name || 'Unknown'}</Text>
                    {conn.profile?.bio && (
                      <Text style={[styles.connectionBio, { color: colors.textSecondary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]} numberOfLines={1}>{conn.profile.bio}</Text>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
                </TouchableOpacity>
              ))}
              {connectionSearchQuery && userConnections.filter((conn) => {
                const name = (conn.profile?.name || '').toLowerCase();
                const query = connectionSearchQuery.toLowerCase();
                if (name.startsWith(query)) return true;
                const nameParts = name.split(' ');
                return nameParts.some((part: string) => part.startsWith(query));
              }).length === 0 && (
                <View style={styles.emptyState}>
                  <Text style={[styles.emptyText, { color: colors.textSecondary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>No matches found</Text>
                  <Text style={[styles.emptyHint, { color: colors.textTertiary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>Try a different search term</Text>
                </View>
              )}
            </ScrollView>
          )}
        </View>
        </KeyboardAvoidingView>
      )}
    </ScrollView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#6b7280',
    fontSize: 16,
  },
  header: {
    padding: 20,
    paddingTop: 50,
  },
  backButton: {
    padding: 4,
  },
  profileSection: {
    alignItems: 'center',
    padding: 30,
    paddingTop: 16,
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
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  connectButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  messageButton: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
  },
  messageButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  section: {
    marginTop: 10,
    padding: 20,
  },
  // Pie dark-mode card: surface, radius 16, hairline border, no shadow
  sectionNew: {
    marginHorizontal: 20,
    marginTop: 12,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  // Editorial light-mode card: white surface, hairline border, soft shadow
  sectionEditorial: {
    marginHorizontal: 20,
    marginTop: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: editorial.hairline,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  sectionTitleNew: {
    fontSize: 12,
    fontFamily: 'Sora_600SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: 'rgba(255,255,255,0.45)',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoLabel: {
    fontSize: 16,
    color: '#6b7280',
    width: 110,
  },
  infoValue: {
    fontSize: 16,
    color: '#333',
    flex: 1,
    lineHeight: 22,
  },
  bioText: {
    fontSize: 15,
    color: '#4b5563',
    lineHeight: 22,
  },
  linkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  linkText: {
    fontSize: 15,
    color: '#333',
    marginLeft: 12,
    flex: 1,
  },
  linkArrow: {
    marginLeft: 8,
  },
  // Tabs
  tabsContainer: {
    flexDirection: 'row',
    marginTop: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomWidth: 2,
  },
  tabContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tabText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#6b7280',
  },
  tabTextActive: {
    color: '#0ea5e9',
    fontWeight: '600',
  },
  // Private Profile View
  privateProfileContainer: {
    flex: 1,
    alignItems: 'center',
    padding: 40,
    paddingTop: 20,
  },
  avatarPrivate: {
    width: 100,
    height: 100,
    borderRadius: 50,
    opacity: 0.7,
  },
  avatarPlaceholderPrivate: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  privateInfoBox: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginTop: 24,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  privateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#374151',
    marginTop: 12,
  },
  privateDescription: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  connectButtonLarge: {
    flexDirection: 'row',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 24,
  },
  connectButtonLargeText: {
    fontSize: 16,
    fontWeight: '600',
  },
  // Locked Section
  lockedSection: {
    padding: 40,
    alignItems: 'center',
    marginTop: 10,
    borderRadius: 0,
  },
  lockedTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6b7280',
    marginTop: 12,
  },
  lockedDescription: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 4,
  },
  // Reviews
  reviewsContainer: {
    padding: 16,
  },
  writeReviewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10b981',
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
    gap: 8,
  },
  writeReviewButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  reviewsLoading: {
    alignItems: 'center',
    padding: 40,
  },
  reviewsLoadingText: {
    marginTop: 8,
    color: '#6b7280',
  },
  noReviews: {
    alignItems: 'center',
    padding: 40,
  },
  noReviewsText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6b7280',
    marginTop: 12,
  },
  noReviewsSubtext: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  ratingsCard: {
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  overallRating: {
    alignItems: 'center',
  },
  overallRatingNumber: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#0ea5e9',
  },
  overallRatingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginTop: 4,
  },
  overallRatingCount: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 4,
  },
  reviewCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  reviewerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reviewerAvatarSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0ea5e9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  reviewerAvatarTextSmall: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  reviewerName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
  },
  reviewPursuit: {
    fontSize: 13,
    color: '#0ea5e9',
    marginTop: 2,
  },
  reviewDate: {
    fontSize: 12,
    color: '#9ca3af',
  },
  reviewDescription: {
    fontSize: 14,
    color: '#4b5563',
    lineHeight: 21,
    marginBottom: 12,
  },
  traitRatings: {
    marginTop: 4,
  },
  traitRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  traitInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  traitIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  traitName: {
    fontSize: 14,
    color: '#4b5563',
  },
  traitScore: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0ea5e9',
  },
  // Pods Tab
  podsContainer: {
    padding: 16,
  },
  podsLoading: {
    alignItems: 'center',
    padding: 40,
  },
  podsLoadingText: {
    marginTop: 8,
    color: '#6b7280',
  },
  noPods: {
    alignItems: 'center',
    padding: 40,
  },
  noPodsText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6b7280',
    marginTop: 12,
  },
  noPodsSubtext: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  podsSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 12,
  },
  podCard: {
    flexDirection: 'row',
    alignItems: 'center',
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
  podImage: {
    width: 50,
    height: 50,
    borderRadius: 10,
  },
  podImagePast: {
    opacity: 0.6,
  },
  podImagePlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  podImagePlaceholderPast: {
    backgroundColor: '#e5e7eb',
  },
  podInfo: {
    flex: 1,
    marginLeft: 12,
  },
  podTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
  },
  podTitlePast: {
    color: '#6b7280',
  },
  podMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 8,
  },
  creatorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 2,
  },
  creatorBadgePast: {
    backgroundColor: '#f3f4f6',
  },
  creatorBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#d97706',
  },
  creatorBadgeTextPast: {
    color: '#9ca3af',
  },
  podMembers: {
    fontSize: 13,
    color: '#6b7280',
  },
  podStatus: {
    fontSize: 12,
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  connectionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  connectionAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  connectionAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#0ea5e9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  connectionAvatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  connectionInfo: {
    flex: 1,
    marginLeft: 12,
  },
  connectionName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  connectionBio: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
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
  tabSection: {
    padding: 16,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
    marginTop: 12,
  },
  emptyHint: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 8,
    textAlign: 'center',
  },
});
