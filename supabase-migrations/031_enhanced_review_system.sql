-- Enhanced Review System Migration
-- Updates review system with new attributes, 0-10 scale, and eligibility requirements

-- First, let's check if the reviews table exists and update it
-- If not, create it fresh with the new schema

-- Drop existing reviews table if it exists (we'll recreate with new schema)
DROP TABLE IF EXISTS reviews CASCADE;

-- Create enhanced reviews table
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reviewer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reviewee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pursuit_id UUID NOT NULL REFERENCES pursuits(id) ON DELETE CASCADE,
  
  -- Description (minimum 50 words required, enforced in app)
  description TEXT NOT NULL,
  
  -- Rating attributes (0-10 scale, all nullable - minimum 3 required, enforced in app)
  overall_satisfaction INTEGER CHECK (overall_satisfaction >= 0 AND overall_satisfaction <= 10),
  kindness INTEGER CHECK (kindness >= 0 AND kindness <= 10),
  work_ethic INTEGER CHECK (work_ethic >= 0 AND work_ethic <= 10),
  quality_of_work INTEGER CHECK (quality_of_work >= 0 AND quality_of_work <= 10),
  punctuality INTEGER CHECK (punctuality >= 0 AND punctuality <= 10),
  leadership INTEGER CHECK (leadership >= 0 AND leadership <= 10),
  responsiveness INTEGER CHECK (responsiveness >= 0 AND responsiveness <= 10),
  intensity INTEGER CHECK (intensity >= 0 AND intensity <= 10),
  reliability INTEGER CHECK (reliability >= 0 AND reliability <= 10),
  collaboration INTEGER CHECK (collaboration >= 0 AND collaboration <= 10),
  technical_competence INTEGER CHECK (technical_competence >= 0 AND technical_competence <= 10),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_reviews_reviewer ON reviews(reviewer_id);
CREATE INDEX idx_reviews_reviewee ON reviews(reviewee_id);
CREATE INDEX idx_reviews_pursuit ON reviews(pursuit_id);
CREATE INDEX idx_reviews_created_at ON reviews(created_at);

-- Unique constraint: one review per reviewer per reviewee per pursuit
-- (90-day limit is enforced in application logic)
CREATE UNIQUE INDEX idx_reviews_unique_per_pursuit ON reviews(reviewer_id, reviewee_id, pursuit_id);

-- Enable RLS
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view reviews about themselves"
  ON reviews FOR SELECT
  USING (reviewee_id = auth.uid());

CREATE POLICY "Users can view reviews they wrote"
  ON reviews FOR SELECT
  USING (reviewer_id = auth.uid());

CREATE POLICY "Users can view reviews in their pods"
  ON reviews FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.pursuit_id = reviews.pursuit_id
      AND team_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can create reviews"
  ON reviews FOR INSERT
  WITH CHECK (
    auth.uid() = reviewer_id
    AND reviewer_id != reviewee_id -- Can't review yourself
  );

CREATE POLICY "Users can update their own reviews"
  ON reviews FOR UPDATE
  USING (reviewer_id = auth.uid());

CREATE POLICY "Users can delete their own reviews"
  ON reviews FOR DELETE
  USING (reviewer_id = auth.uid());

-- Updated_at trigger
CREATE TRIGGER update_reviews_updated_at
  BEFORE UPDATE ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Helper function to count shared completed meetings between two users in a pursuit
CREATE OR REPLACE FUNCTION count_shared_completed_meetings(
  user_a UUID,
  user_b UUID,
  p_pursuit_id UUID
) RETURNS INTEGER AS $$
DECLARE
  shared_count INTEGER;
BEGIN
  SELECT COUNT(DISTINCT m.id) INTO shared_count
  FROM meetings m
  INNER JOIN meeting_participants mp_a ON m.id = mp_a.meeting_id AND mp_a.user_id = user_a
  INNER JOIN meeting_participants mp_b ON m.id = mp_b.meeting_id AND mp_b.user_id = user_b
  WHERE m.pursuit_id = p_pursuit_id
    AND m.status = 'completed'
    AND mp_a.status = 'accepted'
    AND mp_b.status = 'accepted';
  
  RETURN shared_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get eligible pursuits for reviewing a user
CREATE OR REPLACE FUNCTION get_eligible_review_pursuits(
  reviewer UUID,
  reviewee UUID
) RETURNS TABLE (
  pursuit_id UUID,
  pursuit_title TEXT,
  shared_meetings INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT 
    p.id AS pursuit_id,
    p.title AS pursuit_title,
    count_shared_completed_meetings(reviewer, reviewee, p.id) AS shared_meetings
  FROM pursuits p
  -- Both users must be team members (active or creator)
  WHERE (
    EXISTS (
      SELECT 1 FROM team_members tm1 
      WHERE tm1.pursuit_id = p.id 
      AND tm1.user_id = reviewer 
      AND tm1.status IN ('active', 'accepted')
    )
    OR p.creator_id = reviewer
  )
  AND (
    EXISTS (
      SELECT 1 FROM team_members tm2 
      WHERE tm2.pursuit_id = p.id 
      AND tm2.user_id = reviewee 
      AND tm2.status IN ('active', 'accepted')
    )
    OR p.creator_id = reviewee
  )
  -- Must have 5+ shared completed meetings
  AND count_shared_completed_meetings(reviewer, reviewee, p.id) >= 5
  -- Must not have an existing review in the last 90 days
  AND NOT EXISTS (
    SELECT 1 FROM reviews r
    WHERE r.reviewer_id = reviewer
    AND r.reviewee_id = reviewee
    AND r.pursuit_id = p.id
    AND r.created_at > NOW() - INTERVAL '90 days'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
