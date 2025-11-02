import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert, StatusBar, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { pursuitService } from '../services/pursuitService';
import { useAuth } from '../contexts/AuthContext';
import PursuitDetailScreen from './PursuitDetailScreen';
import { colors, typography, spacing, borderRadius, shadows } from '../theme/designSystem';

interface Props {
  onStartMessage?: (userId: string, userEmail: string) => void;
  onOpenTeamBoard?: (pursuitId: string) => void;
  onOpenMeetingNotes?: (pursuitId: string) => void;
  onOpenCreate?: () => void;
  onOpenCreatorTimeSelection?: (pursuit: any) => void;
  onEditPursuit?: (pursuit: any) => void;
}

export default function FeedScreen({ onStartMessage, onOpenTeamBoard, onOpenMeetingNotes, onOpenCreate, onOpenCreatorTimeSelection, onEditPursuit }: Props) {
  const { user } = useAuth();
  const [pursuits, setPursuits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPursuit, setSelectedPursuit] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'awaiting_kickoff' | 'active'>('all');

  useEffect(() => {
    loadPursuits();
  }, [filter]);

  const loadPursuits = async () => {
    try {
      const filters: any = {};
      if (filter !== 'all') {
        filters.status = filter;
      }
      if (searchQuery) {
        filters.search = searchQuery;
      }
      const data = await pursuitService.getPursuits(filters);
      setPursuits(data);
    } catch (error) {
      console.error('Error loading pursuits:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setLoading(true);
    loadPursuits();
  };

  const onRefresh = () => {
    setLoading(true);
    loadPursuits();
  };

  const handleDelete = async () => {
    Alert.alert(
      'Delete Pursuit',
      'Are you sure you want to delete this pursuit?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await pursuitService.deletePursuit(selectedPursuit.id);
              setSelectedPursuit(null);
              loadPursuits();
              Alert.alert('Success', 'Pursuit deleted!');
            } catch (error: any) {
              Alert.alert('Error', error.message);
            }
          },
        },
      ]
    );
  };

  if (selectedPursuit) {
    return (
      <PursuitDetailScreen
        pursuit={selectedPursuit}
        onBack={() => setSelectedPursuit(null)}
        onDelete={handleDelete}
        onEdit={(pursuit) => {
          setSelectedPursuit(null);
          if (onEditPursuit) {
            onEditPursuit(pursuit);
          }
        }}
        isOwner={selectedPursuit.creator_id === user?.id}
        onViewProfile={(userId, userEmail) => {
          // Profile viewing is handled within PursuitDetailScreen now
        }}
        onSendMessage={(userId, userEmail) => {
          setSelectedPursuit(null);
          if (onStartMessage) {
            onStartMessage(userId, userEmail);
          }
        }}
        onOpenTeamBoard={(pursuitId) => {
          setSelectedPursuit(null);
          if (onOpenTeamBoard) {
            onOpenTeamBoard(pursuitId);
          }
        }}
        onOpenCreatorTimeSelection={(pursuit) => {
          setSelectedPursuit(null);
          if (onOpenCreatorTimeSelection) {
            onOpenCreatorTimeSelection(pursuit);
          }
        }}
      />
    );
  }

  const FilterChip = ({
    label,
    value,
    isActive
  }: {
    label: string;
    value: 'all' | 'awaiting_kickoff' | 'active';
    isActive: boolean
  }) => (
    <TouchableOpacity
      style={[styles.filterChip, isActive && styles.filterChipActive]}
      onPress={() => setFilter(value)}
      activeOpacity={0.7}
    >
      <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />

      {/* Modern Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerGreeting}>Discover</Text>
            <Text style={styles.headerTitle}>Whale Pods</Text>
          </View>
          <TouchableOpacity
            onPress={onOpenCreate}
            style={styles.createButton}
            activeOpacity={0.7}
          >
            <Ionicons name="add-circle" size={32} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Modern Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color={colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search pursuits..."
            placeholderTextColor={colors.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Modern Filter Chips */}
        <View style={styles.filterContainer}>
          <FilterChip label="All" value="all" isActive={filter === 'all'} />
          <FilterChip label="Awaiting Kickoff" value="awaiting_kickoff" isActive={filter === 'awaiting_kickoff'} />
          <FilterChip label="Active" value="active" isActive={filter === 'active'} />
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        <View style={styles.content}>
          {pursuits.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconContainer}>
                <Ionicons name="search-outline" size={48} color={colors.textTertiary} />
              </View>
              <Text style={styles.emptyText}>No pursuits found</Text>
              <Text style={styles.emptySubtext}>Be the first to create one!</Text>
            </View>
          ) : (
            pursuits.map((pursuit) => (
              <TouchableOpacity
                key={pursuit.id}
                style={styles.card}
                onPress={() => setSelectedPursuit(pursuit)}
                activeOpacity={0.7}
              >
                {/* Header with Title and Status */}
                <View style={styles.cardHeader}>
                  <View style={styles.cardTitleContainer}>
                    <Text style={styles.cardTitle} numberOfLines={2}>
                      {pursuit.title}
                    </Text>
                    {pursuit.creator_id === user?.id && (
                      <View style={styles.ownerBadge}>
                        <Text style={styles.ownerBadgeText}>YOURS</Text>
                      </View>
                    )}
                  </View>
                  <View style={[
                    styles.statusBadge,
                    pursuit.status === 'active' ? styles.statusActive : styles.statusPending
                  ]}>
                    <View style={[
                      styles.statusDot,
                      { backgroundColor: pursuit.status === 'active' ? colors.success : colors.warning }
                    ]} />
                    <Text style={[
                      styles.statusText,
                      { color: pursuit.status === 'active' ? colors.success : colors.warning }
                    ]}>
                      {pursuit.status === 'awaiting_kickoff' ? 'Awaiting Kickoff' : 'Active'}
                    </Text>
                  </View>
                </View>

                {/* Description */}
                <Text style={styles.cardDescription} numberOfLines={3}>
                  {pursuit.description}
                </Text>

                {/* Tags */}
                {pursuit.pursuit_types && pursuit.pursuit_types.length > 0 && (
                  <View style={styles.tags}>
                    {pursuit.pursuit_types.slice(0, 3).map((type: string, index: number) => (
                      <View key={index} style={styles.tag}>
                        <Text style={styles.tagText}>{type}</Text>
                      </View>
                    ))}
                    {pursuit.pursuit_types.length > 3 && (
                      <View style={styles.tag}>
                        <Text style={styles.tagText}>+{pursuit.pursuit_types.length - 3}</Text>
                      </View>
                    )}
                  </View>
                )}

                {/* Divider */}
                <View style={styles.divider} />

                {/* Footer */}
                <View style={styles.cardFooter}>
                  <View style={styles.infoRow}>
                    <View style={styles.infoItem}>
                      <View style={styles.iconContainer}>
                        <Ionicons name="people" size={14} color={colors.textSecondary} />
                      </View>
                      <Text style={styles.infoText}>
                        {pursuit.current_members_count}/{pursuit.team_size_max}
                      </Text>
                    </View>

                    {pursuit.location && (
                      <View style={styles.infoItem}>
                        <View style={styles.iconContainer}>
                          <Ionicons name="location" size={14} color={colors.textSecondary} />
                        </View>
                        <Text style={styles.infoText} numberOfLines={1}>
                          {pursuit.location}
                        </Text>
                      </View>
                    )}

                    {pursuit.meeting_cadence && (
                      <View style={styles.infoItem}>
                        <View style={styles.iconContainer}>
                          <Ionicons name="calendar" size={14} color={colors.textSecondary} />
                        </View>
                        <Text style={styles.infoText} numberOfLines={1}>
                          {pursuit.meeting_cadence}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
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
    marginBottom: spacing.lg,
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

  createButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Search Styles
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundSecondary,
    marginHorizontal: spacing.lg,
    paddingHorizontal: spacing.base,
    borderRadius: borderRadius.base,
    height: 44,
    marginBottom: spacing.base,
  },

  searchInput: {
    flex: 1,
    marginLeft: spacing.sm,
    fontSize: typography.fontSize.base,
    color: colors.textPrimary,
  },

  // Filter Styles
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },

  filterChip: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: 'transparent',
  },

  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },

  filterChipText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.textSecondary,
  },

  filterChipTextActive: {
    color: colors.white,
  },

  // Scroll and Content
  scrollView: {
    flex: 1,
  },

  content: {
    padding: spacing.lg,
    paddingBottom: spacing['4xl'],
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

  // Card Styles
  card: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.base,
    ...shadows.base,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },

  cardHeader: {
    marginBottom: spacing.md,
  },

  cardTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },

  cardTitle: {
    flex: 1,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    lineHeight: typography.fontSize.lg * typography.lineHeight.tight,
  },

  ownerBadge: {
    backgroundColor: colors.success,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },

  ownerBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.white,
  },

  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    gap: 4,
    alignSelf: 'flex-start',
  },

  statusPending: {
    backgroundColor: colors.warningLight,
  },

  statusActive: {
    backgroundColor: colors.successLight,
  },

  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  statusText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
  },

  cardDescription: {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
    lineHeight: typography.fontSize.base * typography.lineHeight.normal,
    marginBottom: spacing.md,
  },

  // Tags
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.base,
  },

  tag: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },

  tagText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.primary,
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginBottom: spacing.md,
  },

  // Footer
  cardFooter: {
    gap: spacing.md,
  },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
  },

  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },

  iconContainer: {
    width: 20,
    height: 20,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },

  infoText: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    fontWeight: typography.fontWeight.medium,
  },
});