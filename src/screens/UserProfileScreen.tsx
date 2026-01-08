import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../config/supabase';
import { useAuth } from '../contexts/AuthContext';
import { connectionService } from '../services/connectionService';
import { reviewService, REVIEW_ATTRIBUTES } from '../services/reviewService';

export default function UserProfileScreen({ route, navigation, onWriteReview }: any) {
  const { userId } = route.params;
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'about' | 'reviews'>('about');
  const [canReview, setCanReview] = useState(false);
  const [reviews, setReviews] = useState<any[]>([]);
  const [averageRatings, setAverageRatings] = useState<any>(null);
  const [reviewsLoading, setReviewsLoading] = useState(false);

  useEffect(() => {
    // Redirect to own profile if viewing yourself
    if (user && userId === user.id) {
      navigation.replace('Profile');
      return;
    }

    loadProfile();
    checkConnection();
    checkCanReview();
    loadReviews();
  }, [userId, user]);

  const loadProfile = async () => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      setProfile(data);
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkConnection = async () => {
    if (user) {
      const connected = await connectionService.areConnected(user.id, userId);
      setIsConnected(connected);
    }
  };

  const checkCanReview = async () => {
    if (user) {
      try {
        const eligible = await reviewService.canReviewUser(user.id, userId);
        setCanReview(eligible);
      } catch (error) {
        console.error('Error checking review eligibility:', error);
      }
    }
  };

  const loadReviews = async () => {
    setReviewsLoading(true);
    try {
      const [reviewsData, ratingsData] = await Promise.all([
        reviewService.getReviewsForUser(userId),
        reviewService.getAverageRatings(userId),
      ]);
      setReviews(reviewsData);
      setAverageRatings(ratingsData);
    } catch (error) {
      console.error('Error loading reviews:', error);
    } finally {
      setReviewsLoading(false);
    }
  };

  const handleWriteReview = () => {
    Alert.alert('Button Pressed', `onWriteReview exists: ${!!onWriteReview}, userId: ${userId}`);
    if (onWriteReview) {
      // Use direct callback prop
      onWriteReview(userId, profile?.name || 'User', profile?.profile_picture);
    } else if (navigation && navigation.navigate) {
      // Fallback to navigation
      navigation.navigate('WriteReview', {
        revieweeId: userId,
        revieweeName: profile?.name || 'User',
        revieweePhoto: profile?.profile_picture,
      });
    } else {
      Alert.alert('Error', 'Navigation not available');
    }
  };

  const handleConnect = async () => {
    try {
      if (user) {
        await connectionService.sendConnectionRequest(user.id, userId);
        Alert.alert('Success', 'Connection request sent!');
      }
    } catch (error) {
      console.error('Error sending connection request:', error);
      Alert.alert('Error', 'Failed to send connection request');
    }
  };

  const handleMessage = () => {
    navigation.navigate('Chat', {
      partnerId: userId,
      partnerEmail: profile?.email || 'User',
    });
  };

  const handleOpenLink = (url: string) => {
    if (!url) return;

    let fullUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      fullUrl = 'https://' + url;
    }

    Linking.openURL(fullUrl).catch((err) => {
      console.error('Error opening link:', err);
      Alert.alert('Error', 'Could not open link');
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      <View style={styles.profileSection}>
        {profile?.profile_picture ? (
          <Image source={{ uri: profile.profile_picture }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarText}>
              {profile?.name?.charAt(0).toUpperCase() || '?'}
            </Text>
          </View>
        )}

        <Text style={styles.name}>
          {profile?.name || 'Name not set'}
        </Text>

        {profile?.bio && <Text style={styles.bio}>{profile.bio}</Text>}
      </View>

      <View style={styles.actionButtons}>
        {!isConnected && (
          <TouchableOpacity style={styles.connectButton} onPress={handleConnect}>
            <Ionicons name="person-add" size={20} color="#fff" />
            <Text style={styles.connectButtonText}>Connect</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.messageButton} onPress={handleMessage}>
          <Ionicons name="chatbubble" size={20} color="#0ea5e9" />
          <Text style={styles.messageButtonText}>Message</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'about' && styles.tabActive]}
          onPress={() => setActiveTab('about')}
        >
          <Text style={[styles.tabText, activeTab === 'about' && styles.tabTextActive]}>
            About
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'reviews' && styles.tabActive]}
          onPress={() => setActiveTab('reviews')}
        >
          <Text style={[styles.tabText, activeTab === 'reviews' && styles.tabTextActive]}>
            Reviews ({reviews.length})
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'about' && (
        <>
      {/* Social Links */}
      {(profile?.linkedin || profile?.instagram || profile?.github || profile?.facebook || profile?.portfolio_website) && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Links</Text>
          {profile?.linkedin && (
            <TouchableOpacity style={styles.linkItem} onPress={() => handleOpenLink(profile.linkedin)}>
              <Ionicons name="logo-linkedin" size={20} color="#0077b5" />
              <Text style={styles.linkText}>LinkedIn</Text>
              <Ionicons name="open-outline" size={16} color="#999" style={styles.linkArrow} />
            </TouchableOpacity>
          )}
          {profile?.instagram && (
            <TouchableOpacity style={styles.linkItem} onPress={() => handleOpenLink(profile.instagram)}>
              <Ionicons name="logo-instagram" size={20} color="#e4405f" />
              <Text style={styles.linkText}>Instagram</Text>
              <Ionicons name="open-outline" size={16} color="#999" style={styles.linkArrow} />
            </TouchableOpacity>
          )}
          {profile?.facebook && (
            <TouchableOpacity style={styles.linkItem} onPress={() => handleOpenLink(profile.facebook)}>
              <Ionicons name="logo-facebook" size={20} color="#1877f2" />
              <Text style={styles.linkText}>Facebook</Text>
              <Ionicons name="open-outline" size={16} color="#999" style={styles.linkArrow} />
            </TouchableOpacity>
          )}
          {profile?.github && (
            <TouchableOpacity style={styles.linkItem} onPress={() => handleOpenLink(profile.github)}>
              <Ionicons name="logo-github" size={20} color="#333" />
              <Text style={styles.linkText}>GitHub</Text>
              <Ionicons name="open-outline" size={16} color="#999" style={styles.linkArrow} />
            </TouchableOpacity>
          )}
          {profile?.portfolio_website && (
            <TouchableOpacity style={styles.linkItem} onPress={() => handleOpenLink(profile.portfolio_website)}>
              <Ionicons name="globe-outline" size={20} color="#0ea5e9" />
              <Text style={styles.linkText}>Portfolio</Text>
              <Ionicons name="open-outline" size={16} color="#999" style={styles.linkArrow} />
            </TouchableOpacity>
          )}
        </View>
      )}
        </>
      )}

      {activeTab === 'reviews' && (
        <View style={styles.reviewsContainer}>
          {/* Write Review Button - TESTING: Always show */}
          <TouchableOpacity style={styles.writeReviewButton} onPress={handleWriteReview}>
            <Ionicons name="add-circle" size={22} color="#fff" />
            <Text style={styles.writeReviewButtonText}>Write a Review</Text>
          </TouchableOpacity>
          {!canReview && (
            <Text style={{ color: '#f59e0b', fontSize: 12, textAlign: 'center', marginBottom: 8 }}>
              (Testing mode - normally hidden until eligible)
            </Text>
          )}

          {reviewsLoading ? (
            <View style={styles.reviewsLoading}>
              <ActivityIndicator size="small" color="#0ea5e9" />
              <Text style={styles.reviewsLoadingText}>Loading reviews...</Text>
            </View>
          ) : reviews.length === 0 ? (
            <View style={styles.noReviews}>
              <Ionicons name="star-outline" size={48} color="#d1d5db" />
              <Text style={styles.noReviewsText}>No reviews yet</Text>
              <Text style={styles.noReviewsSubtext}>
                Reviews will appear here after teammates share their feedback
              </Text>
            </View>
          ) : (
            <>
              {/* Average Ratings Summary */}
              {averageRatings && averageRatings.count > 0 && (
                <View style={styles.ratingsCard}>
                  <View style={styles.overallRating}>
                    <Text style={styles.overallRatingNumber}>
                      {averageRatings.overall.toFixed(1)}
                    </Text>
                    <Text style={styles.overallRatingLabel}>Overall</Text>
                    <Text style={styles.overallRatingCount}>
                      Based on {averageRatings.count} review{averageRatings.count !== 1 ? 's' : ''}
                    </Text>
                  </View>
                </View>
              )}

              {/* Individual Reviews */}
              {reviews.map((review) => (
                <View key={review.id} style={styles.reviewCard}>
                  <View style={styles.reviewHeader}>
                    <View style={styles.reviewerInfo}>
                      <View style={styles.reviewerAvatarSmall}>
                        <Text style={styles.reviewerAvatarTextSmall}>
                          {review.reviewer?.name?.charAt(0).toUpperCase() || '?'}
                        </Text>
                      </View>
                      <View>
                        <Text style={styles.reviewerName}>
                          {review.reviewer?.name || 'Anonymous'}
                        </Text>
                        <Text style={styles.reviewPursuit}>
                          {review.pursuit?.title || 'Unknown Pod'}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.reviewDate}>
                      {new Date(review.created_at).toLocaleDateString()}
                    </Text>
                  </View>

                  <Text style={styles.reviewDescription}>{review.description}</Text>

                  {/* Rating Pills */}
                  <View style={styles.ratingPills}>
                    {REVIEW_ATTRIBUTES.filter(attr => 
                      review[attr.key] !== null && review[attr.key] !== undefined
                    ).slice(0, 4).map(attr => (
                      <View key={attr.key} style={styles.ratingPill}>
                        <Text style={styles.ratingPillIcon}>{attr.icon}</Text>
                        <Text style={styles.ratingPillValue}>{review[attr.key]}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </>
          )}
        </View>
      )}
    </ScrollView>
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
  },
  header: {
    padding: 20,
    paddingTop: 50,
    backgroundColor: '#fff',
  },
  backButton: {
    padding: 4,
  },
  profileSection: {
    backgroundColor: '#fff',
    alignItems: 'center',
    padding: 30,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#0ea5e9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#fff',
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
  },
  email: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  bio: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 20,
  },
  actionButtons: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
  },
  connectButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#0ea5e9',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  connectButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  messageButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#0ea5e9',
  },
  messageButtonText: {
    color: '#0ea5e9',
    fontSize: 16,
    fontWeight: '600',
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 10,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  linkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  linkText: {
    fontSize: 15,
    color: '#333',
    marginLeft: 12,
    flex: 1,
  },
  linkArrow: {
    marginLeft: 8,
  },
  // Tabs
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginTop: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#0ea5e9',
  },
  tabText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#6b7280',
  },
  tabTextActive: {
    color: '#0ea5e9',
    fontWeight: '600',
  },
  // Reviews
  reviewsContainer: {
    padding: 16,
  },
  writeReviewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10b981',
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
    gap: 8,
  },
  writeReviewButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  reviewsLoading: {
    alignItems: 'center',
    padding: 40,
  },
  reviewsLoadingText: {
    marginTop: 8,
    color: '#6b7280',
  },
  noReviews: {
    alignItems: 'center',
    padding: 40,
  },
  noReviewsText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6b7280',
    marginTop: 12,
  },
  noReviewsSubtext: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  ratingsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  overallRating: {
    alignItems: 'center',
  },
  overallRatingNumber: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#0ea5e9',
  },
  overallRatingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginTop: 4,
  },
  overallRatingCount: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 4,
  },
  reviewCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  reviewerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reviewerAvatarSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0ea5e9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  reviewerAvatarTextSmall: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  reviewerName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
  },
  reviewPursuit: {
    fontSize: 13,
    color: '#0ea5e9',
    marginTop: 2,
  },
  reviewDate: {
    fontSize: 12,
    color: '#9ca3af',
  },
  reviewDescription: {
    fontSize: 14,
    color: '#4b5563',
    lineHeight: 21,
    marginBottom: 12,
  },
  ratingPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  ratingPillIcon: {
    fontSize: 14,
  },
  ratingPillValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
});