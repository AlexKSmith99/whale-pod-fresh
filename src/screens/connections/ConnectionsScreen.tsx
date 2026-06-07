import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { connectionService } from '../../services/connectionService';
import { colors as legacyColors, typography, spacing, borderRadius, shadows, editorial } from '../../theme/designSystem';
import { useTheme } from '../../theme/ThemeContext';
import { getThemedStyles } from '../../theme/themedStyles';
import GrainTexture from '../../components/ui/GrainTexture';
import { AppAlert } from '../../components/ui/AppAlert';

export default function ConnectionsScreen({ navigation }: any) {
  const { user } = useAuth();
  const { theme, isNewTheme } = useTheme();
  const colors = theme.colors;
  const themedStyles = getThemedStyles(colors, isNewTheme);

  const [activeTab, setActiveTab] = useState<'connections' | 'pending'>('connections');
  const [connections, setConnections] = useState<any[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [sentRequests, setSentRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const accentColor = isNewTheme ? colors.accentGreen : legacyColors.primary;

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const [connectionsData, pendingData, sentData] = await Promise.all([
        connectionService.getMyConnections(user.id),
        connectionService.getPendingRequests(user.id),
        connectionService.getSentRequests(user.id),
      ]);

      setConnections(connectionsData);
      setPendingRequests(pendingData);
      setSentRequests(sentData);
    } catch (error: any) {
      console.error('Error loading connections:', error);
      AppAlert.alert('Error', 'Failed to load connections');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleAccept = async (connectionId: string) => {
    try {
      await connectionService.acceptConnection(connectionId);
      AppAlert.alert('Success', 'Connection request accepted!');
      loadData();
    } catch (error: any) {
      AppAlert.alert('Error', error.message);
    }
  };

  const handleReject = async (connectionId: string) => {
    try {
      await connectionService.rejectConnection(connectionId);
      AppAlert.alert('Success', 'Connection request rejected');
      loadData();
    } catch (error: any) {
      AppAlert.alert('Error', error.message);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <StatusBar barStyle={isNewTheme ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
        {isNewTheme && <GrainTexture opacity={0.06} />}
        <ActivityIndicator size="large" color={accentColor} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isNewTheme ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      {isNewTheme && <GrainTexture opacity={0.06} />}
      <View style={[styles.header, { backgroundColor: isNewTheme ? colors.surface : editorial.bg, borderBottomColor: colors.border, borderBottomWidth: isNewTheme ? 1 : 0 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} activeOpacity={0.6} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={24} color={isNewTheme ? colors.textPrimary : editorial.ink} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: isNewTheme ? colors.textPrimary : editorial.ink, fontFamily: isNewTheme ? 'Sora_700Bold' : 'PlayfairDisplay_700Bold', letterSpacing: isNewTheme ? -0.3 : -0.5 }]}>Connections</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={[styles.tabsContainer, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'connections' && [styles.activeTab, { borderBottomColor: accentColor }]]}
          onPress={() => setActiveTab('connections')}
        >
          <Text style={[styles.tabText, { color: colors.textSecondary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }, activeTab === 'connections' && [styles.activeTabText, { color: accentColor }]]}>
            My Connections ({connections.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'pending' && [styles.activeTab, { borderBottomColor: accentColor }]]}
          onPress={() => setActiveTab('pending')}
        >
          <Text style={[styles.tabText, { color: colors.textSecondary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }, activeTab === 'pending' && [styles.activeTabText, { color: accentColor }]]}>
            Requests ({pendingRequests.length + sentRequests.length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={accentColor}
            colors={[accentColor]}
          />
        }
      >
        {activeTab === 'connections' ? (
          <View style={styles.section}>
            {connections.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="people-outline" size={64} color={colors.textTertiary} />
                <Text style={[styles.emptyText, { color: colors.textSecondary, fontFamily: isNewTheme ? 'Sora_700Bold' : 'PlayfairDisplay_700Bold' }]}>No connections yet</Text>
                <Text style={[styles.emptySubtext, { color: colors.textTertiary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>Connect with people you work with</Text>
              </View>
            ) : (
              connections.map((connection) => (
                <TouchableOpacity
                  key={connection.id}
                  style={[styles.connectionCard, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }, isNewTheme && styles.cardFlat]}
                  onPress={() => navigation.navigate('UserProfile', { userId: connection.otherUserId })}
                  activeOpacity={0.7}
                >
                  {connection.profile?.profile_picture ? (
                    <Image
                      source={{ uri: connection.profile.profile_picture }}
                      style={styles.avatar}
                    />
                  ) : (
                    <View style={[styles.avatar, { backgroundColor: accentColor }]}>
                      <Text style={[styles.avatarText, { color: isNewTheme ? colors.background : colors.white }]}>
                        {connection.profile?.name?.charAt(0).toUpperCase() || '?'}
                      </Text>
                    </View>
                  )}
                  <View style={styles.connectionInfo}>
                    <Text style={[styles.connectionName, { color: colors.textPrimary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'PlayfairDisplay_700Bold' }]}>
                      {connection.profile?.name || 'Unknown'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
                </TouchableOpacity>
              ))
            )}
          </View>
        ) : (
          <View style={styles.section}>
            {pendingRequests.length === 0 && sentRequests.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="mail-outline" size={64} color={colors.textTertiary} />
                <Text style={[styles.emptyText, { color: colors.textSecondary, fontFamily: isNewTheme ? 'Sora_700Bold' : 'PlayfairDisplay_700Bold' }]}>No pending requests</Text>
              </View>
            ) : (
              <>
                {pendingRequests.length > 0 && (
                  <>
                    <Text style={[styles.sectionTitle, { fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold', textTransform: 'uppercase', fontSize: isNewTheme ? 12 : 11, letterSpacing: isNewTheme ? 1 : 0.6, color: isNewTheme ? 'rgba(255,255,255,0.45)' : editorial.muted }]}>Received Requests</Text>
                    {pendingRequests.map((request) => (
                      <View key={request.id} style={[styles.requestCard, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }, isNewTheme && styles.cardFlat]}>
                        <TouchableOpacity
                          style={styles.requestInfo}
                          onPress={() => navigation.navigate('UserProfile', { userId: request.user_id_1 })}
                          activeOpacity={0.7}
                        >
                          {request.profile?.profile_picture ? (
                            <Image
                              source={{ uri: request.profile.profile_picture }}
                              style={styles.avatar}
                            />
                          ) : (
                            <View style={[styles.avatar, { backgroundColor: accentColor }]}>
                              <Text style={[styles.avatarText, { color: isNewTheme ? colors.background : colors.white }]}>
                                {request.profile?.name?.charAt(0).toUpperCase() || '?'}
                              </Text>
                            </View>
                          )}
                          <View style={styles.requestDetails}>
                            <Text style={[styles.requestName, { color: colors.textPrimary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'PlayfairDisplay_700Bold' }]}>
                              {request.profile?.name || 'Unknown'}
                            </Text>
                          </View>
                        </TouchableOpacity>
                        <View style={styles.requestActions}>
                          <TouchableOpacity
                            style={[styles.acceptButton, { backgroundColor: isNewTheme ? colors.accentGreen : editorial.ink }]}
                            onPress={() => handleAccept(request.id)}
                            activeOpacity={0.85}
                          >
                            <Text style={[styles.acceptButtonText, { color: isNewTheme ? colors.background : colors.white, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>Accept</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.rejectButton, isNewTheme ? { backgroundColor: 'transparent', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border } : { backgroundColor: 'transparent', borderWidth: 1, borderColor: editorial.hairline }]}
                            onPress={() => handleReject(request.id)}
                            activeOpacity={0.85}
                          >
                            <Text style={[styles.rejectButtonText, { color: isNewTheme ? colors.textSecondary : editorial.red, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>Decline</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                  </>
                )}

                {sentRequests.length > 0 && (
                  <>
                    <Text style={[styles.sectionTitle, { marginTop: pendingRequests.length > 0 ? 20 : 0, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold', textTransform: 'uppercase', fontSize: isNewTheme ? 12 : 11, letterSpacing: isNewTheme ? 1 : 0.6, color: isNewTheme ? 'rgba(255,255,255,0.45)' : editorial.muted }]}>
                      Sent Requests
                    </Text>
                    {sentRequests.map((request) => (
                      <TouchableOpacity
                        key={request.id}
                        style={[styles.sentRequestCard, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }, isNewTheme && styles.cardFlat]}
                        onPress={() => navigation.navigate('UserProfile', { userId: request.user_id_2 })}
                        activeOpacity={0.7}
                      >
                        {request.profile?.profile_picture ? (
                          <Image
                            source={{ uri: request.profile.profile_picture }}
                            style={styles.avatar}
                          />
                        ) : (
                          <View style={[styles.avatar, { backgroundColor: accentColor }]}>
                            <Text style={[styles.avatarText, { color: isNewTheme ? colors.background : colors.white }]}>
                              {request.profile?.name?.charAt(0).toUpperCase() ||
                               request.profile?.email?.charAt(0).toUpperCase() || '?'}
                            </Text>
                          </View>
                        )}
                        <View style={styles.connectionInfo}>
                          <Text style={[styles.connectionName, { color: colors.textPrimary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'PlayfairDisplay_700Bold' }]}>
                            {request.profile?.name || 'Unknown'}
                          </Text>
                          <Text style={[styles.sentStatus, { color: isNewTheme ? colors.textTertiary : editorial.muted, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>Pending</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
                      </TouchableOpacity>
                    ))}
                  </>
                )}
              </>
            )}
          </View>
        )}
      </ScrollView>
    </View>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    paddingTop: 50,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
  },
  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.base,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomWidth: 2,
  },
  tabText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  activeTabText: {
    fontWeight: typography.fontWeight.bold,
  },
  content: {
    flex: 1,
  },
  section: {
    padding: spacing.base,
  },
  sectionTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.md,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    marginTop: spacing.base,
  },
  emptySubtext: {
    fontSize: typography.fontSize.sm,
    marginTop: spacing.sm,
  },
  cardFlat: {
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
    borderRadius: 16,
  },
  connectionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.base,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  avatarText: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
  },
  connectionInfo: {
    flex: 1,
  },
  connectionName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: 2,
  },
  requestCard: {
    padding: spacing.base,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  requestInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  requestDetails: {
    flex: 1,
  },
  requestName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: 2,
  },
  requestActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  acceptButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.base,
    alignItems: 'center',
  },
  acceptButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  rejectButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.base,
    alignItems: 'center',
  },
  rejectButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  sentRequestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.base,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  sentStatus: {
    fontSize: typography.fontSize.sm,
    fontStyle: 'italic',
  },
});
