import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  StatusBar,
} from 'react-native';
import { reviewService } from '../services/reviewService';
import { useAuth } from '../contexts/AuthContext';
import { colors as legacyColors, typography, spacing, borderRadius } from '../theme/designSystem';
import { useTheme } from '../theme/ThemeContext';
import { getThemedStyles } from '../theme/themedStyles';
import GrainTexture from '../components/ui/GrainTexture';

interface ReviewScreenProps {
  revieweeId: string;
  revieweeName: string;
  pursuitId: string;
  pursuitTitle: string;
  onBack: () => void;
}

const CATEGORIES = [
  { key: 'work_ethic', label: 'Work Ethic', description: 'Dedication and effort' },
  { key: 'flexibility', label: 'Flexibility', description: 'Adaptability to change' },
  { key: 'quality_of_work', label: 'Quality of Work', description: 'Output excellence' },
  { key: 'punctuality', label: 'Punctuality', description: 'Timeliness' },
  { key: 'leadership', label: 'Leadership', description: 'Ability to lead' },
  { key: 'reliability', label: 'Reliability', description: 'Dependability' },
  { key: 'easy_to_work_with', label: 'Easy to Work With', description: 'Collaboration' },
  { key: 'articulation', label: 'Articulation', description: 'Communication clarity' },
  { key: 'charisma', label: 'Charisma', description: 'Personal magnetism' },
  { key: 'niceness', label: 'Niceness', description: 'Kindness and courtesy' },
  { key: 'creativity', label: 'Creativity', description: 'Innovative thinking' },
  { key: 'technical_skills', label: 'Technical Skills', description: 'Expertise level' },
];

export default function ReviewScreen({
  revieweeId,
  revieweeName,
  pursuitId,
  pursuitTitle,
  onBack,
}: ReviewScreenProps) {
  const { user } = useAuth();
  const { theme, isNewTheme } = useTheme();
  const colors = theme.colors;
  const themedStyles = getThemedStyles(colors, isNewTheme);

  const [ratings, setRatings] = useState<{ [key: string]: number }>({});
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const accentColor = isNewTheme ? colors.accentGreen : legacyColors.primary;

  const handleRating = (category: string, rating: number) => {
    setRatings({ ...ratings, [category]: rating });
  };

  const handleSubmit = async () => {
    // Validate all categories rated
    const missingCategories = CATEGORIES.filter((cat) => !ratings[cat.key]);
    if (missingCategories.length > 0) {
      Alert.alert('Incomplete', 'Please rate all categories');
      return;
    }

    if (!user) return;

    setSubmitting(true);
    try {
      await reviewService.submitReview(user.id, revieweeId, pursuitId, comment.trim() || '', ratings as any);

      Alert.alert('Success', 'Review submitted!', [{ text: 'OK', onPress: onBack }]);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isNewTheme ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      {isNewTheme && <GrainTexture opacity={0.06} />}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={[styles.backButtonText, { color: accentColor }]}>Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Review</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          <Text style={[styles.reviewingText, { color: colors.textSecondary }]}>Reviewing</Text>
          <Text style={[styles.revieweeName, { color: colors.textPrimary }]}>{revieweeName}</Text>
          <Text style={[styles.pursuitTitle, { color: accentColor }]}>for {pursuitTitle}</Text>

          <Text style={[styles.instruction, { color: colors.textPrimary }]}>Rate 1-5 stars for each category:</Text>

          {CATEGORIES.map((category) => (
            <View key={category.key} style={[styles.categoryCard, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: isNewTheme ? 1 : 0 }]}>
              <View style={styles.categoryHeader}>
                <Text style={[styles.categoryLabel, { color: colors.textPrimary }]}>{category.label}</Text>
                <Text style={[styles.categoryDescription, { color: colors.textSecondary }]}>{category.description}</Text>
              </View>
              <View style={styles.starsContainer}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <TouchableOpacity
                    key={star}
                    onPress={() => handleRating(category.key, star)}
                    style={styles.starButton}
                  >
                    <Text style={styles.star}>
                      {ratings[category.key] >= star ? '★' : '☆'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}

          <Text style={[styles.commentLabel, { color: colors.textPrimary }]}>Additional Comments (Optional)</Text>
          <TextInput
            style={[styles.commentInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
            placeholder="Share your experience working with this person..."
            placeholderTextColor={colors.textTertiary}
            value={comment}
            onChangeText={setComment}
            multiline
            numberOfLines={4}
          />

          <TouchableOpacity
            style={[styles.submitButton, { backgroundColor: accentColor }, submitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            <Text style={[styles.submitButtonText, { color: isNewTheme ? colors.background : colors.white }]}>
              {submitting ? 'Submitting...' : 'Submit Review'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingTop: 60,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: spacing.sm,
  },
  backButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  headerTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
  },
  reviewingText: {
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
  },
  revieweeName: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  pursuitTitle: {
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  instruction: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.base,
  },
  categoryCard: {
    borderRadius: borderRadius.lg,
    padding: spacing.base,
    marginBottom: spacing.md,
  },
  categoryHeader: {
    marginBottom: spacing.md,
  },
  categoryLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.xs,
  },
  categoryDescription: {
    fontSize: typography.fontSize.sm,
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  starButton: {
    padding: spacing.xs,
  },
  star: {
    fontSize: 32,
    color: '#f59e0b',
  },
  commentLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  commentInput: {
    borderWidth: 1,
    borderRadius: borderRadius.base,
    padding: spacing.md,
    fontSize: typography.fontSize.base,
    height: 120,
    textAlignVertical: 'top',
    marginBottom: spacing.xl,
  },
  submitButton: {
    paddingVertical: spacing.base,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    marginBottom: spacing['3xl'],
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },
});
