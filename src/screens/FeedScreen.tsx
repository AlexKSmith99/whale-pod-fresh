import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert, StatusBar, TextInput, Modal, KeyboardAvoidingView, Platform, Image, Animated, Easing } from 'react-native';
import { useCardPress } from '../hooks/useCardPress';
import { Ionicons } from '@expo/vector-icons';
import { pursuitService } from '../services/pursuitService';
import { POD_TYPES, POD_CATEGORIES } from '../constants/pursuitTypes';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import { HapticManager } from '../services/hapticManager';
import GrainTexture from '../components/ui/GrainTexture';
import GradientBackground from '../components/ui/GradientBackground';
import { SkeletonFeedList } from '../components/ui/Skeleton';
import PursuitDetailScreen from './PursuitDetailScreen';
import { colors as legacyColors, typography, spacing, borderRadius, shadows } from '../theme/designSystem';
import { useFonts, KleeOne_400Regular } from '@expo-google-fonts/klee-one';
import {
  HotFlameIcon,
  JalapenoIndicator,
  calculateEngagement,
  fetchEngagementData,
  EngagementState,
} from '../components/ui/PodEngagementIndicator';

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
  const [fontsLoaded] = useFonts({
    KleeOne_400Regular,
  });
  const [pursuits, setPursuits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPursuit, setSelectedPursuit] = useState<any>(null);
  const unfoldAnim = useRef(new Animated.Value(0)).current;
  const [searchQuery, setSearchQuery] = useState('');
  const [engagementMap, setEngagementMap] = useState<Record<string, EngagementState>>({});

  // Search input focus animation (border glow)
  const searchFocusAnim = useRef(new Animated.Value(0)).current;
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  useEffect(() => {
    Animated.timing(searchFocusAnim, {
      toValue: isSearchFocused ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [isSearchFocused, searchFocusAnim]);

  // Filter states
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [pursuitTypeFilter, setPursuitTypeFilter] = useState<string[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [keywordFilter, setKeywordFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState<string[]>([]);
  const [teamSizeFilter, setTeamSizeFilter] = useState<string[]>([]);

  // Sort states
  const [sortBy, setSortBy] = useState<string>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Modal states
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showPursuitTypeModal, setShowPursuitTypeModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
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
  }, [statusFilter, pursuitTypeFilter, categoryFilter, keywordFilter, locationFilter, teamSizeFilter, sortBy, sortOrder]);
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

      // Fetch engagement data in parallel for all visible pods (batched queries)
      if (data && data.length > 0) {
        const ids = data.map((p: any) => p.id).filter(Boolean);
        try {
          const raw = await fetchEngagementData(ids);
          const map: Record<string, EngagementState> = {};
          for (const pod of data) {
            const bucket = raw[pod.id] || { meetingsCount: 0, chatCount: 0, recentAcceptances: 0 };
            map[pod.id] = calculateEngagement(
              pod,
              bucket.meetingsCount,
              bucket.chatCount,
              bucket.recentAcceptances
            );
          }
          setEngagementMap(map);
        } catch (e) {
          // Non-fatal; just skip indicators
          console.warn('engagement fetch failed:', e);
        }
      } else {
        setEngagementMap({});
      }
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
      'Delete Pod',
      'Are you sure you want to delete this pod?',
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
              Alert.alert('Success', 'Pod deleted!');
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
    setCategoryFilter([]);
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
      <Animated.View
        style={{
          flex: 1,
          opacity: unfoldAnim,
          transform: [
            { scaleY: unfoldAnim },
            {
              translateY: unfoldAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [-400, 0],
              }),
            },
          ],
        }}
      >
      <PursuitDetailScreen
        pursuit={selectedPursuit}
        onBack={() => {
          Animated.timing(unfoldAnim, { toValue: 0, duration: 260, useNativeDriver: true }).start(() => {
            setSelectedPursuit(null);
          });
        }}
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
      </Animated.View>
    );
  }

  // Filter Button Component — with press scale animation (Animated.spring) and raised look.
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
    const btnScale = useRef(new Animated.Value(1)).current;

    const handlePressIn = () => {
      Animated.spring(btnScale, {
        toValue: 0.97,
        useNativeDriver: true,
        speed: 50,
        bounciness: 4,
      }).start();
    };
    const handlePressOut = () => {
      Animated.spring(btnScale, {
        toValue: 1,
        useNativeDriver: true,
        speed: 40,
        bounciness: 8,
      }).start();
    };

    return (
      <Animated.View style={{ transform: [{ scale: btnScale }] }}>
        <TouchableOpacity
          style={[
            dynamicStyles.filterButton,
            isActive && dynamicStyles.filterButtonActive,
            // "Inner glow" for active chip
            isActive && {
              shadowColor: isNewTheme ? colors.accentGreen : legacyColors.primary,
              shadowOpacity: 0.35,
              shadowRadius: 8,
            },
          ]}
          onPress={() => {
            HapticManager.selection();
            onPress();
          }}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          activeOpacity={0.85}
        >
          <Text style={[
            dynamicStyles.filterButtonText,
            isActive && { color: isNewTheme ? colors.background : legacyColors.white }
          ]}>
            {label}
          </Text>
          {isActive && (
            <View style={[styles.filterBadge, { backgroundColor: isNewTheme ? colors.background : LIGHT_BG }]}>
              <Text style={[styles.filterBadgeText, { color: isNewTheme ? colors.accentGreen : LIGHT_INK }]}>{count}</Text>
            </View>
          )}
          <Ionicons
            name="chevron-down"
            size={16}
            color={isActive ? (isNewTheme ? colors.background : legacyColors.white) : colors.textSecondary}
          />
        </TouchableOpacity>
      </Animated.View>
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
            <Text style={[styles.modalTitle, { color: colors.textPrimary, fontFamily: isNewTheme ? 'Sora_700Bold' : 'PlayfairDisplay_700Bold' }]}>{title}</Text>
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
                <Text style={[styles.modalOptionText, { color: colors.textPrimary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>{option}</Text>
                {selectedValues.includes(option) && (
                  <Ionicons name="checkmark-circle" size={24} color={isNewTheme ? colors.accentGreen : CAROLINA} />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  ));

  // Colorful tag colors for light mode
  const getTagColor = (tagName: string, isType: boolean): { bg: string; text: string } => {
    if (isNewTheme) return { bg: 'rgba(168, 230, 163, 0.15)', text: colors.accentGreen };
    const TAG_MAP: Record<string, { bg: string; text: string }> = {
      Accountability: { bg: '#F5F0E8', text: '#7A5B2B' },
      AI:             { bg: '#E8EDF5', text: '#3E4F7A' },
      Art:            { bg: '#F5E8F0', text: '#7A3E6A' },
      Business:       { bg: '#E8EDF5', text: '#3E4F7A' },
      'Career Development': { bg: '#EDF5E8', text: '#4A7234' },
      Discussion:     { bg: '#F0E8F5', text: '#5B3A8B' },
      Education:      { bg: '#E8F0EA', text: '#2D5F3E' },
      Explore:        { bg: '#E6F2F5', text: '#2B6B7A' },
      Fitness:        { bg: '#FCF0E6', text: '#925B2B' },
      Friends:        { bg: '#FDF6EC', text: '#8B6914' },
      Fun:            { bg: '#FFF8E1', text: '#7A6514' },
      Health:         { bg: '#E8F5ED', text: '#2D6B3E' },
      Hobby:          { bg: '#EDF5E8', text: '#4A7234' },
      Lifestyle:      { bg: '#F5E8F0', text: '#7A3E6A' },
      'Mental Health': { bg: '#E8F0EA', text: '#2D5F3E' },
      Music:          { bg: '#F0E8F5', text: '#5B3A8B' },
      Nature:         { bg: '#E8F5ED', text: '#2D6B3E' },
      Networking:     { bg: '#E8E8F5', text: '#4A3E7A' },
      'New Endeavor': { bg: '#E8F5F0', text: '#2B7A5B' },
      'Side Hustle':  { bg: '#FFF8E1', text: '#7A6514' },
      'Start-Ups':    { bg: '#FCF0E6', text: '#925B2B' },
      Technology:     { bg: '#E8EDF5', text: '#3E4F7A' },
      Travel:         { bg: '#E6F2F5', text: '#2B6B7A' },
    };
    return TAG_MAP[tagName] || (isType
      ? { bg: '#E4EDDE', text: '#2D5016' }
      : { bg: '#F5EBE3', text: '#A0522D' });
  };

  // Dynamic styles based on theme
  // ===== Editorial light-mode palette =====
  // Cream paper background, charcoal ink, hairline borders.
  // Accents (in order of prominence):
  //   - Carolina blue: somewhat-discreet primary accent (replaces forest green)
  //   - Gold: very-discreet tertiary, used sparingly for the "yours" mark
  //   - Red: semantic only — hot/urgent indicators and destructive actions
  const LIGHT_INK = '#1B1B18';
  const LIGHT_MUTED = '#8A8A85';
  const LIGHT_HAIRLINE = '#E5E1D8';
  const LIGHT_BG = '#FAF9F6';
  const LIGHT_SURFACE = '#FFFFFF';
  const LIGHT_RED = '#DC2626';
  const CAROLINA = '#4B9CD3';
  const CAROLINA_DEEP = '#2E6A95';
  const CAROLINA_TINT = 'rgba(75, 156, 211, 0.10)';
  const GOLD = '#C49B00';

  const dynamicStyles = {
    container: {
      flex: 1,
      backgroundColor: isNewTheme ? colors.background : LIGHT_BG,
    },
    header: {
      backgroundColor: isNewTheme ? colors.surface : LIGHT_BG,
      paddingTop: 50,
      paddingBottom: spacing.base,
      borderBottomWidth: isNewTheme ? 1 : 0,
      borderBottomColor: colors.border,
    },
    headerGreeting: {
      fontSize: isNewTheme ? typography.fontSize.sm : 14,
      color: isNewTheme ? colors.textSecondary : LIGHT_MUTED,
      fontWeight: typography.fontWeight.medium as '500',
      marginBottom: spacing.xs,
      fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'Sora_500Medium',
      textTransform: isNewTheme ? 'uppercase' as const : 'none' as const,
      letterSpacing: isNewTheme ? 1 : 0.5,
    },
    headerTitle: {
      fontSize: isNewTheme ? typography.fontSize['3xl'] : 36,
      fontWeight: typography.fontWeight.bold as '700',
      color: isNewTheme ? colors.accentGreen : LIGHT_INK,
      fontFamily: isNewTheme ? 'Sora_700Bold' : 'PlayfairDisplay_700Bold',
      letterSpacing: isNewTheme ? -0.5 : -0.8,
    },
    searchContainer: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      backgroundColor: isNewTheme ? colors.surfaceAlt : 'transparent',
      marginHorizontal: spacing.lg,
      paddingHorizontal: isNewTheme ? spacing.base : 0,
      // Pill in dark, underline in light
      borderRadius: isNewTheme ? 24 : 0,
      borderBottomWidth: isNewTheme ? 0 : 1,
      borderBottomColor: LIGHT_HAIRLINE,
      height: 44,
      marginBottom: spacing.base,
      // Shadow only in dark — light is paper-flat
      shadowColor: '#000',
      shadowOpacity: isNewTheme ? 0.08 : 0,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: isNewTheme ? 3 : 0,
    },
    searchInput: {
      flex: 1,
      marginLeft: spacing.sm,
      fontSize: typography.fontSize.base,
      color: isNewTheme ? colors.textPrimary : LIGHT_INK,
      fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold',
    },
    card: {
      // Light mode: kept the card shape — white surface, hairline border,
      // soft shadow for editorial pop. A thin Carolina-blue stripe runs down
      // the left edge as a discreet accent.
      backgroundColor: isNewTheme ? colors.surface : LIGHT_SURFACE,
      borderRadius: isNewTheme ? borderRadius.lg : 14,
      padding: isNewTheme ? spacing.lg : 20,
      paddingLeft: isNewTheme ? spacing.lg : 22,
      marginBottom: isNewTheme ? spacing.base : 14,
      marginHorizontal: isNewTheme ? 0 : 0,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: isNewTheme ? 4 : 6 },
      shadowOpacity: isNewTheme ? 0.08 : 0.06,
      shadowRadius: isNewTheme ? 12 : 14,
      elevation: isNewTheme ? 5 : 3,
      borderWidth: isNewTheme ? 0.75 : 1,
      borderColor: isNewTheme ? colors.accentGreen : LIGHT_HAIRLINE,
      overflow: 'hidden' as const,
      position: 'relative' as const,
    },
    cardTitle: {
      flex: 1,
      fontSize: isNewTheme ? typography.fontSize.lg : 24,
      fontWeight: typography.fontWeight.bold as '700',
      color: isNewTheme ? colors.textPrimary : LIGHT_INK,
      lineHeight: isNewTheme ? typography.fontSize.lg * typography.lineHeight.tight : 28,
      fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'PlayfairDisplay_700Bold',
      letterSpacing: isNewTheme ? 0 : -0.3,
    },
    cardDescription: {
      fontSize: isNewTheme ? typography.fontSize.base : 14,
      color: isNewTheme ? colors.textSecondary : LIGHT_MUTED,
      lineHeight: isNewTheme ? typography.fontSize.base * typography.lineHeight.normal : 20,
      marginBottom: isNewTheme ? spacing.md : 10,
      marginTop: isNewTheme ? 0 : 6,
      fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold',
    },
    filterButton: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      paddingHorizontal: spacing.base,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.full,
      backgroundColor: isNewTheme ? colors.surfaceAlt : 'transparent',
      borderWidth: 1,
      borderColor: isNewTheme ? colors.border : LIGHT_HAIRLINE,
      gap: spacing.xs,
      shadowColor: '#000',
      shadowOpacity: isNewTheme ? 0.08 : 0,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: isNewTheme ? 2 : 0,
    },
    filterButtonActive: {
      backgroundColor: isNewTheme ? colors.accentGreen : CAROLINA,
      borderColor: isNewTheme ? colors.accentGreen : CAROLINA,
    },
    filterButtonText: {
      fontSize: typography.fontSize.sm,
      fontWeight: typography.fontWeight.medium as '500',
      color: isNewTheme ? colors.textSecondary : LIGHT_INK,
      fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold',
    },
    tag: {
      backgroundColor: isNewTheme ? 'rgba(168, 230, 163, 0.15)' : 'transparent',
      paddingHorizontal: spacing.md,
      paddingVertical: isNewTheme ? spacing.xs : 4,
      borderRadius: borderRadius.full,
      borderWidth: 1,
      borderColor: isNewTheme ? colors.accentGreenMuted : LIGHT_HAIRLINE,
    },
    tagText: {
      fontSize: isNewTheme ? typography.fontSize.xs : 11,
      fontWeight: isNewTheme ? typography.fontWeight.medium as '500' : typography.fontWeight.semibold as '600',
      color: isNewTheme ? colors.accentGreen : LIGHT_INK,
      fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold',
      textTransform: isNewTheme ? 'uppercase' as const : 'lowercase' as const,
      letterSpacing: isNewTheme ? 0.5 : 0.3,
    },
  };

  return (
    <GradientBackground style={dynamicStyles.container}>
      <StatusBar barStyle={isNewTheme ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

      {/* Grain texture overlay for new theme */}
      {isNewTheme && <GrainTexture opacity={0.06} />}

      {/* Modern Header */}
      <View style={dynamicStyles.header}>
        <View style={styles.headerTop}>
          {isNewTheme ? (
            <Text style={styles.pieWordmark}>whale pod</Text>
          ) : (
            <Text style={dynamicStyles.headerTitle}>whale pod</Text>
          )}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: isNewTheme ? 12 : 12 }}>
            {!isNewTheme && (
              <TouchableOpacity
                onPress={() => { HapticManager.themeToggle(); toggleTheme(); }}
                style={{ width: 36, height: 36, justifyContent: 'center', alignItems: 'center' }}
                activeOpacity={0.6}
              >
                <Ionicons name="moon-outline" size={20} color={LIGHT_INK} />
              </TouchableOpacity>
            )}
            {isNewTheme ? (
              <>
                <TouchableOpacity
                  onPress={() => { HapticManager.themeToggle(); toggleTheme(); }}
                  style={styles.pieHeaderIconBtn}
                  activeOpacity={0.85}
                >
                  <Ionicons name="sunny-outline" size={22} color="#FFFFFF" />
                </TouchableOpacity>
                <TouchableOpacity onPress={onOpenCreate} style={[styles.pieHeaderIconBtn]} activeOpacity={0.85}>
                  <Ionicons name="add" size={26} color="#FFFFFF" />
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity
                onPress={onOpenCreate}
                style={{ width: 36, height: 36, justifyContent: 'center', alignItems: 'center' }}
                activeOpacity={0.6}
              >
                <Ionicons name="add" size={24} color={LIGHT_INK} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Light-mode editorial accent line under the wordmark — Carolina blue, the discreet primary accent */}
        {!isNewTheme && (
          <View style={{ height: 2, backgroundColor: CAROLINA, marginHorizontal: spacing.lg, marginBottom: spacing.base }} />
        )}

        {/* Modern Search Bar — rounded pill with animated green glow on focus */}
        <Animated.View
          style={[
            dynamicStyles.searchContainer,
            {
              borderWidth: searchFocusAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 2] }),
              borderColor: searchFocusAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [colors.border, colors.accentGreen],
              }) as unknown as string,
            },
          ]}
        >
          <Ionicons name="search" size={18} color={colors.textTertiary} />
          <TextInput
            style={dynamicStyles.searchInput}
            placeholder="Search pods..."
            placeholderTextColor={colors.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
            </TouchableOpacity>
          )}
        </Animated.View>

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
            label="Pod Type"
            count={getFilterCount(pursuitTypeFilter)}
            onPress={() => setShowPursuitTypeModal(true)}
          />
          <FilterButton
            label="Categories"
            count={getFilterCount(categoryFilter)}
            onPress={() => setShowCategoryModal(true)}
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
              backgroundColor: isNewTheme ? 'rgba(168, 230, 163, 0.15)' : CAROLINA_TINT,
              borderColor: isNewTheme ? colors.accentGreen : CAROLINA,
            }]}
            onPress={() => {
              HapticManager.selection();
              setShowDateSortModal(true);
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="swap-vertical" size={16} color={isNewTheme ? colors.accentGreen : CAROLINA_DEEP} />
            <Text style={[dynamicStyles.filterButtonText, { color: isNewTheme ? colors.accentGreen : CAROLINA_DEEP }]}>
              {sortBy === 'created_at' ? 'Date Posted' : 'Kickoff Date'}
            </Text>
            <Ionicons
              name={sortOrder === 'desc' ? 'arrow-down' : 'arrow-up'}
              size={14}
              color={isNewTheme ? colors.accentGreen : CAROLINA_DEEP}
            />
          </TouchableOpacity>
        </ScrollView>

        {/* Clear Filters Button */}
        {(statusFilter.length > 0 || pursuitTypeFilter.length > 0 || categoryFilter.length > 0 || keywordFilter ||
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
        title="Filter by Pod Type"
        options={POD_TYPES}
        selectedValues={pursuitTypeFilter}
        onToggle={(value) => toggleFilter(pursuitTypeFilter, setPursuitTypeFilter, value)}
      />

      <FilterModal
        visible={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
        title="Filter by Category"
        options={POD_CATEGORIES}
        selectedValues={categoryFilter}
        onToggle={(value) => toggleFilter(categoryFilter, setCategoryFilter, value)}
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
              <Text style={[styles.modalTitle, { fontFamily: isNewTheme ? 'Sora_700Bold' : 'PlayfairDisplay_700Bold' }]}>Search by Keyword</Text>
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
              <Text style={[styles.modalTitle, { fontFamily: isNewTheme ? 'Sora_700Bold' : 'PlayfairDisplay_700Bold' }]}>Filter by Location</Text>
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
        options={['1-2', '3-5', '6-8']}
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
              <Text style={[styles.modalTitle, { fontFamily: isNewTheme ? 'Sora_700Bold' : 'PlayfairDisplay_700Bold' }]}>Sort by Date</Text>
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
            tintColor={isNewTheme ? colors.accentGreen : CAROLINA}
            colors={[isNewTheme ? colors.accentGreen : CAROLINA]}
          />
        }
      >
        <View style={styles.content}>
          {loading && pursuits.length === 0 ? (
            <SkeletonFeedList count={4} />
          ) : pursuits.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={[styles.emptyIconContainer, { backgroundColor: isNewTheme ? colors.surfaceAlt : legacyColors.backgroundSecondary }]}>
                <Ionicons name="search-outline" size={48} color={colors.textTertiary} />
              </View>
              <Text style={[styles.emptyText, { color: colors.textPrimary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>No pods found</Text>
              <Text style={[styles.emptySubtext, { color: colors.textSecondary, fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }]}>Be the first to create one!</Text>
            </View>
          ) : (
            pursuits.flatMap((pursuit, index) => {
              const engagement: EngagementState = engagementMap[pursuit.id] || { isHot: false, spiceLevel: 0 };

              // Left accent line color logic
              let accentLineColor = colors.accentGreen;
              if (engagement.isHot) accentLineColor = '#FF6B35';
              else if (engagement.spiceLevel > 0) accentLineColor = '#22C55E';

              const handleCardPress = () => {
                HapticManager.lightTap();
                unfoldAnim.setValue(0);
                setSelectedPursuit(pursuit);
                Animated.spring(unfoldAnim, {
                  toValue: 1,
                  tension: 55,
                  friction: 10,
                  useNativeDriver: true,
                }).start();
              };

              // ===== NEW DARK-THEME CARD (Pie-style cover-image dominant) =====
              if (isNewTheme) {
                const isMine = pursuit.creator_id === user?.id;
                const memberRatio = `${pursuit.current_members_count ?? 0}/${pursuit.team_size_max ?? '?'}`;
                const activeMembers = (pursuit.team_members || []).filter((m: any) => m.status === 'active' || m.status === 'accepted').slice(0, 3);
                return [(
                  <PursuitCardWrapper
                    key={pursuit.id}
                    style={[styles.pieCardOuter, { backgroundColor: colors.surface, borderColor: colors.border }]}
                    isNewTheme={isNewTheme}
                    onPress={handleCardPress}
                  >
                    {/* Cover image */}
                    <View style={styles.pieCoverWrap}>
                      {pursuit.cover_image_url ? (
                        <Image source={{ uri: pursuit.cover_image_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                      ) : (
                        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.surfaceAlt }]}>
                          <View style={styles.pieCoverEmptyDots}>
                            {[0, 1, 2].map(i => (
                              <View key={i} style={[styles.pieCoverEmptyDot, { backgroundColor: colors.accentGreen, opacity: 0.4 }]} />
                            ))}
                          </View>
                        </View>
                      )}
                      {/* Subtle bottom darkening for legibility */}
                      <View style={styles.pieCoverGradient} pointerEvents="none" />

                      {/* YOURS badge top-left */}
                      {isMine && (
                        <View style={[styles.pieYoursPill, { backgroundColor: colors.accentGreen }]}>
                          <Text style={styles.pieYoursPillText}>YOURS</Text>
                        </View>
                      )}

                      {/* Engagement indicator (absolute-positioned inside the cover) */}
                      {engagement.isHot ? (
                        <HotFlameIcon enabled={true} size={22} />
                      ) : (
                        <JalapenoIndicator count={engagement.spiceLevel} />
                      )}

                      {/* Title overlay bottom-left */}
                      <View style={styles.pieTitleOverlay}>
                        <Text style={styles.pieTitleText} numberOfLines={2}>
                          {pursuit.title}
                        </Text>
                      </View>
                    </View>

                    {/* Bottom panel */}
                    <View style={styles.pieBottomPanel}>
                      {/* Status pill + members fraction row */}
                      <View style={styles.pieStatusRow}>
                        <View style={[
                          styles.pieStatusPill,
                          { backgroundColor: pursuit.status === 'active'
                              ? 'rgba(200, 255, 107, 0.15)'
                              : 'rgba(252, 211, 77, 0.15)' }
                        ]}>
                          <View style={[styles.pieStatusDot, { backgroundColor: pursuit.status === 'active' ? colors.accentGreen : colors.warning }]} />
                          <Text style={[styles.pieStatusText, { color: pursuit.status === 'active' ? colors.accentGreen : colors.warning }]}>
                            {pursuit.status === 'awaiting_kickoff' ? 'awaiting kickoff' : 'active'}
                          </Text>
                        </View>

                        {/* Member avatar stack */}
                        {activeMembers.length > 0 && (
                          <View style={styles.pieAvatarStack}>
                            {activeMembers.map((member: any, i: number) => (
                              <View
                                key={member.user_id}
                                style={[
                                  styles.pieStackedAvatar,
                                  { marginLeft: i === 0 ? 0 : -10, zIndex: 10 - i, borderColor: colors.surface }
                                ]}
                              >
                                {member.user?.profile_picture ? (
                                  <Image source={{ uri: member.user.profile_picture }} style={styles.pieStackedAvatarImage} />
                                ) : (
                                  <View style={[styles.pieStackedAvatarPlaceholder, { backgroundColor: colors.accentGreen }]}>
                                    <Text style={styles.pieStackedAvatarLetter}>
                                      {member.user?.name?.charAt(0).toUpperCase() || '?'}
                                    </Text>
                                  </View>
                                )}
                              </View>
                            ))}
                          </View>
                        )}
                      </View>

                      {/* Description */}
                      {pursuit.description ? (
                        <Text style={[styles.pieDescription, { color: colors.textSecondary }]} numberOfLines={2}>
                          {pursuit.description}
                        </Text>
                      ) : null}

                      {/* Info rows: cadence + location */}
                      {pursuit.meeting_cadence ? (
                        <View style={styles.pieInfoRow}>
                          <Ionicons name="calendar-outline" size={15} color={colors.textTertiary} />
                          <Text style={[styles.pieInfoText, { color: colors.textSecondary }]} numberOfLines={1}>
                            {pursuit.meeting_cadence}
                          </Text>
                        </View>
                      ) : null}
                      {pursuit.location ? (
                        <View style={styles.pieInfoRow}>
                          <Ionicons name="location-outline" size={15} color={colors.textTertiary} />
                          <Text style={[styles.pieInfoText, { color: colors.textSecondary }]} numberOfLines={1}>
                            {pursuit.neighborhood
                              ? `${pursuit.neighborhood}, ${pursuit.location.split(',')[0]}`
                              : pursuit.location}
                          </Text>
                        </View>
                      ) : null}
                      <View style={styles.pieInfoRow}>
                        <Ionicons name="people-outline" size={15} color={colors.textTertiary} />
                        <Text style={[styles.pieInfoText, { color: colors.textSecondary }]} numberOfLines={1}>
                          {memberRatio} members
                        </Text>
                      </View>

                      {/* Tags */}
                      {((pursuit.pursuit_types && pursuit.pursuit_types.length > 0) ||
                        (pursuit.pursuit_categories && pursuit.pursuit_categories.length > 0)) && (
                        <View style={styles.pieTagsRow}>
                          {(pursuit.pursuit_types || []).slice(0, 2).map((t: string) => (
                            <View key={`t-${t}`} style={[styles.pieTag, { backgroundColor: 'rgba(200, 255, 107, 0.10)', borderColor: 'rgba(200, 255, 107, 0.25)' }]}>
                              <Text style={[styles.pieTagText, { color: colors.accentGreen }]}>{t.toLowerCase()}</Text>
                            </View>
                          ))}
                          {(pursuit.pursuit_categories || []).slice(0, 2).map((c: string) => (
                            <View key={`c-${c}`} style={[styles.pieTag, { backgroundColor: 'rgba(255, 255, 255, 0.06)', borderColor: 'rgba(255, 255, 255, 0.10)' }]}>
                              <Text style={[styles.pieTagText, { color: colors.textSecondary }]}>{c.toLowerCase()}</Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  </PursuitCardWrapper>
                )];
              }

              // ===== EDITORIAL LIGHT CARD =====
              // Card chrome retained (white surface, hairline border, soft
              // shadow). A 3px Carolina-blue stripe down the left edge is the
              // discreet primary accent. Hot pods replace the stripe with red.
              const isMineLight = pursuit.creator_id === user?.id;
              const memberRatio = `${pursuit.current_members_count ?? 0}/${pursuit.team_size_max ?? '?'}`;
              const locationStr = pursuit.location
                ? (pursuit.neighborhood
                    ? `${pursuit.neighborhood}, ${pursuit.location.split(',')[0]}`
                    : pursuit.location)
                : null;
              const metaParts = [
                `${memberRatio} members`,
                locationStr,
                pursuit.meeting_cadence,
              ].filter(Boolean);
              const lightStripeColor = engagement.isHot ? LIGHT_RED : CAROLINA;

              const card = (
              <PursuitCardWrapper
                key={pursuit.id}
                style={[dynamicStyles.card]}
                isNewTheme={isNewTheme}
                onPress={handleCardPress}
              >
                {/* Left 3px Carolina-blue accent stripe (red if hot) */}
                <View style={[styles.cardAccentLine, { backgroundColor: lightStripeColor }]} pointerEvents="none" />

                {/* Title row */}
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <Text style={dynamicStyles.cardTitle} numberOfLines={2}>
                    {pursuit.title}
                  </Text>
                  {engagement.isHot && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(220, 38, 38, 0.10)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, marginTop: 2 }}>
                      <Ionicons name="flame" size={13} color={LIGHT_RED} />
                      <Text style={{ fontSize: 10, color: LIGHT_RED, fontFamily: 'InterTight_600SemiBold', letterSpacing: 0.6, textTransform: 'uppercase' }}>
                        Hot
                      </Text>
                    </View>
                  )}
                </View>

                {/* Marker row: YOURS (gold) + awaiting kickoff (muted) */}
                {(isMineLight || pursuit.status === 'awaiting_kickoff') && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
                    {isMineLight && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(196, 155, 0, 0.10)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(196, 155, 0, 0.30)' }}>
                        <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: GOLD }} />
                        <Text style={{ fontSize: 10, color: GOLD, fontFamily: 'InterTight_600SemiBold', letterSpacing: 0.6, textTransform: 'uppercase' }}>
                          Yours
                        </Text>
                      </View>
                    )}
                    {pursuit.status === 'awaiting_kickoff' && (
                      <Text style={{ fontSize: 10, color: LIGHT_MUTED, fontFamily: 'InterTight_600SemiBold', letterSpacing: 0.6, textTransform: 'uppercase' }}>
                        Awaiting kickoff
                      </Text>
                    )}
                  </View>
                )}

                {/* Description */}
                {pursuit.description ? (
                  <Text style={dynamicStyles.cardDescription} numberOfLines={2}>
                    {pursuit.description}
                  </Text>
                ) : null}

                {/* Meta row — middle-dot separated, with Carolina-blue divider above */}
                {metaParts.length > 0 && (
                  <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: LIGHT_HAIRLINE }}>
                    <Text
                      style={{
                        fontSize: 12,
                        color: LIGHT_MUTED,
                        fontFamily: 'InterTight_600SemiBold',
                        letterSpacing: 0.2,
                      }}
                      numberOfLines={1}
                    >
                      {metaParts.join('  ·  ')}
                    </Text>
                  </View>
                )}
              </PursuitCardWrapper>
              );
              return [card];
            })
          )}
        </View>
      </ScrollView>

      {/* Floating "post a pod" CTA — sits directly above the tab bar.
          Tab bar lives at bottom:16 with ~52px bar height, so its top edge is
          at ~68 from screen bottom. We pin this button's bottom at 72 so it
          sits 4px above the tab bar top. */}
      {onOpenCreate && (
        <View pointerEvents="box-none" style={[styles.postAPlanWrap, { bottom: 72 }]}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={onOpenCreate}
            style={[styles.postAPlanBtn, { backgroundColor: isNewTheme ? colors.accentGreen : LIGHT_INK }]}
          >
            <Ionicons name="add" size={22} color={isNewTheme ? '#000000' : '#FFFFFF'} />
            <Text style={[styles.postAPlanText, { color: isNewTheme ? '#000000' : '#FFFFFF' }]}>post a pod</Text>
          </TouchableOpacity>
        </View>
      )}
    </GradientBackground>
  );
}

