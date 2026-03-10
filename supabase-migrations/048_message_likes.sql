-- Message likes table for both direct messages and pod chat messages
CREATE TABLE IF NOT EXISTS message_likes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id uuid NOT NULL,
  message_type text NOT NULL CHECK (message_type IN ('direct', 'pod')),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(message_id, message_type, user_id)
);

-- Indexes for fast lookups
CREATE INDEX idx_message_likes_message ON message_likes(message_id, message_type);
CREATE INDEX idx_message_likes_user ON message_likes(user_id);

-- Enable RLS
ALTER TABLE message_likes ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view likes
CREATE POLICY "Users can view likes"
  ON message_likes FOR SELECT
  TO authenticated
  USING (true);

-- Users can insert their own likes
CREATE POLICY "Users can like messages"
  ON message_likes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own likes (unlike)
CREATE POLICY "Users can unlike messages"
  ON message_likes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
