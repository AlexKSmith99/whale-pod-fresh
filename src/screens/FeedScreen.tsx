import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert, StatusBar, TextInput, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { pursuitService } from '../services/pursuitService';
import { useAuth } from '../contexts/AuthContext';
import PursuitDetailScreen from './PursuitDetailScreen';
import { colors, typography, spacing, borderRadius, shadows } from '../theme/designSystem';

const PURSUIT_TYPES = ['Education', 'Friends', 'Problem', 'Business', 'Lifestyle', 'Hobby', 'Side Hustle', 'Travel', 'Discussion', 'New Endeavor', 'Accountability'];
const DECISION_SYSTEMS = ['Standard Vote', 'Admin Has Ultimate Say', 'Delegated', 'Weighted Voting'];
const STATUS_OPTIONS = ['awaiting_kickoff', 'active', 'completed', 'discontinued'];
const ROLE_OPTIONS = ['Scheduler', 'Individual Contributor', 'Moderator', 'Note Taker', 'Facilitator', 'Coordinator'];

interface Filters {
  status?: string[];
  pursuit_types?: string[];
  categories?: string[];
  location?: string;
  decision_system?: string[];
  roles?: string[];
}

interface Props {
  onStartMessage?: (userId: string, userEmail: string) => void;
  onOpenTeamBoard?: (pursuitId: string) => void;
  onOpenMeetingNotes?: (pursuitId: string) => void;
  onOpenCreate?: () => void;
  onOpenCreatorTimeSelection?: (pursuit: any) => void;
  onEditPursuit?: (pursuit: any) => void;
  onViewProfile?: (userId: string) => void;
}

