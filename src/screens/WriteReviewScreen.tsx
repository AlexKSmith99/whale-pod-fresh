import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { useAuth } from '../contexts/AuthContext';
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
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [eligiblePursuits, setEligiblePursuits] = useState<EligiblePursuit[]>([]);
  const [selectedPursuit, setSelectedPursuit] = useState<EligiblePursuit | null>(null);
  const [showPursuitPicker, setShowPursuitPicker] = useState(false);
  const [description, setDescription] = useState('');
  const [ratings, setRatings] = useState<ReviewRatings>({});

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
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0ea5e9" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  const wordCount = getWordCount();
  const ratedCount = getRatedCount();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1f2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Write Review</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Reviewee Info */}
        <View style={styles.revieweeCard}>
          {revieweePhoto ? (
            <Image source={{ uri: revieweePhoto }} style={styles.revieweeAvatar} />
          ) : (
            <View style={styles.revieweeAvatarPlaceholder}>
              <Text style={styles.revieweeAvatarText}>
                {revieweeName?.charAt(0).toUpperCase() || '?'}
              </Text>
            </View>
          )}
          <View style={styles.revieweeInfo}>
            <Text style={styles.reviewingLabel}>Reviewing</Text>
            <Text style={styles.revieweeName}>{revieweeName}</Text>
          </View>
        </View>

        {/* Pod Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="people" size={18} color="#0ea5e9" /> Select Pod
          </Text>
          <Text style={styles.sectionHint}>
            Choose the pod where you worked together
          </Text>
          
          <TouchableOpacity 
            style={styles.pursuitSelector}
            onPress={() => setShowPursuitPicker(true)}
          >
            <Text style={[
              styles.pursuitSelectorText,
              !selectedPursuit && styles.pursuitSelectorPlaceholder
            ]}>
              {selectedPursuit ? selectedPursuit.pursuit_title : 'Select a pod...'}
            </Text>
            <Ionicons name="chevron-down" size={20} color="#6b7280" />
          </TouchableOpacity>
          
          {/* TESTING: Hidden meeting count display
          {selectedPursuit && selectedPursuit.shared_meetings > 0 && (
            <Text style={styles.sharedMeetingsText}>
              ✓ {selectedPursuit.shared_meetings} meetings completed together
            </Text>
          )}
          */}
        </View>

        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="document-text" size={18} color="#0ea5e9" /> Your Experience
          </Text>
          <Text style={styles.sectionHint}>
            Describe the project, how you worked together, and your impression of them as a contributor and team member (minimum 50 words)
          </Text>
          
          <TextInput
            style={styles.descriptionInput}
            placeholder="Share your experience working with this person..."
            placeholderTextColor="#9ca3af"
            value={description}
            onChangeText={setDescription}
            multiline
            textAlignVertical="top"
          />
          
          <Text style={[
            styles.wordCount,
            wordCount >= 50 ? styles.wordCountValid : styles.wordCountInvalid
          ]}>
            {wordCount}/50 words {wordCount >= 50 ? '✓' : ''}
          </Text>
        </View>

        {/* Ratings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="star" size={18} color="#0ea5e9" /> Rate Attributes
          </Text>
          <Text style={styles.sectionHint}>
            Rate on a scale of 0-10. You must rate at least 3 attributes.
          </Text>
          
          <Text style={[
            styles.ratedCount,
            ratedCount >= 3 ? styles.ratedCountValid : styles.ratedCountInvalid
          ]}>
            {ratedCount}/3 minimum rated {ratedCount >= 3 ? '✓' : ''}
          </Text>

          {REVIEW_ATTRIBUTES.map((attr) => (
            <View key={attr.key} style={styles.ratingCard}>
              <View style={styles.ratingHeader}>
                <View style={styles.ratingLabelContainer}>
                  <Text style={styles.ratingIcon}>{attr.icon}</Text>
                  <View>
                    <Text style={styles.ratingLabel}>{attr.label}</Text>
                    <Text style={styles.ratingDescription}>{attr.description}</Text>
                    {attr.optional && (
                      <Text style={styles.optionalTag}>Only if relevant</Text>
                    )}
                  </View>
                </View>
                {ratings[attr.key as keyof ReviewRatings] !== undefined && (
                  <TouchableOpacity 
                    onPress={() => clearRating(attr.key)}
                    style={styles.clearButton}
                  >
                    <Text style={styles.clearButtonText}>Clear</Text>
                  </TouchableOpacity>
                )}
              </View>
              
              <View style={styles.sliderContainer}>
                <Text style={styles.sliderMin}>0</Text>
                <Slider
                  style={styles.slider}
                  minimumValue={0}
                  maximumValue={10}
                  step={1}
                  value={ratings[attr.key as keyof ReviewRatings] ?? 5}
                  onSlidingComplete={(value) => handleRatingChange(attr.key, value)}
                  minimumTrackTintColor="#0ea5e9"
                  maximumTrackTintColor="#e5e7eb"
                  thumbTintColor="#0ea5e9"
                />
                <Text style={styles.sliderMax}>10</Text>
              </View>
              
              <View style={styles.ratingValueContainer}>
                {ratings[attr.key as keyof ReviewRatings] !== undefined ? (
                  <View style={styles.ratingValueBadge}>
                    <Text style={styles.ratingValue}>
                      {ratings[attr.key as keyof ReviewRatings]}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.notRatedText}>Not rated</Text>
                )}
              </View>
            </View>
          ))}
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[
            styles.submitButton,
            (!selectedPursuit || wordCount < 50 || ratedCount < 3 || submitting) && styles.submitButtonDisabled
          ]}
          onPress={handleSubmit}
          disabled={!selectedPursuit || wordCount < 50 || ratedCount < 3 || submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={22} color="#fff" />
              <Text style={styles.submitButtonText}>Submit Review</Text>
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
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowPursuitPicker(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Pod</Text>
              <TouchableOpacity onPress={() => setShowPursuitPicker(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalScroll}>
              {eligiblePursuits.map((pursuit) => (
                <TouchableOpacity
                  key={pursuit.pursuit_id}
                  style={[
                    styles.pursuitOption,
                    selectedPursuit?.pursuit_id === pursuit.pursuit_id && styles.pursuitOptionSelected
                  ]}
                  onPress={() => {
                    setSelectedPursuit(pursuit);
                    setShowPursuitPicker(false);
                  }}
                >
                  <View style={styles.pursuitOptionContent}>
                    <Text style={styles.pursuitOptionTitle}>{pursuit.pursuit_title}</Text>
                    {/* TESTING: Hidden meeting count
                    <Text style={styles.pursuitOptionMeetings}>
                      {pursuit.shared_meetings} meetings together
                    </Text>
                    */}
                  </View>
                  {selectedPursuit?.pursuit_id === pursuit.pursuit_id && (
                    <Ionicons name="checkmark-circle" size={24} color="#0ea5e9" />
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
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6b7280',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
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
    backgroundColor: '#fff',
    padding: 20,
    marginBottom: 12,
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
    backgroundColor: '#0ea5e9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  revieweeAvatarText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  revieweeInfo: {
    marginLeft: 16,
  },
  reviewingLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  revieweeName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  section: {
    backgroundColor: '#fff',
    padding: 20,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
  },
  sectionHint: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
    lineHeight: 20,
  },
  pursuitSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    padding: 16,
    backgroundColor: '#f9fafb',
  },
  pursuitSelectorText: {
    fontSize: 16,
    color: '#1f2937',
    flex: 1,
  },
  pursuitSelectorPlaceholder: {
    color: '#9ca3af',
  },
  sharedMeetingsText: {
    fontSize: 13,
    color: '#10b981',
    marginTop: 8,
    fontWeight: '500',
  },
  descriptionInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    backgroundColor: '#f9fafb',
    height: 150,
    color: '#1f2937',
  },
  wordCount: {
    fontSize: 13,
    marginTop: 8,
    textAlign: 'right',
    fontWeight: '500',
  },
  wordCountValid: {
    color: '#10b981',
  },
  wordCountInvalid: {
    color: '#ef4444',
  },
  ratedCount: {
    fontSize: 14,
    marginBottom: 16,
    fontWeight: '600',
  },
  ratedCountValid: {
    color: '#10b981',
  },
  ratedCountInvalid: {
    color: '#f59e0b',
  },
  ratingCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  ratingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  ratingLabelContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  ratingIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  ratingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  ratingDescription: {
    fontSize: 13,
    color: '#6b7280',
  },
  optionalTag: {
    fontSize: 11,
    color: '#9ca3af',
    fontStyle: 'italic',
    marginTop: 4,
  },
  clearButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  clearButtonText: {
    fontSize: 13,
    color: '#ef4444',
    fontWeight: '500',
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  slider: {
    flex: 1,
    height: 40,
  },
  sliderMin: {
    fontSize: 14,
    color: '#9ca3af',
    width: 24,
    textAlign: 'center',
  },
  sliderMax: {
    fontSize: 14,
    color: '#9ca3af',
    width: 24,
    textAlign: 'center',
  },
  ratingValueContainer: {
    alignItems: 'center',
  },
  ratingValueBadge: {
    backgroundColor: '#0ea5e9',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  ratingValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  notRatedText: {
    fontSize: 14,
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0ea5e9',
    marginHorizontal: 20,
    marginVertical: 20,
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  submitButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  bottomPadding: {
    height: 40,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  modalScroll: {
    padding: 20,
  },
  pursuitOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  pursuitOptionSelected: {
    borderColor: '#0ea5e9',
    backgroundColor: '#eff6ff',
  },
  pursuitOptionContent: {
    flex: 1,
  },
  pursuitOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  pursuitOptionMeetings: {
    fontSize: 13,
    color: '#6b7280',
  },
});