// Card wrapper with press animation — always scales to 0.98 on press (Animated.spring)
function PursuitCardWrapper({ children, style, isNewTheme, onPress }: {
  children: React.ReactNode;
  style: any;
  isNewTheme: boolean;
  onPress: () => void;
}) {
  const { scale, onPressIn, onPressOut } = useCardPress({ haptic: !isNewTheme, scaleDown: 0.98 });

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={style}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={1}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // ===== Pie-style dark-theme header =====
  pieWordmark: {
    fontFamily: 'Sora_700Bold',
    fontSize: 28,
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  pieHeaderIconBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  postAPlanWrap: {
    position: 'absolute',
    left: 0, right: 0, bottom: 76,
    alignItems: 'center',
    zIndex: 50,
  },
  postAPlanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  postAPlanText: { color: '#000000', fontSize: 15, fontFamily: 'Sora_600SemiBold', fontWeight: '600' },
  // ===== Pie-style dark-theme card =====
  pieCardOuter: {
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    marginBottom: 18,
  },
  pieCoverWrap: {
    width: '100%',
    aspectRatio: 16 / 11,
    backgroundColor: '#000',
    position: 'relative',
  },
  pieCoverGradient: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    height: '50%',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  pieCoverEmptyDots: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  pieCoverEmptyDot: {
    width: 8, height: 8, borderRadius: 4,
  },
  pieYoursPill: {
    position: 'absolute', top: 14, left: 14,
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 999,
  },
  pieYoursPillText: {
    color: '#000', fontSize: 10, fontWeight: '800', letterSpacing: 0.6,
  },
  pieEngagementWrap: {
    position: 'absolute', top: 0, right: 0,
  },
  pieTitleOverlay: {
    position: 'absolute', left: 14, right: 14, bottom: 14,
  },
  pieTitleText: {
    color: '#FFFFFF',
    fontFamily: 'Sora_700Bold',
    fontSize: 24,
    lineHeight: 28,
    letterSpacing: -0.3,
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  pieBottomPanel: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
  },
  pieStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  pieStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 999,
    gap: 6,
  },
  pieStatusDot: { width: 6, height: 6, borderRadius: 3 },
  pieStatusText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },
  pieAvatarStack: { flexDirection: 'row', alignItems: 'center' },
  pieStackedAvatar: {
    width: 26, height: 26, borderRadius: 13,
    borderWidth: 2, overflow: 'hidden',
  },
  pieStackedAvatarImage: { width: '100%', height: '100%' },
  pieStackedAvatarPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pieStackedAvatarLetter: { color: '#000', fontSize: 11, fontWeight: '700' },
  pieDescription: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Sora_600SemiBold',
    marginBottom: 10,
  },
  pieInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  pieInfoText: {
    fontSize: 13,
    flex: 1,
    fontFamily: 'Sora_600SemiBold',
  },
  pieTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  pieTag: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pieTagText: { fontSize: 11, fontWeight: '600', letterSpacing: 0.3 },
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
    paddingBottom: 120, // accommodates floating tab bar + post-a-plan affordance
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
    borderWidth: 0.5,
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

  // Decorative dot divider (three accentGreen dots)
  dotDivider: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.md,
    marginTop: spacing.xs,
  },

  dotDividerDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    opacity: 0.7,
  },

  // 3px-wide left accent line painted as an absolute child of the card
  cardAccentLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 3,
    borderTopLeftRadius: borderRadius.lg,
    borderBottomLeftRadius: borderRadius.lg,
  },

  // Wrapper for the active-gradient border path (gives spacing below per-card)
  cardOuterWrap: {
    marginBottom: 16,
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
