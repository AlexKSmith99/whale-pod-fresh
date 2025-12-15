-- Migration: 027_pod_chat_system.sql
-- Description: Creates tables for Pod Chat (group chat) functionality
-- Date: 2025-12-12

-- Pod Chat Messages table
CREATE TABLE pod_chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pursuit_id UUID NOT NULL REFERENCES pursuits(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Pod Chat Settings table (for custom names)
CREATE TABLE pod_chat_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pursuit_id UUID NOT NULL REFERENCES pursuits(id) ON DELETE CASCADE UNIQUE,
  custom_name TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Pod Chat Read Status table
CREATE TABLE pod_chat_read_status (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pursuit_id UUID NOT NULL REFERENCES pursuits(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  last_read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(pursuit_id, user_id)
);

-- Add indexes for better query performance
CREATE INDEX idx_pod_chat_messages_pursuit ON pod_chat_messages(pursuit_id);
CREATE INDEX idx_pod_chat_messages_created ON pod_chat_messages(created_at);
CREATE INDEX idx_pod_chat_read_status_pursuit_user ON pod_chat_read_status(pursuit_id, user_id);

-- Enable Row Level Security
ALTER TABLE pod_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE pod_chat_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE pod_chat_read_status ENABLE ROW LEVEL SECURITY;

-- RLS Policies for pod_chat_messages
CREATE POLICY "Users can view messages in pods they belong to" ON pod_chat_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM pursuits WHERE id = pursuit_id AND creator_id = auth.uid()
    ) OR EXISTS (
      SELECT 1 FROM team_members WHERE pursuit_id = pod_chat_messages.pursuit_id
        AND user_id = auth.uid() AND status IN ('active', 'accepted')
    )
  );

CREATE POLICY "Users can insert messages in pods they belong to" ON pod_chat_messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid() AND (
      EXISTS (
        SELECT 1 FROM pursuits WHERE id = pursuit_id AND creator_id = auth.uid()
      ) OR EXISTS (
        SELECT 1 FROM team_members WHERE pursuit_id = pod_chat_messages.pursuit_id
          AND user_id = auth.uid() AND status IN ('active', 'accepted')
      )
    )
  );

-- RLS Policies for pod_chat_settings
CREATE POLICY "Users can view settings for pods they belong to" ON pod_chat_settings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM pursuits WHERE id = pursuit_id AND creator_id = auth.uid()
    ) OR EXISTS (
      SELECT 1 FROM team_members WHERE pursuit_id = pod_chat_settings.pursuit_id
        AND user_id = auth.uid() AND status IN ('active', 'accepted')
    )
  );

CREATE POLICY "Pod members can update settings" ON pod_chat_settings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM pursuits WHERE id = pursuit_id AND creator_id = auth.uid()
    ) OR EXISTS (
      SELECT 1 FROM team_members WHERE pursuit_id = pod_chat_settings.pursuit_id
        AND user_id = auth.uid() AND status IN ('active', 'accepted')
    )
  );

-- RLS Policies for pod_chat_read_status
CREATE POLICY "Users can manage their own read status" ON pod_chat_read_status
  FOR ALL USING (user_id = auth.uid());
