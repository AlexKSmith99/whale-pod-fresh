import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert, StatusBar, TextInput, Modal, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { pursuitService } from '../services/pursuitService';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import { HapticManager } from '../services/hapticManager';
import GrainTexture from '../components/ui/GrainTexture';
import PursuitDetailScreen from './PursuitDetailScreen';
import { colors as legacyColors, typography, spacing, borderRadius, shadows } from '../theme/designSystem';

// Location suggestions for autocomplete
const LOCATION_SUGGESTIONS = [
  'Remote', 'Hybrid',
  'New York, NY', 'Los Angeles, CA', 'Chicago, IL', 'Houston, TX', 'Phoenix, AZ',
  'Philadelphia, PA', 'San Antonio, TX', 'San Diego, CA', 'Dallas, TX', 'San Jose, CA',
  'Austin, TX', 'Jacksonville, FL', 'Fort Worth, TX', 'Columbus, OH', 'Charlotte, NC',
  'San Francisco, CA', 'Indianapolis, IN', 'Seattle, WA', 'Denver, CO', 'Washington, DC',
  'Boston, MA', 'El Paso, TX', 'Nashville, TN', 'Detroit, MI', 'Oklahoma City, OK',
  'Portland, OR', 'Las Vegas, NV', 'Memphis, TN', 'Louisville, KY', 'Baltimore, MD',
  'Milwaukee, WI', 'Albuquerque, NM', 'Tucson, AZ', 'Fresno, CA', 'Mesa, AZ',
  'Sacramento, CA', 'Atlanta, GA', 'Kansas City, MO', 'Colorado Springs, CO', 'Omaha, NE',
  'Raleigh, NC', 'Miami, FL', 'Long Beach, CA', 'Virginia Beach, VA', 'Oakland, CA',
  'Minneapolis, MN', 'Tulsa, OK', 'Tampa, FL', 'Arlington, TX', 'New Orleans, LA',
  'Wichita, KS', 'Cleveland, OH', 'Bakersfield, CA', 'Aurora, CO', 'Anaheim, CA',
  'Honolulu, HI', 'Santa Ana, CA', 'Riverside, CA', 'Corpus Christi, TX', 'Lexington, KY',
  'Henderson, NV', 'Stockton, CA', 'Saint Paul, MN', 'Cincinnati, OH', 'St. Louis, MO',
  'Pittsburgh, PA', 'Greensboro, NC', 'Lincoln, NE', 'Anchorage, AK', 'Plano, TX',
  'Orlando, FL', 'Irvine, CA', 'Newark, NJ', 'Durham, NC', 'Chula Vista, CA',
  'Toledo, OH', 'Fort Wayne, IN', 'St. Petersburg, FL', 'Laredo, TX', 'Jersey City, NJ',
  'Chandler, AZ', 'Madison, WI', 'Lubbock, TX', 'Scottsdale, AZ', 'Reno, NV',
  'Buffalo, NY', 'Gilbert, AZ', 'Glendale, AZ', 'North Las Vegas, NV', 'Winston-Salem, NC',
  'Chesapeake, VA', 'Norfolk, VA', 'Fremont, CA', 'Garland, TX', 'Irving, TX',
  'Hialeah, FL', 'Richmond, VA', 'Boise, ID', 'Spokane, WA', 'Baton Rouge, LA',
];

interface Props {
  onStartMessage?: (userId: string, userEmail: string) => void;
  onOpenTeamBoard?: (pursuitId: string) => void;
  onOpenMeetingNotes?: (pursuitId: string) => void;
  onOpenCreate?: () => void;
}

