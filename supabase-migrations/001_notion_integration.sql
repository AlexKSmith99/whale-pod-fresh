-- Create table to store user Notion OAuth tokens and database IDs
CREATE TABLE IF NOT EXISTS user_notion_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  workspace_id TEXT,
  workspace_name TEXT,
  bot_id TEXT,
  database_id TEXT, -- The Notion database created for this user's pods
  connected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Enable Row Level Security
ALTER TABLE user_notion_connections ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only read their own connections
CREATE POLICY "Users can view own notion connections"
  ON user_notion_connections
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own connections
CREATE POLICY "Users can insert own notion connections"
  ON user_notion_connections
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own connections
CREATE POLICY "Users can update own notion connections"
  ON user_notion_connections
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Policy: Users can delete their own connections
CREATE POLICY "Users can delete own notion connections"
  ON user_notion_connections
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX idx_user_notion_connections_user_id ON user_notion_connections(user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER update_user_notion_connections_updated_at
  BEFORE UPDATE ON user_notion_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
