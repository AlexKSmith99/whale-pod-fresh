import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { reviewService } from '../services/reviewService';
import { useAuth } from '../contexts/AuthContext';

interface ReviewScreenProps {
  revieweeId: string;
  revieweeName: string;
  pursuitId: string;
  pursuitTitle: string;
  onBack: () => void;
}

const CATEGORIES = [
  { key: 'work_ethic', label: '💼 Work Ethic', description: 'Dedication and effort' },
  { key: 'flexibility', label: '🤸 Flexibility', description: 'Adaptability to change' },
  { key: 'quality_of_work', label: '⭐ Quality of Work', description: 'Output excellence' },
  { key: 'punctuality', label: '⏰ Punctuality', description: 'Timeliness' },
  { key: 'leadership', label: '👑 Leadership', description: 'Ability to lead' },
  { key: 'reliability', label: '🎯 Reliability', description: 'Dependability' },
  { key: 'easy_to_work_with', label: '🤝 Easy to Work With', description: 'Collaboration' },
  { key: 'articulation', label: '💬 Articulation', description: 'Communication clarity' },
  { key: 'charisma', label: '✨ Charisma', description: 'Personal magnetism' },
  { key: 'niceness', label: '😊 Niceness', description: 'Kindness and courtesy' },
  { key: 'creativity', label: '🎨 Creativity', description: 'Innovative thinking' },
  { key: 'technical_skills', label: '🔧 Technical Skills', description: 'Expertise level' },
];

export default function ReviewScreen({
  revieweeId,
  revieweeName,
  pursuitId,
  pursuitTitle,
  onBack,
}: ReviewScreenProps) {
  const { user } = useAuth();
  const [ratings, setRatings] = useState<{ [key: string]: number }>({});
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
      await reviewService.submitReview(user.id, revieweeId, pursuitId, {
        ...ratings,
        comment: comment.trim() || undefined,
      } as any);

      Alert.alert('Success', 'Review submitted!', [{ text: 'OK', onPress: onBack }]);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Review</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          <Text style={styles.reviewingText}>Reviewing</Text>
          <Text style={styles.revieweeName}>{revieweeName}</Text>
          <Text style={styles.pursuitTitle}>for {pursuitTitle}</Text>

          <Text style={styles.instruction}>Rate 1-5 stars for each category:</Text>

          {CATEGORIES.map((category) => (
            <View key={category.key} style={styles.categoryCard}>
              <View style={styles.categoryHeader}>
                <Text style={styles.categoryLabel}>{category.label}</Text>
                <Text style={styles.categoryDescription}>{category.description}</Text>
              </View>
              <View style={styles.starsContainer}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <TouchableOpacity
                    key={star}
                    onPress={() => handleRating(category.key, star)}
                    style={styles.starButton}
                  >
                    <Text style={styles.star}>
                      {ratings[category.key] >= star ? '⭐' : '☆'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}

          <Text style={styles.commentLabel}>Additional Comments (Optional)</Text>
          <TextInput
            style={styles.commentInput}
            placeholder="Share your experience working with this person..."
            value={comment}
            onChangeText={setComment}
            multiline
            numberOfLines={4}
          />

          <TouchableOpacity
            style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            <Text style={styles.submitButtonText}>
              {submitting ? 'Submitting...' : 'Submit Review'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: { padding: 8 },
  backButtonText: { fontSize: 16, color: '#0ea5e9', fontWeight: '600' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#1f2937' },
  scrollView: { flex: 1 },
  content: { padding: 20 },
  reviewingText: { fontSize: 14, color: '#6b7280', textAlign: 'center' },
  revieweeName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 4,
  },
  pursuitTitle: {
    fontSize: 14,
    color: '#0ea5e9',
    textAlign: 'center',
    marginBottom: 24,
  },
  instruction: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 16,
  },
  categoryCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  categoryHeader: { marginBottom: 12 },
  categoryLabel: { fontSize: 16, fontWeight: 'bold', color: '#1f2937', marginBottom: 4 },
  categoryDescription: { fontSize: 13, color: '#6b7280' },
  starsContainer: { flexDirection: 'row', justifyContent: 'space-around' },
  starButton: { padding: 4 },
  star: { fontSize: 32 },
  commentLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginTop: 24,
    marginBottom: 12,
  },
  commentInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    height: 120,
    textAlignVertical: 'top',
    marginBottom: 24,
  },
  submitButton: {
    backgroundColor: '#0ea5e9',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 40,
  },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
});
