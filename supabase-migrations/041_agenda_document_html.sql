-- Migration: Add HTML document storage for Agenda & Notes
-- This replaces the plain text contribution system with a proper rich text document

-- Create a table for storing the agenda document per pod
CREATE TABLE IF NOT EXISTS pod_agenda_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pod_id UUID NOT NULL REFERENCES pursuits(id) ON DELETE CASCADE,
  content_html TEXT DEFAULT '',
  last_edited_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- One document per pod
  UNIQUE(pod_id)
);

-- Enable RLS
ALTER TABLE pod_agenda_documents ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Only pod members can read/write
CREATE POLICY "Pod members can view agenda documents"
  ON pod_agenda_documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM pursuits p
      WHERE p.id = pod_agenda_documents.pod_id
      AND (
        p.creator_id = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1 FROM team_members tm
          WHERE tm.pursuit_id = p.id
          AND tm.user_id = (SELECT auth.uid())
          AND tm.status = 'active'
        )
      )
    )
  );

CREATE POLICY "Pod members can insert agenda documents"
  ON pod_agenda_documents FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pursuits p
      WHERE p.id = pod_agenda_documents.pod_id
      AND (
        p.creator_id = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1 FROM team_members tm
          WHERE tm.pursuit_id = p.id
          AND tm.user_id = (SELECT auth.uid())
          AND tm.status = 'active'
        )
      )
    )
  );

CREATE POLICY "Pod members can update agenda documents"
  ON pod_agenda_documents FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM pursuits p
      WHERE p.id = pod_agenda_documents.pod_id
      AND (
        p.creator_id = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1 FROM team_members tm
          WHERE tm.pursuit_id = p.id
          AND tm.user_id = (SELECT auth.uid())
          AND tm.status = 'active'
        )
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pursuits p
      WHERE p.id = pod_agenda_documents.pod_id
      AND (
        p.creator_id = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1 FROM team_members tm
          WHERE tm.pursuit_id = p.id
          AND tm.user_id = (SELECT auth.uid())
          AND tm.status = 'active'
        )
      )
    )
  );

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_pod_agenda_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_pod_agenda_documents_timestamp
  BEFORE UPDATE ON pod_agenda_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_pod_agenda_documents_updated_at();

-- Grant permissions
GRANT ALL ON pod_agenda_documents TO authenticated;