export default function FeedScreen({ onStartMessage, onOpenTeamBoard, onOpenMeetingNotes, onOpenCreate }: Props) {
  const { user } = useAuth();
  const { theme, toggleTheme, isNewTheme } = useTheme();
  const colors = theme.colors;
  const [pursuits, setPursuits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPursuit, setSelectedPursuit] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Filter states
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [pursuitTypeFilter, setPursuitTypeFilter] = useState<string[]>([]);
  const [keywordFilter, setKeywordFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState<string[]>([]);
  const [teamSizeFilter, setTeamSizeFilter] = useState<string[]>([]);

  // Sort states
  const [sortBy, setSortBy] = useState<string>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Modal states
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showPursuitTypeModal, setShowPursuitTypeModal] = useState(false);
  const [showKeywordModal, setShowKeywordModal] = useState(false);
  const [tempKeyword, setTempKeyword] = useState('');
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [locationSearchText, setLocationSearchText] = useState('');
  const [tempSelectedLocations, setTempSelectedLocations] = useState<string[]>([]);
  const [showTeamSizeModal, setShowTeamSizeModal] = useState(false);
  const [showDateSortModal, setShowDateSortModal] = useState(false);

  useEffect(() => {
    // Load pursuits whenever filters or sort changes
    loadPursuits();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, pursuitTypeFilter, keywordFilter, locationFilter, teamSizeFilter, sortBy, sortOrder]);
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

      // Apply keyword filter (searches title, description, category)
      if (keywordFilter.trim()) {
        filters.keyword = keywordFilter.trim();
      }

      // Apply location filter (multiple locations)
      if (locationFilter.length > 0) {
        filters.locationSearch = locationFilter;
      }

      // Apply team size filter
      if (teamSizeFilter.length > 0) {
        filters.team_size = teamSizeFilter;
      }

      // Apply search query
      if (searchQuery) {
        filters.search = searchQuery;
      }

      // Apply sorting
      filters.sortBy = sortBy;
      filters.sortOrder = sortOrder;

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

  // Toggle filter selection - memoized to prevent modal re-renders
  const toggleFilter = useCallback((filterArray: string[], setFilter: React.Dispatch<React.SetStateAction<string[]>>, value: string) => {
    if (filterArray.includes(value)) {
      setFilter(filterArray.filter(item => item !== value));
    } else {
      setFilter([...filterArray, value]);
    }
  }, []);

  // Get active filter count for a category
  const getFilterCount = (filterArray: string[]) => {
    return filterArray.length > 0 ? filterArray.length : null;
  };

  // Clear all filters
  const clearAllFilters = () => {
    setStatusFilter([]);
    setPursuitTypeFilter([]);
    setKeywordFilter('');
    setLocationFilter([]);
    setTeamSizeFilter([]);
  };

  // Toggle location selection
  const toggleLocationSelection = (location: string) => {
    if (tempSelectedLocations.includes(location)) {
      setTempSelectedLocations(tempSelectedLocations.filter(l => l !== location));
    } else {
      setTempSelectedLocations([...tempSelectedLocations, location]);
    }
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
  }) => {
    const isActive = count !== null && count > 0;
    return (
      <TouchableOpacity
        style={[
          dynamicStyles.filterButton,
          isActive && dynamicStyles.filterButtonActive
        ]}
        onPress={() => {
          HapticManager.selection();
          onPress();
        }}
        activeOpacity={0.7}
      >
        <Text style={[
          dynamicStyles.filterButtonText,
          isActive && { color: isNewTheme ? colors.background : legacyColors.white }
        ]}>
          {label}
        </Text>
        {isActive && (
          <View style={[styles.filterBadge, { backgroundColor: isNewTheme ? colors.background : legacyColors.white }]}>
            <Text style={[styles.filterBadgeText, { color: isNewTheme ? colors.accentGreen : legacyColors.primary }]}>{count}</Text>
          </View>
        )}
        <Ionicons
          name="chevron-down"
          size={16}
          color={isActive ? (isNewTheme ? colors.background : legacyColors.white) : colors.textSecondary}
        />
      </TouchableOpacity>
    );
  };

  // Filter Modal Component - SIMPLIFIED: Only X button closes modal
  const FilterModal = React.memo(({
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
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <TouchableOpacity
        style={[styles.modalOverlay, { backgroundColor: isNewTheme ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.5)' }]}
        activeOpacity={1}
        onPress={(e) => e.stopPropagation()}
      >
        <TouchableOpacity
          style={[styles.modalContent, { backgroundColor: isNewTheme ? colors.surface : legacyColors.white }]}
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
              <Ionicons name="close" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
            {options.map((option) => (
              <TouchableOpacity
                key={option}
                style={[styles.modalOption, { borderBottomColor: colors.border }]}
                onPress={() => {
                  HapticManager.selection();
                  onToggle(option);
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.modalOptionText, { color: colors.textPrimary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>{option}</Text>
                {selectedValues.includes(option) && (
                  <Ionicons name="checkmark-circle" size={24} color={isNewTheme ? colors.accentGreen : legacyColors.primary} />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  ));

  // Dynamic styles based on theme
  const dynamicStyles = {
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      backgroundColor: isNewTheme ? colors.surface : colors.surface,
      paddingTop: 50,
      paddingBottom: spacing.base,
      borderBottomWidth: isNewTheme ? 1 : 0,
      borderBottomColor: colors.border,
    },
    headerGreeting: {
      fontSize: typography.fontSize.sm,
      color: colors.textSecondary,
      fontWeight: typography.fontWeight.medium as '500',
      marginBottom: spacing.xs,
      fontFamily: isNewTheme ? 'Aboreto_400Regular' : undefined,
      textTransform: isNewTheme ? 'uppercase' as const : 'none' as const,
      letterSpacing: isNewTheme ? 1 : 0,
    },
    headerTitle: {
      fontSize: typography.fontSize['3xl'],
      fontWeight: typography.fontWeight.bold as '700',
      color: isNewTheme ? colors.accentGreen : colors.textPrimary,
      fontFamily: 'NothingYouCouldDo_400Regular',
    },
    searchContainer: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      backgroundColor: isNewTheme ? colors.surfaceAlt : colors.backgroundSecondary,
      marginHorizontal: spacing.lg,
      paddingHorizontal: spacing.base,
      borderRadius: borderRadius.base,
      height: 44,
      marginBottom: spacing.base,
      borderWidth: isNewTheme ? 1 : 0,
      borderColor: colors.border,
    },
    searchInput: {
      flex: 1,
      marginLeft: spacing.sm,
      fontSize: typography.fontSize.base,
      color: colors.textPrimary,
      fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined,
    },
    card: {
      backgroundColor: isNewTheme ? colors.surface : legacyColors.white,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      marginBottom: spacing.base,
      ...shadows.base,
      shadowColor: isNewTheme ? '#000' : '#000',
      borderWidth: 1,
      borderColor: isNewTheme ? colors.border : legacyColors.borderLight,
    },
    cardTitle: {
      flex: 1,
      fontSize: typography.fontSize.lg,
      fontWeight: typography.fontWeight.semibold as '600',
      color: colors.textPrimary,
      lineHeight: typography.fontSize.lg * typography.lineHeight.tight,
      fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined,
    },
    cardDescription: {
      fontSize: typography.fontSize.base,
      color: colors.textSecondary,
      lineHeight: typography.fontSize.base * typography.lineHeight.normal,
      marginBottom: spacing.md,
      fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined,
    },
    filterButton: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      paddingHorizontal: spacing.base,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.full,
      backgroundColor: isNewTheme ? colors.surfaceAlt : legacyColors.backgroundSecondary,
      borderWidth: 1,
      borderColor: isNewTheme ? colors.border : legacyColors.borderLight,
      gap: spacing.xs,
    },
    filterButtonActive: {
      backgroundColor: isNewTheme ? colors.accentGreen : legacyColors.primary,
      borderColor: isNewTheme ? colors.accentGreen : legacyColors.primary,
    },
    filterButtonText: {
      fontSize: typography.fontSize.sm,
      fontWeight: typography.fontWeight.medium as '500',
      color: colors.textSecondary,
      fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined,
    },
    tag: {
      backgroundColor: isNewTheme ? 'rgba(168, 230, 163, 0.15)' : legacyColors.primaryLight,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: borderRadius.full,
      borderWidth: isNewTheme ? 1 : 0,
      borderColor: isNewTheme ? colors.accentGreenMuted : 'transparent',
    },
    tagText: {
      fontSize: typography.fontSize.xs,
      fontWeight: typography.fontWeight.medium as '500',
      color: isNewTheme ? colors.accentGreen : legacyColors.primary,
      fontFamily: isNewTheme ? 'Aboreto_400Regular' : undefined,
      textTransform: isNewTheme ? 'uppercase' as const : 'none' as const,
      letterSpacing: isNewTheme ? 0.5 : 0,
    },
  };

  return (
    <View style={dynamicStyles.container}>
      <StatusBar barStyle={isNewTheme ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

      {/* Grain texture overlay for new theme */}
      {isNewTheme && <GrainTexture opacity={0.06} />}

      {/* Modern Header */}
      <View style={dynamicStyles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={dynamicStyles.headerGreeting}>Discover</Text>
            <Text style={dynamicStyles.headerTitle}>Whale Pods</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {/* Theme Toggle Button */}
            <TouchableOpacity
              onPress={() => {
                HapticManager.themeToggle();
                toggleTheme();
              }}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: isNewTheme ? colors.accentGreen : legacyColors.primary,
                justifyContent: 'center',
                alignItems: 'center',
              }}
              activeOpacity={0.7}
            >
              <Ionicons
                name={isNewTheme ? 'sunny' : 'moon'}
                size={20}
                color={isNewTheme ? colors.background : '#fff'}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onOpenCreate}
              style={styles.createButton}
              activeOpacity={0.7}
            >
              <Ionicons name="add-circle" size={32} color={isNewTheme ? colors.accentGreen : legacyColors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Modern Search Bar */}
        <View style={dynamicStyles.searchContainer}>
          <Ionicons name="search" size={18} color={colors.textTertiary} />
          <TextInput
            style={dynamicStyles.searchInput}
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
            label={keywordFilter ? `"${keywordFilter}"` : "Keyword"}
            count={keywordFilter ? 1 : null}
            onPress={() => {
              setTempKeyword(keywordFilter);
              setShowKeywordModal(true);
            }}
          />
          <FilterButton
            label="Location"
            count={getFilterCount(locationFilter)}
            onPress={() => {
              setTempSelectedLocations([...locationFilter]);
              setLocationSearchText('');
              setShowLocationModal(true);
            }}
          />
          <FilterButton
            label="Team Size"
            count={getFilterCount(teamSizeFilter)}
            onPress={() => setShowTeamSizeModal(true)}
          />
          <TouchableOpacity
            style={[dynamicStyles.filterButton, {
              backgroundColor: isNewTheme ? 'rgba(168, 230, 163, 0.15)' : legacyColors.primaryLight,
              borderColor: isNewTheme ? colors.accentGreen : legacyColors.primary,
            }]}
            onPress={() => {
              HapticManager.selection();
              setShowDateSortModal(true);
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="swap-vertical" size={16} color={isNewTheme ? colors.accentGreen : legacyColors.primary} />
            <Text style={[dynamicStyles.filterButtonText, { color: isNewTheme ? colors.accentGreen : legacyColors.primary }]}>
              {sortBy === 'created_at' ? 'Date Posted' : 'Kickoff Date'}
            </Text>
            <Ionicons
              name={sortOrder === 'desc' ? 'arrow-down' : 'arrow-up'}
              size={14}
              color={isNewTheme ? colors.accentGreen : legacyColors.primary}
            />
          </TouchableOpacity>
        </ScrollView>

        {/* Clear Filters Button */}
        {(statusFilter.length > 0 || pursuitTypeFilter.length > 0 || keywordFilter ||
          locationFilter.length > 0 || teamSizeFilter.length > 0) && (
          <TouchableOpacity style={styles.clearFiltersButton} onPress={() => {
            HapticManager.lightTap();
            clearAllFilters();
          }}>
            <Text style={[styles.clearFiltersText, { color: colors.error }]}>Clear All Filters</Text>
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
        options={['Education', 'Friends', 'Problem', 'Business', 'Lifestyle', 'Hobby', 'Fitness', 'Side Hustle', 'Travel', 'Discussion', 'New Endeavor', 'Accountability', 'Networking', 'Health', 'Personal Growth', 'Career Growth', 'Hangout', 'Socialize', 'Explore', 'Nature', 'Social Media', 'Spiritual', 'Religion', 'Mental Health', 'Art', 'Music', 'Sport']}
        selectedValues={pursuitTypeFilter}
        onToggle={(value) => toggleFilter(pursuitTypeFilter, setPursuitTypeFilter, value)}
      />

      {/* Keyword Search Modal */}
      <Modal
        visible={showKeywordModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowKeywordModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Search by Keyword</Text>
              <TouchableOpacity onPress={() => setShowKeywordModal(false)}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.keywordInput}
              placeholder="Enter keyword to search..."
              placeholderTextColor={colors.textTertiary}
              value={tempKeyword}
              onChangeText={setTempKeyword}
              autoFocus
            />
            <View style={styles.keywordButtonRow}>
              <TouchableOpacity
                style={styles.keywordClearButton}
                onPress={() => {
                  setTempKeyword('');
                  setKeywordFilter('');
                  setShowKeywordModal(false);
                }}
              >
                <Text style={styles.keywordClearButtonText}>Clear</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.keywordApplyButton}
                onPress={() => {
                  setKeywordFilter(tempKeyword);
                  setShowKeywordModal(false);
                }}
              >
                <Text style={styles.keywordApplyButtonText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Location Search Modal with Multi-Select */}
      <Modal
        visible={showLocationModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowLocationModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.locationModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter by Location</Text>
              <TouchableOpacity onPress={() => setShowLocationModal(false)}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {/* Selected Locations Chips */}
            {tempSelectedLocations.length > 0 && (
              <View style={styles.selectedLocationsContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.selectedLocationsScroll}>
                  {tempSelectedLocations.map((loc, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.selectedLocationChip}
                      onPress={() => toggleLocationSelection(loc)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.selectedLocationChipText}>{loc}</Text>
                      <Ionicons name="close-circle" size={16} color={colors.white} />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            <View style={styles.locationInputContainer}>
              <Ionicons name="search" size={18} color={colors.textTertiary} style={styles.locationSearchIcon} />
              <TextInput
                style={styles.locationSearchInput}
                placeholder="Search cities, states, or 'Remote'..."
                placeholderTextColor={colors.textTertiary}
                value={locationSearchText}
                onChangeText={setLocationSearchText}
                autoFocus
              />
              {locationSearchText.length > 0 && (
                <TouchableOpacity onPress={() => setLocationSearchText('')}>
                  <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
                </TouchableOpacity>
              )}
            </View>
            
            {/* Suggestions List */}
            <ScrollView 
              style={styles.locationSuggestionsList} 
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={true}
            >
              {LOCATION_SUGGESTIONS
                .filter(loc => loc.toLowerCase().includes(locationSearchText.toLowerCase()))
                .slice(0, 20)
                .map((suggestion, index) => {
                  const isSelected = tempSelectedLocations.includes(suggestion);
                  return (
                    <TouchableOpacity
                      key={index}
                      style={[styles.locationSuggestionItem, isSelected && styles.locationSuggestionItemSelected]}
                      onPress={() => toggleLocationSelection(suggestion)}
                      activeOpacity={0.7}
                    >
                      <Ionicons 
                        name={suggestion === 'Remote' ? 'globe-outline' : suggestion === 'Hybrid' ? 'git-merge-outline' : 'location-outline'} 
                        size={18} 
                        color={isSelected ? colors.primary : colors.textSecondary} 
                      />
                      <Text style={[styles.locationSuggestionText, isSelected && styles.locationSuggestionTextSelected]}>
                        {suggestion}
                      </Text>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                      )}
                    </TouchableOpacity>
                  );
                })
              }
              {/* Custom location option */}
              {locationSearchText.length > 0 && 
                !LOCATION_SUGGESTIONS.some(loc => loc.toLowerCase() === locationSearchText.toLowerCase()) &&
                !tempSelectedLocations.includes(locationSearchText) && (
                <TouchableOpacity
                  style={[styles.locationSuggestionItem, styles.locationCustomItem]}
                  onPress={() => {
                    toggleLocationSelection(locationSearchText);
                    setLocationSearchText('');
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
                  <Text style={[styles.locationSuggestionText, styles.locationCustomText]}>
                    Add "{locationSearchText}"
                  </Text>
                </TouchableOpacity>
              )}
            </ScrollView>

            <View style={styles.keywordButtonRow}>
              <TouchableOpacity
                style={styles.keywordClearButton}
                onPress={() => {
                  setTempSelectedLocations([]);
                  setLocationSearchText('');
                  setLocationFilter([]);
                  setShowLocationModal(false);
                }}
              >
                <Text style={styles.keywordClearButtonText}>Clear All</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.keywordApplyButton}
                onPress={() => {
                  setLocationFilter(tempSelectedLocations);
                  setShowLocationModal(false);
                }}
              >
                <Text style={styles.keywordApplyButtonText}>
                  Apply{tempSelectedLocations.length > 0 ? ` (${tempSelectedLocations.length})` : ''}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <FilterModal
        visible={showTeamSizeModal}
        onClose={() => setShowTeamSizeModal(false)}
        title="Filter by Team Size"
        options={['1-2', '3-5', '6-10', '11-20', '20+']}
        selectedValues={teamSizeFilter}
        onToggle={(value) => toggleFilter(teamSizeFilter, setTeamSizeFilter, value)}
      />

      {/* Date Sort Modal */}
      <Modal
        visible={showDateSortModal}
        transparent
        animationType="none"
        onRequestClose={() => setShowDateSortModal(false)}
        statusBarTranslucent
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowDateSortModal(false)}
        >
          <TouchableOpacity
            style={styles.modalContent}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Sort by Date</Text>
              <TouchableOpacity onPress={() => setShowDateSortModal(false)} hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              {/* Date Posted Options */}
              <Text style={styles.sortSectionTitle}>Date Posted</Text>
              <TouchableOpacity
                style={styles.modalOption}
                onPress={() => {
                  setSortBy('created_at');
                  setSortOrder('desc');
                  setShowDateSortModal(false);
                }}
                activeOpacity={0.7}
              >
                <View style={styles.sortOptionRow}>
                  <Ionicons name="arrow-down" size={18} color={colors.textSecondary} />
                  <Text style={styles.modalOptionText}>Newest First</Text>
                </View>
                {sortBy === 'created_at' && sortOrder === 'desc' && (
                  <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalOption}
                onPress={() => {
                  setSortBy('created_at');
                  setSortOrder('asc');
                  setShowDateSortModal(false);
                }}
                activeOpacity={0.7}
              >
                <View style={styles.sortOptionRow}>
                  <Ionicons name="arrow-up" size={18} color={colors.textSecondary} />
                  <Text style={styles.modalOptionText}>Oldest First</Text>
                </View>
                {sortBy === 'created_at' && sortOrder === 'asc' && (
                  <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                )}
              </TouchableOpacity>

              {/* Kickoff Date Options */}
              <Text style={styles.sortSectionTitle}>Kickoff Date</Text>
              <TouchableOpacity
                style={styles.modalOption}
                onPress={() => {
                  setSortBy('kickoff_date');
                  setSortOrder('asc');
                  setShowDateSortModal(false);
                }}
                activeOpacity={0.7}
              >
                <View style={styles.sortOptionRow}>
                  <Ionicons name="arrow-up" size={18} color={colors.textSecondary} />
                  <Text style={styles.modalOptionText}>Soonest First</Text>
                </View>
                {sortBy === 'kickoff_date' && sortOrder === 'asc' && (
                  <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalOption}
                onPress={() => {
                  setSortBy('kickoff_date');
                  setSortOrder('desc');
                  setShowDateSortModal(false);
                }}
                activeOpacity={0.7}
              >
                <View style={styles.sortOptionRow}>
                  <Ionicons name="arrow-down" size={18} color={colors.textSecondary} />
                  <Text style={styles.modalOptionText}>Latest First</Text>
                </View>
                {sortBy === 'kickoff_date' && sortOrder === 'desc' && (
                  <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                )}
              </TouchableOpacity>
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={onRefresh}
            tintColor={isNewTheme ? colors.accentGreen : legacyColors.primary}
            colors={[isNewTheme ? colors.accentGreen : legacyColors.primary]}
          />
        }
      >
        <View style={styles.content}>
          {pursuits.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={[styles.emptyIconContainer, { backgroundColor: isNewTheme ? colors.surfaceAlt : legacyColors.backgroundSecondary }]}>
                <Ionicons name="search-outline" size={48} color={colors.textTertiary} />
              </View>
              <Text style={[styles.emptyText, { color: colors.textPrimary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>No pursuits found</Text>
              <Text style={[styles.emptySubtext, { color: colors.textSecondary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>Be the first to create one!</Text>
            </View>
          ) : (
            pursuits.map((pursuit) => (
              <TouchableOpacity
                key={pursuit.id}
                style={dynamicStyles.card}
                onPress={() => {
                  HapticManager.lightTap();
                  setSelectedPursuit(pursuit);
                }}
                activeOpacity={0.7}
              >
                {/* Header with Title and Status */}
                <View style={styles.cardHeader}>
                  <View style={styles.cardTitleContainer}>
                    <Text style={dynamicStyles.cardTitle} numberOfLines={2}>
                      {pursuit.title}
                    </Text>
                    {pursuit.creator_id === user?.id && (
                      <View style={[styles.ownerBadge, { backgroundColor: isNewTheme ? colors.accentGreen : legacyColors.success }]}>
                        <Text style={[styles.ownerBadgeText, { color: isNewTheme ? colors.background : legacyColors.white }]}>YOURS</Text>
                      </View>
                    )}
                  </View>
                  <View style={[
                    styles.statusBadge,
                    { backgroundColor: pursuit.status === 'active'
                      ? (isNewTheme ? 'rgba(134, 239, 172, 0.15)' : legacyColors.successLight)
                      : (isNewTheme ? 'rgba(252, 211, 77, 0.15)' : legacyColors.warningLight)
                    }
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
                <Text style={dynamicStyles.cardDescription} numberOfLines={3}>
                  {pursuit.description}
                </Text>

                {/* Tags - Pursuit Types and Categories */}
                {((pursuit.pursuit_types && pursuit.pursuit_types.length > 0) ||
                  (pursuit.pursuit_categories && pursuit.pursuit_categories.length > 0)) && (
                  <View style={styles.tags}>
                    {/* Pursuit Types */}
                    {pursuit.pursuit_types && pursuit.pursuit_types.slice(0, 2).map((type: string, index: number) => (
                      <View key={`type-${index}`} style={dynamicStyles.tag}>
                        <Text style={dynamicStyles.tagText}>{type}</Text>
                      </View>
                    ))}
                    {/* Categories */}
                    {pursuit.pursuit_categories && pursuit.pursuit_categories.slice(0, 2).map((category: string, index: number) => (
                      <View key={`cat-${index}`} style={[dynamicStyles.tag, {
                        backgroundColor: isNewTheme ? 'rgba(129, 140, 248, 0.15)' : legacyColors.secondaryLight,
                        borderColor: isNewTheme ? 'rgba(129, 140, 248, 0.3)' : 'transparent',
                      }]}>
                        <Text style={[dynamicStyles.tagText, { color: isNewTheme ? colors.primary : legacyColors.secondary }]}>{category}</Text>
                      </View>
                    ))}
                    {/* Show +N if more items */}
                    {((pursuit.pursuit_types?.length || 0) + (pursuit.pursuit_categories?.length || 0) > 4) && (
                      <View style={dynamicStyles.tag}>
                        <Text style={dynamicStyles.tagText}>
                          +{((pursuit.pursuit_types?.length || 0) + (pursuit.pursuit_categories?.length || 0)) - 4}
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                {/* Divider */}
                <View style={[styles.divider, { backgroundColor: colors.border }]} />

                {/* Footer */}
                <View style={styles.cardFooter}>
                  <View style={styles.footerTopRow}>
                  <View style={styles.infoRow}>
                    <View style={styles.infoItem}>
                      <View style={[styles.iconContainer, { backgroundColor: isNewTheme ? colors.surfaceAlt : legacyColors.backgroundSecondary }]}>
                        <Ionicons name="people" size={14} color={colors.textSecondary} />
                      </View>
                      <Text style={[styles.infoText, { color: colors.textSecondary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>
                        {pursuit.current_members_count}/{pursuit.team_size_max}
                      </Text>
                    </View>

                    {pursuit.location && (
                      <View style={styles.infoItemFlex}>
                        <View style={[styles.iconContainer, { backgroundColor: isNewTheme ? colors.surfaceAlt : legacyColors.backgroundSecondary }]}>
                          <Ionicons name="location" size={14} color={colors.textSecondary} />
                        </View>
                        <Text style={[styles.infoTextFlex, { color: colors.textSecondary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]} numberOfLines={1}>
                          {pursuit.location}
                        </Text>
                      </View>
                    )}

                    {pursuit.meeting_cadence && (
                      <View style={styles.infoItemFlex}>
                        <View style={[styles.iconContainer, { backgroundColor: isNewTheme ? colors.surfaceAlt : legacyColors.backgroundSecondary }]}>
                          <Ionicons name="calendar" size={14} color={colors.textSecondary} />
                        </View>
                        <Text style={[styles.infoTextFlex, { color: colors.textSecondary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]} numberOfLines={1}>
                          {pursuit.meeting_cadence}
                        </Text>
                        </View>
                      )}
                    </View>

                    {/* Team Members Avatar Stack */}
                    {pursuit.team_members && pursuit.team_members.filter((m: any) => m.status === 'active' || m.status === 'accepted').length > 0 && (
                      <View style={styles.avatarStack}>
                        {pursuit.team_members
                          .filter((m: any) => m.status === 'active' || m.status === 'accepted')
                          .slice(0, 3)
                          .map((member: any, index: number) => (
                            <View
                              key={member.user_id}
                              style={[
                                styles.stackedAvatar,
                                { marginLeft: index === 0 ? 0 : -8, zIndex: 10 - index, borderColor: isNewTheme ? colors.surface : legacyColors.white }
                              ]}
                            >
                              {member.user?.profile_picture ? (
                                <Image
                                  source={{ uri: member.user.profile_picture }}
                                  style={styles.stackedAvatarImage}
                                />
                              ) : (
                                <View style={[styles.stackedAvatarPlaceholder, { backgroundColor: isNewTheme ? colors.accentGreen : legacyColors.primary }]}>
                                  <Text style={[styles.stackedAvatarText, { color: isNewTheme ? colors.background : legacyColors.white }]}>
                                    {member.user?.name?.charAt(0).toUpperCase() || '?'}
                                  </Text>
                                </View>
                              )}
                            </View>
                          ))}
                        {pursuit.team_members.filter((m: any) => m.status === 'active' || m.status === 'accepted').length > 3 && (
                          <View style={[styles.stackedAvatar, styles.stackedAvatarMore, { marginLeft: -8, zIndex: 5, backgroundColor: isNewTheme ? colors.surfaceAlt : legacyColors.backgroundSecondary, borderColor: isNewTheme ? colors.surface : legacyColors.white }]}>
                            <Text style={[styles.stackedAvatarMoreText, { color: colors.textSecondary }]}>
                              +{pursuit.team_members.filter((m: any) => m.status === 'active' || m.status === 'accepted').length - 3}
                            </Text>
                          </View>
                        )}
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
    backgroundColor: legacyColors.background,
  },

  // Header Styles
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
    marginBottom: spacing.lg,
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
    backgroundColor: legacyColors.backgroundSecondary,
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
    color: legacyColors.textPrimary,
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
    backgroundColor: legacyColors.backgroundSecondary,
    borderWidth: 1,
    borderColor: legacyColors.borderLight,
    gap: spacing.xs,
  },

  filterButtonActive: {
    backgroundColor: legacyColors.primary,
    borderColor: legacyColors.primary,
  },

  filterButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: legacyColors.textSecondary,
  },

  filterButtonTextActive: {
    color: legacyColors.white,
  },

  filterBadge: {
    backgroundColor: legacyColors.white,
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
    color: legacyColors.primary,
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
    color: legacyColors.error,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },

  modalContent: {
    backgroundColor: legacyColors.white,
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
    borderBottomColor: legacyColors.borderLight,
  },

  modalTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: legacyColors.textPrimary,
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
    borderBottomColor: legacyColors.borderLight,
  },

  modalOptionText: {
    fontSize: typography.fontSize.base,
    color: legacyColors.textPrimary,
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
    backgroundColor: legacyColors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },

  emptyText: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.semibold,
    color: legacyColors.textPrimary,
    marginBottom: spacing.sm,
  },

  emptySubtext: {
    fontSize: typography.fontSize.base,
    color: legacyColors.textSecondary,
    textAlign: 'center',
  },

  // Card Styles
  card: {
    backgroundColor: legacyColors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.base,
    ...shadows.base,
    borderWidth: 1,
    borderColor: legacyColors.borderLight,
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
    color: legacyColors.textPrimary,
    lineHeight: typography.fontSize.lg * typography.lineHeight.tight,
  },

  ownerBadge: {
    backgroundColor: legacyColors.success,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },

  ownerBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: legacyColors.white,
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
    backgroundColor: legacyColors.warningLight,
  },

  statusActive: {
    backgroundColor: legacyColors.successLight,
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
    color: legacyColors.textSecondary,
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
    backgroundColor: legacyColors.primaryLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },

  tagText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: legacyColors.primary,
  },

  categoryTag: {
    backgroundColor: legacyColors.secondaryLight,
  },

  categoryTagText: {
    color: legacyColors.secondary,
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: legacyColors.borderLight,
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
    flex: 1,
    flexShrink: 1,
    flexWrap: 'wrap',
    minWidth: 0,
  },

  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },

  infoItemFlex: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexShrink: 1,
    minWidth: 0,
  },

  iconContainer: {
    width: 20,
    height: 20,
    borderRadius: borderRadius.sm,
    backgroundColor: legacyColors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },

  infoText: {
    fontSize: typography.fontSize.sm,
    color: legacyColors.textSecondary,
    fontWeight: typography.fontWeight.medium,
  },

  infoTextFlex: {
    fontSize: typography.fontSize.xs,
    color: legacyColors.textSecondary,
    fontWeight: typography.fontWeight.medium,
    flexShrink: 1,
  },

  // Footer layout with avatar stack
  footerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },

  // Avatar Stack Styles (Google Docs style)
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },

  stackedAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: legacyColors.white,
    overflow: 'hidden',
  },

  stackedAvatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 13,
  },

  stackedAvatarPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: legacyColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },

  stackedAvatarText: {
    color: legacyColors.white,
    fontSize: 11,
    fontWeight: typography.fontWeight.bold,
  },

  stackedAvatarMore: {
    backgroundColor: legacyColors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },

  stackedAvatarMoreText: {
    color: legacyColors.textSecondary,
    fontSize: 10,
    fontWeight: typography.fontWeight.bold,
  },

  // Keyword Search Modal Styles
  keywordInput: {
    backgroundColor: legacyColors.backgroundSecondary,
    borderRadius: borderRadius.base,
    padding: spacing.base,
    fontSize: typography.fontSize.base,
    color: legacyColors.textPrimary,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },

  keywordButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    gap: spacing.base,
  },

  keywordClearButton: {
    flex: 1,
    backgroundColor: legacyColors.backgroundSecondary,
    borderRadius: borderRadius.base,
    padding: spacing.base,
    alignItems: 'center',
  },

  keywordClearButtonText: {
    fontSize: typography.fontSize.base,
    color: legacyColors.textSecondary,
    fontWeight: typography.fontWeight.semibold,
  },

  keywordApplyButton: {
    flex: 1,
    backgroundColor: legacyColors.primary,
    borderRadius: borderRadius.base,
    padding: spacing.base,
    alignItems: 'center',
  },

  keywordApplyButtonText: {
    fontSize: typography.fontSize.base,
    color: legacyColors.white,
    fontWeight: typography.fontWeight.semibold,
  },

  // Sort Button Styles
  sortButton: {
    backgroundColor: legacyColors.primaryLight,
    borderColor: legacyColors.primary,
  },

  sortButtonText: {
    color: legacyColors.primary,
  },

  sortSectionTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: legacyColors.textSecondary,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    backgroundColor: legacyColors.backgroundSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  sortOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },

  // Location Autocomplete Styles
  locationModalContent: {
    backgroundColor: legacyColors.white,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '80%',
    paddingBottom: spacing['2xl'],
  },

  locationInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: legacyColors.backgroundSecondary,
    borderRadius: borderRadius.base,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.base,
    paddingHorizontal: spacing.base,
    height: 48,
  },

  locationSearchIcon: {
    marginRight: spacing.sm,
  },

  locationSearchInput: {
    flex: 1,
    fontSize: typography.fontSize.base,
    color: legacyColors.textPrimary,
  },

  locationSuggestionsList: {
    maxHeight: 300,
    marginBottom: spacing.base,
  },

  locationSuggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.base,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: legacyColors.borderLight,
    gap: spacing.sm,
  },

  locationSuggestionText: {
    flex: 1,
    fontSize: typography.fontSize.base,
    color: legacyColors.textPrimary,
  },

  locationCustomItem: {
    backgroundColor: legacyColors.primaryLight,
    borderBottomWidth: 0,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    borderRadius: borderRadius.base,
  },

  locationCustomText: {
    color: legacyColors.primary,
    fontWeight: typography.fontWeight.medium,
  },

  selectedLocationsContainer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },

  selectedLocationsScroll: {
    gap: spacing.sm,
  },

  selectedLocationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: legacyColors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    gap: spacing.xs,
  },

  selectedLocationChipText: {
    fontSize: typography.fontSize.sm,
    color: legacyColors.white,
    fontWeight: typography.fontWeight.medium,
  },

  locationSuggestionItemSelected: {
    backgroundColor: legacyColors.primaryLight,
  },

  locationSuggestionTextSelected: {
    color: legacyColors.primary,
    fontWeight: typography.fontWeight.medium,
  },
});
