import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  Image,
  LayoutChangeEvent,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { colors as legacyColors, typography, spacing, borderRadius } from '../theme/designSystem';
import { useTheme } from '../theme/ThemeContext';
import { getThemedStyles } from '../theme/themedStyles';
import GrainTexture from '../components/ui/GrainTexture';

// Custom Slider Component (works in Metro/Expo Go)
interface CustomSliderProps {
  value: number;
  onValueChange: (value: number) => void;
  minimumValue?: number;
  maximumValue?: number;
  step?: number;
  accentColor?: string;
  trackColor?: string;
}

const CustomSlider: React.FC<CustomSliderProps> = ({
  value,
  onValueChange,
  minimumValue = 0,
  maximumValue = 10,
  step = 1,
  accentColor = '#0ea5e9',
  trackColor = '#e5e7eb',
}) => {
  const trackRef = useRef<View>(null);
  const layoutRef = useRef({ width: 0, pageX: 0 });

  const getValueFromPageX = (pageX: number) => {
    const { width, pageX: trackLeft } = layoutRef.current;
    if (width === 0) return value;

    const positionX = pageX - trackLeft;
    const percentage = Math.max(0, Math.min(1, positionX / width));
    const rawValue = minimumValue + percentage * (maximumValue - minimumValue);
    const steppedValue = Math.round(rawValue / step) * step;
    return Math.max(minimumValue, Math.min(maximumValue, steppedValue));
  };

  const measureTrack = () => {
    trackRef.current?.measure((x, y, width, height, pageX, pageY) => {
      layoutRef.current = { width, pageX };
    });
  };

  const handleResponderGrant = (evt: any) => {
    // Re-measure on touch start to ensure accuracy
    trackRef.current?.measure((x, y, width, height, pageX, pageY) => {
      layoutRef.current = { width, pageX };
      const newValue = getValueFromPageX(evt.nativeEvent.pageX);
      onValueChange(newValue);
    });
  };

  const handleResponderMove = (evt: any) => {
    const newValue = getValueFromPageX(evt.nativeEvent.pageX);
    onValueChange(newValue);
  };

  const percentage = (value - minimumValue) / (maximumValue - minimumValue);

  return (
    <View style={customSliderStyles.container}>
      <Text style={[customSliderStyles.label, { color: trackColor }]}>0</Text>
      <View
        ref={trackRef}
        style={[customSliderStyles.track, { backgroundColor: trackColor }]}
        onLayout={measureTrack}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={handleResponderGrant}
        onResponderMove={handleResponderMove}
        onResponderTerminationRequest={() => false}
      >
        <View style={[customSliderStyles.filledTrack, { width: `${percentage * 100}%`, backgroundColor: accentColor }]} />
        <View style={[customSliderStyles.thumb, { left: `${percentage * 100}%`, marginLeft: -16, backgroundColor: accentColor }]}>
          <Text style={customSliderStyles.thumbText}>{value}</Text>
        </View>
      </View>
      <Text style={[customSliderStyles.label, { color: trackColor }]}>10</Text>
    </View>
  );
};

const customSliderStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  label: {
    fontSize: 14,
    width: 24,
    textAlign: 'center',
  },
  track: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 8,
    position: 'relative',
    justifyContent: 'center',
  },
  filledTrack: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 4,
  },
  thumb: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    top: -12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  thumbText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
  },
});

import { reviewService, REVIEW_ATTRIBUTES, EligiblePursuit, ReviewRatings } from '../services/reviewService';
import { supabase } from '../config/supabase';

interface WriteReviewScreenProps {
  route: {
    params: {
      revieweeId: string;
      revieweeName: string;
      revieweePhoto?: string;
    };
  };
  navigation: any;
}

