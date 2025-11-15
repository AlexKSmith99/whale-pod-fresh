import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert, StatusBar, TextInput, Modal, TouchableWithoutFeedback } from 'react-native';
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
}

export default function FeedScreen({ onStartMessage, onOpenTeamBoard, onOpenMeetingNotes, onOpenCreate }: Props) {
  const { user } = useAuth();
  const [pursuits, setPursuits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPursuit, setSelectedPursuit] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Filter states
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [pursuitTypeFilter, setPursuitTypeFilter] = useState<string[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [subcategoryFilter, setSubcategoryFilter] = useState<string[]>([]);
  const [locationFilter, setLocationFilter] = useState<string[]>([]);
  const [teamSizeFilter, setTeamSizeFilter] = useState<string[]>([]);

  // Modal states
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showPursuitTypeModal, setShowPursuitTypeModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showSubcategoryModal, setShowSubcategoryModal] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showTeamSizeModal, setShowTeamSizeModal] = useState(false);

  useEffect(() => {
    loadPursuits();
  }, [statusFilter, pursuitTypeFilter, categoryFilter, subcategoryFilter, locationFilter, teamSizeFilter]);

  const loadPursuits = async () => {
    try {
      const filters: any = {};

      // Apply status filter
      if (statusFilter.length > 0) {
        filters.status = statusFilter;
      }

      // Apply pursuit type filter
      if (pursuitTypeFilter.length > 0) {
        filters.pursuit_type = pursuitTypeFilter;
      }

      // Apply category filter
      if (categoryFilter.length > 0) {
        filters.category = categoryFilter;
      }

      // Apply subcategory filter
      if (subcategoryFilter.length > 0) {
        filters.subcategory = subcategoryFilter;
      }

      // Apply location filter
      if (locationFilter.length > 0) {
        filters.location = locationFilter;
      }

      // Apply team size filter
      if (teamSizeFilter.length > 0) {
        filters.team_size = teamSizeFilter;
      }

      // Apply search query
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

  // Toggle filter selection
  const toggleFilter = (filterArray: string[], setFilter: React.Dispatch<React.SetStateAction<string[]>>, value: string) => {
    if (filterArray.includes(value)) {
      setFilter(filterArray.filter(item => item !== value));
    } else {
      setFilter([...filterArray, value]);
    }
  };

  // Get active filter count for a category
  const getFilterCount = (filterArray: string[]) => {
    return filterArray.length > 0 ? filterArray.length : null;
  };

  // Clear all filters
  const clearAllFilters = () => {
    setStatusFilter([]);
    setPursuitTypeFilter([]);
    setCategoryFilter([]);
    setSubcategoryFilter([]);
    setLocationFilter([]);
    setTeamSizeFilter([]);
  };

  if (selectedPursuit) {
    return (
      <PursuitDetailScreen
        pursuit={selectedPursuit}
        onBack={() => setSelectedPursuit(null)}
        onDelete={handleDelete}
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
      />
    );
  }

  // Filter Button Component
  const FilterButton = ({
    label,
    count,
    onPress
  }: {
    label: string;
    count: number | null;
    onPress: () => void;
  }) => (
    <TouchableOpacity
      style={[styles.filterButton, count && count > 0 && styles.filterButtonActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.filterButtonText, count && count > 0 && styles.filterButtonTextActive]}>
        {label}
      </Text>
      {count && count > 0 && (
        <View style={styles.filterBadge}>
          <Text style={styles.filterBadgeText}>{count}</Text>
        </View>
      )}
      <Ionicons
        name="chevron-down"
        size={16}
        color={count && count > 0 ? colors.white : colors.textSecondary}
      />
    </TouchableOpacity>
  );

  // Filter Modal Component
  const FilterModal = ({
    visible,
    onClose,
    title,
    options,
    selectedValues,
    onToggle
  }: {
    visible: boolean;
    onClose: () => void;
    title: string;
    options: string[];
    selectedValues: string[];
    onToggle: (value: string) => void;
  }) => (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableWithoutFeedback>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{title}</Text>
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              {options.map((option) => (
                <TouchableOpacity
                  key={option}
                  style={styles.modalOption}
                  onPress={() => onToggle(option)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.modalOptionText}>{option}</Text>
                  {selectedValues.includes(option) && (
                    <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableWithoutFeedback>
      </TouchableOpacity>
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

        {/* Modern Filter Buttons */}
        <ScrollView
          horizontal
          style={styles.filterContainer}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContentContainer}
        >
          <FilterButton
            label="Status"
            count={getFilterCount(statusFilter)}
            onPress={() => setShowStatusModal(true)}
          />
          <FilterButton
            label="Pursuit Type"
            count={getFilterCount(pursuitTypeFilter)}
            onPress={() => setShowPursuitTypeModal(true)}
          />
          <FilterButton
            label="Categories"
            count={getFilterCount(categoryFilter)}
            onPress={() => setShowCategoryModal(true)}
          />
          <FilterButton
            label="Sub-categories"
            count={getFilterCount(subcategoryFilter)}
            onPress={() => setShowSubcategoryModal(true)}
          />
          <FilterButton
            label="Location"
            count={getFilterCount(locationFilter)}
            onPress={() => setShowLocationModal(true)}
          />
          <FilterButton
            label="Team Size"
            count={getFilterCount(teamSizeFilter)}
            onPress={() => setShowTeamSizeModal(true)}
          />
        </ScrollView>

        {/* Clear Filters Button */}
        {(statusFilter.length > 0 || pursuitTypeFilter.length > 0 || categoryFilter.length > 0 ||
          subcategoryFilter.length > 0 || locationFilter.length > 0 || teamSizeFilter.length > 0) && (
          <TouchableOpacity style={styles.clearFiltersButton} onPress={clearAllFilters}>
            <Text style={styles.clearFiltersText}>Clear All Filters</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Filter Modals */}
      <FilterModal
        visible={showStatusModal}
        onClose={() => setShowStatusModal(false)}
        title="Filter by Status"
        options={['Awaiting Kickoff', 'Active']}
        selectedValues={statusFilter}
        onToggle={(value) => toggleFilter(statusFilter, setStatusFilter, value)}
      />

      <FilterModal
        visible={showPursuitTypeModal}
        onClose={() => setShowPursuitTypeModal(false)}
        title="Filter by Pursuit Type"
        options={['Startup', 'Side Project', 'Research', 'Creative', 'Community', 'Learning', 'Other']}
        selectedValues={pursuitTypeFilter}
        onToggle={(value) => toggleFilter(pursuitTypeFilter, setPursuitTypeFilter, value)}
      />

      <FilterModal
        visible={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
        title="Filter by Category"
        options={['Technology', 'Business', 'Creative', 'Social', 'Education', 'Health', 'Other']}
        selectedValues={categoryFilter}
        onToggle={(value) => toggleFilter(categoryFilter, setCategoryFilter, value)}
      />

      <FilterModal
        visible={showSubcategoryModal}
        onClose={() => setShowSubcategoryModal(false)}
        title="Filter by Sub-category"
        options={['Web Development', 'Mobile Development', 'AI/ML', 'Design', 'Marketing', 'Sales', 'Operations', 'Finance', 'Other']}
        selectedValues={subcategoryFilter}
        onToggle={(value) => toggleFilter(subcategoryFilter, setSubcategoryFilter, value)}
      />

      <FilterModal
        visible={showLocationModal}
        onClose={() => setShowLocationModal(false)}
        title="Filter by Location"
        options={['Remote', 'New York', 'San Francisco', 'Los Angeles', 'Chicago', 'Boston', 'Austin', 'Seattle', 'Other']}
        selectedValues={locationFilter}
        onToggle={(value) => toggleFilter(locationFilter, setLocationFilter, value)}
      />

      <FilterModal
        visible={showTeamSizeModal}
        onClose={() => setShowTeamSizeModal(false)}
        title="Filter by Team Size"
        options={['1-2', '3-5', '6-10', '11-20', '20+']}
        selectedValues={teamSizeFilter}
        onToggle={(value) => toggleFilter(teamSizeFilter, setTeamSizeFilter, value)}
      />

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
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },

  filterContentContainer: {
    gap: spacing.sm,
  },

  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.borderLight,
    gap: spacing.xs,
  },

  filterButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },

  filterButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.textSecondary,
  },

  filterButtonTextActive: {
    color: colors.white,
  },

  filterBadge: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.full,
    minWidth: 20,
    height: 20,
    paddingHorizontal: spacing.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },

  filterBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
  },

  clearFiltersButton: {
    marginTop: spacing.sm,
    marginHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },

  clearFiltersText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.error,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },

  modalContent: {
    backgroundColor: colors.white,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '70%',
    paddingBottom: spacing['2xl'],
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
    maxHeight: 400,
  },

  modalOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.base,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },

  modalOptionText: {
    fontSize: typography.fontSize.base,
    color: colors.textPrimary,
    fontWeight: typography.fontWeight.medium,
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