export default function FeedScreen({ onStartMessage, onOpenTeamBoard, onOpenMeetingNotes, onOpenCreate, onOpenCreatorTimeSelection, onEditPursuit, onViewProfile }: Props) {
  const { user } = useAuth();
  const [pursuits, setPursuits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPursuit, setSelectedPursuit] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<Filters>({});
  const [activeFilterCount, setActiveFilterCount] = useState(0);

  useEffect(() => {
    loadPursuits();
  }, [filters]);

  useEffect(() => {
    // Count active filters
    let count = 0;
    if (filters.status && filters.status.length > 0) count++;
    if (filters.pursuit_types && filters.pursuit_types.length > 0) count++;
    if (filters.decision_system && filters.decision_system.length > 0) count++;
    if (filters.roles && filters.roles.length > 0) count++;
    if (filters.location) count++;
    setActiveFilterCount(count);
  }, [filters]);

  const loadPursuits = async () => {
    try {
      const queryFilters: any = { ...filters };
      if (searchQuery) {
        queryFilters.search = searchQuery;
      }
      const data = await pursuitService.getPursuits(queryFilters);
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

  const toggleFilter = (filterKey: keyof Filters, value: string) => {
    setFilters(prev => {
      const currentValues = prev[filterKey] as string[] | undefined;
      if (!currentValues) {
        return { ...prev, [filterKey]: [value] };
      }
      if (currentValues.includes(value)) {
        const newValues = currentValues.filter(v => v !== value);
        if (newValues.length === 0) {
          const { [filterKey]: removed, ...rest } = prev;
          return rest;
        }
        return { ...prev, [filterKey]: newValues };
      }
      return { ...prev, [filterKey]: [...currentValues, value] };
    });
  };

  const clearAllFilters = () => {
    setFilters({});
  };

  const applyFilters = () => {
    setShowFilters(false);
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
          setSelectedPursuit(null);
          if (onViewProfile) {
            onViewProfile(userId);
          }
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

  const FilterModal = () => (
    <Modal
      visible={showFilters}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowFilters(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Filters</Text>
            <TouchableOpacity onPress={() => setShowFilters(false)}>
              <Ionicons name="close" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
            {/* Status Filter */}
            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>Status</Text>
              <View style={styles.filterOptions}>
                {STATUS_OPTIONS.map((status) => {
                  const isSelected = filters.status?.includes(status);
                  return (
                    <TouchableOpacity
                      key={status}
                      style={[styles.filterOption, isSelected && styles.filterOptionActive]}
                      onPress={() => toggleFilter('status', status)}
                    >
                      <Text style={[styles.filterOptionText, isSelected && styles.filterOptionTextActive]}>
                        {status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </Text>
                      {isSelected && <Ionicons name="checkmark" size={16} color={colors.white} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Pursuit Type Filter */}
            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>Pursuit Type</Text>
              <View style={styles.filterOptions}>
                {PURSUIT_TYPES.map((type) => {
                  const isSelected = filters.pursuit_types?.includes(type);
                  return (
                    <TouchableOpacity
                      key={type}
                      style={[styles.filterOption, isSelected && styles.filterOptionActive]}
                      onPress={() => toggleFilter('pursuit_types', type)}
                    >
                      <Text style={[styles.filterOptionText, isSelected && styles.filterOptionTextActive]}>
                        {type}
                      </Text>
                      {isSelected && <Ionicons name="checkmark" size={16} color={colors.white} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Decision System Filter */}
            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>Decision System</Text>
              <View style={styles.filterOptions}>
                {DECISION_SYSTEMS.map((system) => {
                  const value = system.toLowerCase().replace(/ /g, '_');
                  const isSelected = filters.decision_system?.includes(value);
                  return (
                    <TouchableOpacity
                      key={system}
                      style={[styles.filterOption, isSelected && styles.filterOptionActive]}
                      onPress={() => toggleFilter('decision_system', value)}
                    >
                      <Text style={[styles.filterOptionText, isSelected && styles.filterOptionTextActive]}>
                        {system}
                      </Text>
                      {isSelected && <Ionicons name="checkmark" size={16} color={colors.white} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Roles Filter */}
            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>Looking For Roles</Text>
              <View style={styles.filterOptions}>
                {ROLE_OPTIONS.map((role) => {
                  const isSelected = filters.roles?.includes(role);
                  return (
                    <TouchableOpacity
                      key={role}
                      style={[styles.filterOption, isSelected && styles.filterOptionActive]}
                      onPress={() => toggleFilter('roles', role)}
                    >
                      <Text style={[styles.filterOptionText, isSelected && styles.filterOptionTextActive]}>
                        {role}
                      </Text>
                      {isSelected && <Ionicons name="checkmark" size={16} color={colors.white} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Location Filter */}
            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>Location</Text>
              <TextInput
                style={styles.locationInput}
                placeholder="e.g., Remote, New York"
                value={filters.location || ''}
                onChangeText={(text) => setFilters(prev => ({ ...prev, location: text }))}
              />
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={styles.clearButton}
              onPress={clearAllFilters}
            >
              <Text style={styles.clearButtonText}>Clear All</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.applyButton}
              onPress={applyFilters}
            >
              <Text style={styles.applyButtonText}>Apply Filters</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
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

        {/* Filter Button */}
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setShowFilters(true)}
        >
          <Ionicons name="filter" size={18} color={colors.primary} />
          <Text style={styles.filterButtonText}>Filters</Text>
          {activeFilterCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <FilterModal />

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
                        {(pursuit.current_members_count || 0) + 1}/{pursuit.team_size_max}
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

  // Filter Button Styles
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    marginHorizontal: spacing.lg,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.primary,
    gap: spacing.sm,
    alignSelf: 'flex-start',
  },

  filterButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary,
  },

  filterBadge: {
    backgroundColor: colors.error,
    borderRadius: borderRadius.full,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xs / 2,
  },

  filterBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.white,
  },

  // Filter Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },

  modalContent: {
    backgroundColor: colors.white,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '80%',
    ...shadows.lg,
  },

  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },

  modalTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
  },

  modalScroll: {
    padding: spacing.lg,
  },

  filterSection: {
    marginBottom: spacing.xl,
  },

  filterLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },

  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },

  filterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.borderLight,
    gap: spacing.xs,
  },

  filterOptionActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },

  filterOptionText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.textSecondary,
  },

  filterOptionTextActive: {
    color: colors.white,
  },

  locationInput: {
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: borderRadius.base,
    padding: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.textPrimary,
  },

  modalFooter: {
    flexDirection: 'row',
    padding: spacing.lg,
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },

  clearButton: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.base,
    alignItems: 'center',
  },

  clearButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textSecondary,
  },

  applyButton: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.base,
    alignItems: 'center',
  },

  applyButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
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