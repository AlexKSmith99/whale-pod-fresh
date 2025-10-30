import { supabase } from '../config/supabase';

export interface Review {
  id: string;
  reviewer_id: string;
  reviewee_id: string;
  pursuit_id: string;
  work_ethic: number;
  flexibility: number;
  quality_of_work: number;
  punctuality: number;
  leadership: number;
  reliability: number;
  easy_to_work_with: number;
  articulation: number;
  charisma: number;
  niceness: number;
  creativity: number;
  technical_skills: number;
  comment?: string;
  created_at: string;
  reviewer?: {
    name?: string;
    profile_picture?: string;
  };
  pursuit?: {
    title: string;
  };
}

export const reviewService = {
  async submitReview(
    reviewerId: string,
    revieweeId: string,
    pursuitId: string,
    ratings: {
      work_ethic: number;
      flexibility: number;
      quality_of_work: number;
      punctuality: number;
      leadership: number;
      reliability: number;
      easy_to_work_with: number;
      articulation: number;
      charisma: number;
      niceness: number;
      creativity: number;
      technical_skills: number;
      comment?: string;
    }
  ): Promise<void> {
    const { error } = await supabase.from('reviews').insert({
      reviewer_id: reviewerId,
      reviewee_id: revieweeId,
      pursuit_id: pursuitId,
      ...ratings,
    });

    if (error) throw error;
  },

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

  async hasReviewed(reviewerId: string, revieweeId: string, pursuitId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('reviews')
      .select('id')
      .eq('reviewer_id', reviewerId)
      .eq('reviewee_id', revieweeId)
      .eq('pursuit_id', pursuitId)
      .single();

    return !error && !!data;
  },

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
        work_ethic: 0,
        flexibility: 0,
        quality_of_work: 0,
        punctuality: 0,
        leadership: 0,
        reliability: 0,
        easy_to_work_with: 0,
        articulation: 0,
        charisma: 0,
        niceness: 0,
        creativity: 0,
        technical_skills: 0,
        overall: 0,
        count: 0,
      };
    }

    const categories = [
      'work_ethic',
      'flexibility',
      'quality_of_work',
      'punctuality',
      'leadership',
      'reliability',
      'easy_to_work_with',
      'articulation',
      'charisma',
      'niceness',
      'creativity',
      'technical_skills',
    ];

    const averages: any = { count: data.length };
    let totalSum = 0;

    categories.forEach((category) => {
      const sum = data.reduce((acc, review) => acc + (review[category] || 0), 0);
      const avg = sum / data.length;
      averages[category] = Math.round(avg * 10) / 10;
      totalSum += avg;
    });

    averages.overall = Math.round((totalSum / categories.length) * 10) / 10;

    return averages;
  },
};
