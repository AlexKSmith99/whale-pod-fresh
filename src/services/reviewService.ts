import { supabase } from '../config/supabase';

// New attribute list (0-10 scale)
export const REVIEW_ATTRIBUTES = [
  { key: 'overall_satisfaction', label: 'Overall Satisfaction', description: 'How satisfied were you working with this person?', icon: '⭐' },
  { key: 'kindness', label: 'Kindness', description: 'Were they friendly and considerate?', icon: '💛' },
  { key: 'work_ethic', label: 'Work Ethic', description: 'How dedicated were they to the work?', icon: '💪' },
  { key: 'quality_of_work', label: 'Quality of Work', description: 'How was the quality of their contributions?', icon: '✨' },
  { key: 'punctuality', label: 'Punctuality', description: 'Were they on time for meetings and deadlines?', icon: '⏰' },
  { key: 'leadership', label: 'Leadership', description: 'Did they show leadership when relevant?', icon: '👑', optional: true },
  { key: 'responsiveness', label: 'Responsiveness', description: 'How quickly did they respond to messages?', icon: '💬' },
  { key: 'intensity', label: 'Intensity', description: 'How focused and driven were they?', icon: '🔥' },
  { key: 'reliability', label: 'Reliability', description: 'Could you count on them?', icon: '🎯' },
  { key: 'collaboration', label: 'Collaboration', description: 'How well did they work with the team?', icon: '🤝' },
  { key: 'technical_competence', label: 'Technical Competence', description: 'How skilled were they in their area?', icon: '🔧' },
];

export interface Review {
  id: string;
  reviewer_id: string;
  reviewee_id: string;
  pursuit_id: string;
  description: string;
  overall_satisfaction: number | null;
  kindness: number | null;
  work_ethic: number | null;
  quality_of_work: number | null;
  punctuality: number | null;
  leadership: number | null;
  responsiveness: number | null;
  intensity: number | null;
  reliability: number | null;
  collaboration: number | null;
  technical_competence: number | null;
  created_at: string;
  updated_at: string;
  reviewer?: {
    name?: string;
    profile_picture?: string;
  };
  pursuit?: {
    title: string;
  };
}

export interface EligiblePursuit {
  pursuit_id: string;
  pursuit_title: string;
  shared_meetings: number;
}

export interface ReviewRatings {
  overall_satisfaction?: number | null;
  kindness?: number | null;
  work_ethic?: number | null;
  quality_of_work?: number | null;
  punctuality?: number | null;
  leadership?: number | null;
  responsiveness?: number | null;
  intensity?: number | null;
  reliability?: number | null;
  collaboration?: number | null;
  technical_competence?: number | null;
}