export default function WriteReviewScreen({ route, navigation }: WriteReviewScreenProps) {
  const { revieweeId, revieweeName, revieweePhoto } = route.params;
  const { user } = useAuth();
  const { theme, isNewTheme } = useTheme();
  const colors = theme.colors;
  const themedStyles = getThemedStyles(colors, isNewTheme);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [eligiblePursuits, setEligiblePursuits] = useState<EligiblePursuit[]>([]);
  const [selectedPursuit, setSelectedPursuit] = useState<EligiblePursuit | null>(null);
  const [showPursuitPicker, setShowPursuitPicker] = useState(false);
  const [description, setDescription] = useState('');
  const [ratings, setRatings] = useState<ReviewRatings>({});

  const accentColor = isNewTheme ? colors.accentGreen : legacyColors.primary;

  useEffect(() => {
    loadEligiblePursuits();
  }, []);

  const loadEligiblePursuits = async () => {
    if (!user) return;

    try {
      const pursuits = await reviewService.getEligiblePursuitsForReview(user.id, revieweeId);
      setEligiblePursuits(pursuits);

      if (pursuits.length === 0) {
        Alert.alert(
          'Not Eligible',
          'You need to be in a pod together to write a review.',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      } else if (pursuits.length === 1) {
        setSelectedPursuit(pursuits[0]);
      }
    } catch (error) {
      console.error('Error loading eligible pursuits:', error);
      Alert.alert('Error', 'Failed to load eligible pods');
    } finally {
      setLoading(false);
    }
  };

  const getWordCount = () => {
    return description.trim().split(/\s+/).filter(w => w.length > 0).length;
  };

  const getRatedCount = () => {
    return Object.values(ratings).filter(v => v !== null && v !== undefined).length;
  };

  const handleRatingChange = (key: string, value: number) => {
    setRatings(prev => ({
      ...prev,
      [key]: Math.round(value),
    }));
  };

  const clearRating = (key: string) => {
    setRatings(prev => {
      const updated = { ...prev };
      delete updated[key as keyof ReviewRatings];
      return updated;
    });
  };

  const handleSubmit = async () => {
    if (!user || !selectedPursuit) return;

    const wordCount = getWordCount();
    const ratedCount = getRatedCount();

    if (wordCount < 50) {
      Alert.alert('Description Too Short', `Please write at least 50 words (currently ${wordCount} words)`);
      return;
    }

    if (ratedCount < 3) {
      Alert.alert('More Ratings Needed', `Please rate at least 3 attributes (currently ${ratedCount} rated)`);
      return;
    }

    setSubmitting(true);
    try {
      await reviewService.submitReview(
        user.id,
        revieweeId,
        selectedPursuit.pursuit_id,
        description,
        ratings
      );

      Alert.alert('Success', 'Your review has been submitted!', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <StatusBar barStyle={isNewTheme ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
        {isNewTheme && <GrainTexture opacity={0.06} />}
        <ActivityIndicator size="large" color={accentColor} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading...</Text>
      </View>
    );
  }

  const wordCount = getWordCount();
  const ratedCount = getRatedCount();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isNewTheme ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      {isNewTheme && <GrainTexture opacity={0.06} />}
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Write Review</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Reviewee Info */}
        <View style={[styles.revieweeCard, { backgroundColor: colors.surface }]}>
          {revieweePhoto ? (
            <Image source={{ uri: revieweePhoto }} style={styles.revieweeAvatar} />
          ) : (
            <View style={[styles.revieweeAvatarPlaceholder, { backgroundColor: accentColor }]}>
              <Text style={[styles.revieweeAvatarText, { color: isNewTheme ? colors.background : colors.white }]}>
                {revieweeName?.charAt(0).toUpperCase() || '?'}
              </Text>
            </View>
          )}
          <View style={styles.revieweeInfo}>
            <Text style={[styles.reviewingLabel, { color: colors.textSecondary }]}>Reviewing</Text>
            <Text style={[styles.revieweeName, { color: colors.textPrimary }]}>{revieweeName}</Text>
          </View>
        </View>

        {/* Pod Selection */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            <Ionicons name="people" size={18} color={accentColor} /> Select Pod
          </Text>
          <Text style={[styles.sectionHint, { color: colors.textSecondary }]}>
            Choose the pod where you worked together
          </Text>

          <TouchableOpacity
            style={[styles.pursuitSelector, { borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}
            onPress={() => setShowPursuitPicker(true)}
          >
            <Text style={[
              styles.pursuitSelectorText,
              { color: colors.textPrimary },
              !selectedPursuit && { color: colors.textTertiary }
            ]}>
              {selectedPursuit ? selectedPursuit.pursuit_title : 'Select a pod...'}
            </Text>
            <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Description */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            <Ionicons name="document-text" size={18} color={accentColor} /> Your Experience
          </Text>
          <Text style={[styles.sectionHint, { color: colors.textSecondary }]}>
            Describe the project, how you worked together, and your impression of them as a contributor and team member (minimum 50 words)
          </Text>

          <TextInput
            style={[styles.descriptionInput, { borderColor: colors.border, backgroundColor: colors.backgroundSecondary, color: colors.textPrimary }]}
            placeholder="Share your experience working with this person..."
            placeholderTextColor={colors.textTertiary}
            value={description}
            onChangeText={setDescription}
            multiline
            textAlignVertical="top"
          />

          <Text style={[
            styles.wordCount,
            wordCount >= 50 ? { color: colors.success } : { color: colors.error }
          ]}>
            {wordCount}/50 words {wordCount >= 50 ? '✓' : ''}
          </Text>
        </View>

        {/* Ratings */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            <Ionicons name="star" size={18} color={accentColor} /> Rate Attributes
          </Text>
          <Text style={[styles.sectionHint, { color: colors.textSecondary }]}>
            Rate on a scale of 0-10. You must rate at least 3 attributes.
          </Text>

          <Text style={[
            styles.ratedCount,
            ratedCount >= 3 ? { color: colors.success } : { color: colors.warning }
          ]}>
            {ratedCount}/3 minimum rated {ratedCount >= 3 ? '✓' : ''}
          </Text>

          {REVIEW_ATTRIBUTES.map((attr) => (
            <View key={attr.key} style={[styles.ratingCard, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
              <View style={styles.ratingHeader}>
                <View style={styles.ratingLabelContainer}>
                  <Text style={styles.ratingIcon}>{attr.icon}</Text>
                  <View>
                    <Text style={[styles.ratingLabel, { color: colors.textPrimary }]}>{attr.label}</Text>
                    <Text style={[styles.ratingDescription, { color: colors.textSecondary }]}>{attr.description}</Text>
                    {attr.optional && (
                      <Text style={[styles.optionalTag, { color: colors.textTertiary }]}>Only if relevant</Text>
                    )}
                  </View>
                </View>
                {ratings[attr.key as keyof ReviewRatings] !== undefined && (
                  <TouchableOpacity
                    onPress={() => clearRating(attr.key)}
                    style={styles.clearButton}
                  >
                    <Text style={[styles.clearButtonText, { color: colors.error }]}>Clear</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Slider (0-10) */}
              <CustomSlider
                value={ratings[attr.key as keyof ReviewRatings] ?? 5}
                onValueChange={(value) => handleRatingChange(attr.key, value)}
                minimumValue={0}
                maximumValue={10}
                step={1}
                accentColor={accentColor}
                trackColor={colors.border as string}
              />

              {ratings[attr.key as keyof ReviewRatings] === undefined && (
                <Text style={[styles.notRatedText, { color: colors.textTertiary }]}>Drag slider to rate</Text>
              )}
            </View>
          ))}
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[
            styles.submitButton,
            { backgroundColor: accentColor },
            (!selectedPursuit || wordCount < 50 || ratedCount < 3 || submitting) && styles.submitButtonDisabled
          ]}
          onPress={handleSubmit}
          disabled={!selectedPursuit || wordCount < 50 || ratedCount < 3 || submitting}
        >
          {submitting ? (
            <ActivityIndicator color={isNewTheme ? colors.background : colors.white} />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={22} color={isNewTheme ? colors.background : colors.white} />
              <Text style={[styles.submitButtonText, { color: isNewTheme ? colors.background : colors.white }]}>Submit Review</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Pursuit Picker Modal */}
      <Modal
        visible={showPursuitPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPursuitPicker(false)}
      >
        <TouchableOpacity
          style={[styles.modalOverlay, { backgroundColor: isNewTheme ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.5)' }]}
          activeOpacity={1}
          onPress={() => setShowPursuitPicker(false)}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Select Pod</Text>
              <TouchableOpacity onPress={() => setShowPursuitPicker(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll}>
              {eligiblePursuits.map((pursuit) => (
                <TouchableOpacity
                  key={pursuit.pursuit_id}
                  style={[
                    styles.pursuitOption,
                    { backgroundColor: colors.backgroundSecondary, borderColor: colors.border },
                    selectedPursuit?.pursuit_id === pursuit.pursuit_id && { borderColor: accentColor, backgroundColor: isNewTheme ? colors.primaryLight : '#eff6ff' }
                  ]}
                  onPress={() => {
                    setSelectedPursuit(pursuit);
                    setShowPursuitPicker(false);
                  }}
                >
                  <View style={styles.pursuitOptionContent}>
                    <Text style={[styles.pursuitOptionTitle, { color: colors.textPrimary }]}>{pursuit.pursuit_title}</Text>
                  </View>
                  {selectedPursuit?.pursuit_id === pursuit.pursuit_id && (
                    <Ionicons name="checkmark-circle" size={24} color={accentColor} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
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
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.base,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingTop: 60,
    paddingBottom: spacing.base,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: spacing.sm,
  },
  headerTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  revieweeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  revieweeAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  revieweeAvatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  revieweeAvatarText: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
  },
  revieweeInfo: {
    marginLeft: spacing.base,
  },
  reviewingLabel: {
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.xs,
  },
  revieweeName: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
  },
  section: {
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.sm,
  },
  sectionHint: {
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.base,
    lineHeight: 20,
  },
  pursuitSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.base,
  },
  pursuitSelectorText: {
    fontSize: typography.fontSize.base,
    flex: 1,
  },
  descriptionInput: {
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.base,
    fontSize: typography.fontSize.base,
    height: 150,
  },
  wordCount: {
    fontSize: typography.fontSize.sm,
    marginTop: spacing.sm,
    textAlign: 'right',
    fontWeight: typography.fontWeight.medium,
  },
  ratedCount: {
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.base,
    fontWeight: typography.fontWeight.semibold,
  },
  ratingCard: {
    borderRadius: borderRadius.lg,
    padding: spacing.base,
    marginBottom: spacing.md,
    borderWidth: 1,
  },
  ratingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  ratingLabelContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  ratingIcon: {
    fontSize: 24,
    marginRight: spacing.md,
  },
  ratingLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  ratingDescription: {
    fontSize: typography.fontSize.sm,
  },
  optionalTag: {
    fontSize: typography.fontSize.xs,
    fontStyle: 'italic',
    marginTop: spacing.xs,
  },
  clearButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  clearButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  notRatedText: {
    fontSize: typography.fontSize.sm,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: spacing.lg,
    marginVertical: spacing.lg,
    padding: spacing.base,
    borderRadius: borderRadius.lg,
    gap: spacing.sm,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },
  bottomPadding: {
    height: 40,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },
  modalScroll: {
    padding: spacing.lg,
  },
  pursuitOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.base,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
  },
  pursuitOptionContent: {
    flex: 1,
  },
  pursuitOptionTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.xs,
  },
});