export const reviewService = {
  /**
   * Get pursuits where reviewer can review the reviewee
   * TESTING MODE: Only requires being in the same pod (no meeting count requirement)
   * TODO: Change back to require 5+ shared completed meetings
   */
  async getEligiblePursuitsForReview(reviewerId: string, revieweeId: string): Promise<EligiblePursuit[]> {
    // TESTING: Skip the RPC and use simplified client-side logic
    return this.getEligiblePursuitsClientSide(reviewerId, revieweeId);
  },

  /**
   * Client-side logic for getting eligible pursuits
   * TESTING MODE: Only requires being in the same pod (no meeting count requirement)
   * TODO: Add back 5+ shared completed meetings requirement
   */
  async getEligiblePursuitsClientSide(reviewerId: string, revieweeId: string): Promise<EligiblePursuit[]> {
    try {
      // Get all pursuits where both users are members
      const { data: reviewerMemberships } = await supabase
        .from('team_members')
        .select('pursuit_id')
        .eq('user_id', reviewerId)
        .in('status', ['active', 'accepted']);

      const { data: revieweeMemberships } = await supabase
        .from('team_members')
        .select('pursuit_id')
        .eq('user_id', revieweeId)
        .in('status', ['active', 'accepted']);

      // Also check if either is a creator
      const { data: reviewerCreated } = await supabase
        .from('pursuits')
        .select('id')
        .eq('creator_id', reviewerId);

      const { data: revieweeCreated } = await supabase
        .from('pursuits')
        .select('id')
        .eq('creator_id', revieweeId);

      // Combine pursuit IDs for each user
      const reviewerPursuitIds = new Set([
        ...(reviewerMemberships?.map(m => m.pursuit_id) || []),
        ...(reviewerCreated?.map(p => p.id) || []),
      ]);

      const revieweePursuitIds = new Set([
        ...(revieweeMemberships?.map(m => m.pursuit_id) || []),
        ...(revieweeCreated?.map(p => p.id) || []),
      ]);

      // Find common pursuits
      const commonPursuitIds = [...reviewerPursuitIds].filter(id => revieweePursuitIds.has(id));

      if (commonPursuitIds.length === 0) return [];

      // Get pursuit details
      const { data: pursuits } = await supabase
        .from('pursuits')
        .select('id, title')
        .in('id', commonPursuitIds);

      if (!pursuits) return [];

      // TESTING: Skip meeting count check, just check for existing review
      const eligiblePursuits: EligiblePursuit[] = [];

      for (const pursuit of pursuits) {
        // Check if already reviewed in last 90 days
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

        const { data: existingReview } = await supabase
          .from('reviews')
          .select('id')
          .eq('reviewer_id', reviewerId)
          .eq('reviewee_id', revieweeId)
          .eq('pursuit_id', pursuit.id)
          .gte('created_at', ninetyDaysAgo.toISOString())
          .single();

        if (!existingReview) {
          eligiblePursuits.push({
            pursuit_id: pursuit.id,
            pursuit_title: pursuit.title,
            shared_meetings: 0, // TESTING: Not counting meetings
          });
        }
      }

      return eligiblePursuits;
    } catch (error) {
      console.error('Error in client-side eligible pursuits check:', error);
      return [];
    }
  },

  /**
   * Check if reviewer can review the reviewee (has any eligible pursuits)
   */
  async canReviewUser(reviewerId: string, revieweeId: string): Promise<boolean> {
    if (reviewerId === revieweeId) return false;
    
    const eligiblePursuits = await this.getEligiblePursuitsForReview(reviewerId, revieweeId);
    return eligiblePursuits.length > 0;
  },

  /**
   * Submit a new review
   */
  async submitReview(
    reviewerId: string,
    revieweeId: string,
    pursuitId: string,
    description: string,
    ratings: ReviewRatings
  ): Promise<void> {
    // Validate minimum 3 ratings
    const ratedAttributes = Object.entries(ratings).filter(([_, value]) => value !== null && value !== undefined);
    if (ratedAttributes.length < 3) {
      throw new Error('Please rate at least 3 attributes');
    }

    // Validate description word count
    const wordCount = description.trim().split(/\s+/).filter(w => w.length > 0).length;
    if (wordCount < 50) {
      throw new Error(`Description must be at least 50 words (currently ${wordCount} words)`);
    }

    const { error } = await supabase.from('reviews').insert({
      reviewer_id: reviewerId,
      reviewee_id: revieweeId,
      pursuit_id: pursuitId,
      description: description.trim(),
      ...ratings,
    });

    if (error) {
      if (error.code === '23505') {
        throw new Error('You have already reviewed this user for this pod');
      }
      throw error;
    }
  },

  /**
   * Get reviews received by a user
   */
  async getReviewsForUser(userId: string): Promise<Review[]> {
    const { data, error } = await supabase
      .from('reviews')
      .select(`
        *,
        reviewer:profiles!reviewer_id(name, profile_picture),
        pursuit:pursuits(title)
      `)
      .eq('reviewee_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /**
   * Check if a review exists (within 90 days for the same pursuit)
   */
  async hasReviewed(reviewerId: string, revieweeId: string, pursuitId: string): Promise<boolean> {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const { data, error } = await supabase
      .from('reviews')
      .select('id')
      .eq('reviewer_id', reviewerId)
      .eq('reviewee_id', revieweeId)
      .eq('pursuit_id', pursuitId)
      .gte('created_at', ninetyDaysAgo.toISOString())
      .single();

    return !error && !!data;
  },

  /**
   * Get average ratings for a user across all reviews
   */
  async getAverageRatings(userId: string): Promise<{
    [key: string]: number;
    overall: number;
    count: number;
  }> {
    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('reviewee_id', userId);

    if (error || !data || data.length === 0) {
      return {
        overall_satisfaction: 0,
        kindness: 0,
        work_ethic: 0,
        quality_of_work: 0,
        punctuality: 0,
        leadership: 0,
        responsiveness: 0,
        intensity: 0,
        reliability: 0,
        collaboration: 0,
        technical_competence: 0,
        overall: 0,
        count: 0,
      };
    }

    const attributes = REVIEW_ATTRIBUTES.map(a => a.key);
    const averages: any = { count: data.length };
    let totalSum = 0;
    let totalCount = 0;

    attributes.forEach((attr) => {
      const values = data.map(review => review[attr]).filter(v => v !== null && v !== undefined);
      if (values.length > 0) {
        const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
        averages[attr] = Math.round(avg * 10) / 10;
        totalSum += avg;
        totalCount++;
      } else {
        averages[attr] = 0;
      }
    });

    averages.overall = totalCount > 0 ? Math.round((totalSum / totalCount) * 10) / 10 : 0;

    return averages;
  },

  /**
   * Get reviews written by a user
   */
  async getReviewsWrittenByUser(userId: string): Promise<Review[]> {
    const { data, error } = await supabase
      .from('reviews')
      .select(`
        *,
        reviewee:profiles!reviewee_id(name, profile_picture),
        pursuit:pursuits(title)
      `)
      .eq('reviewer_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },
};
