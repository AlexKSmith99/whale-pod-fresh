-- Migration 040: Team Board Enhancements
-- Adds Meeting Pages, Pod Doc, and Pod Rules functionality

-- =============================================================================
-- 1) POD MEETING PAGES
-- =============================================================================
CREATE TABLE IF NOT EXISTS pod_meeting_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pod_id UUID NOT NULL REFERENCES pursuits(id) ON DELETE CASCADE,
  meeting_date DATE NOT NULL,
  title TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(pod_id, meeting_date)
);

-- =============================================================================
-- 2) POD MEETING AGENDA ITEMS (Pre-meeting)
-- =============================================================================
CREATE TABLE IF NOT EXISTS pod_meeting_agenda_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_page_id UUID NOT NULL REFERENCES pod_meeting_pages(id) ON DELETE CASCADE,
  sort_order INTEGER DEFAULT 0,
  title TEXT NOT NULL,
  description_rich TEXT,
  owner_label TEXT,
  role_label TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- 3) POD MEETING MATERIALS (Links/References for Pre-meeting)
-- =============================================================================
CREATE TABLE IF NOT EXISTS pod_meeting_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_page_id UUID NOT NULL REFERENCES pod_meeting_pages(id) ON DELETE CASCADE,
  sort_order INTEGER DEFAULT 0,
  title TEXT NOT NULL,
  url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- 4) POD MEETING NOTES (Mid-meeting)
-- =============================================================================
CREATE TABLE IF NOT EXISTS pod_meeting_notes (
  meeting_page_id UUID PRIMARY KEY REFERENCES pod_meeting_pages(id) ON DELETE CASCADE,
  notes_rich TEXT,
  font_family TEXT DEFAULT 'System',
  font_size TEXT DEFAULT 'normal',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- 5) POD MEETING RECAP ITEMS (Progress Tracker)
-- =============================================================================
CREATE TABLE IF NOT EXISTS pod_meeting_recap_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_page_id UUID NOT NULL REFERENCES pod_meeting_pages(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('accomplished', 'metrics')),
  sort_order INTEGER DEFAULT 0,
  title TEXT NOT NULL,
  detail TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- 6) POD DOCS (Mission, Northstar, Reference)
-- =============================================================================
CREATE TABLE IF NOT EXISTS pod_docs (
  pod_id UUID PRIMARY KEY REFERENCES pursuits(id) ON DELETE CASCADE,
  mission_rich TEXT,
  northstar_rich TEXT,
  reference_rich TEXT,
  font_family TEXT DEFAULT 'System',
  font_size TEXT DEFAULT 'normal',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- 7) POD RULES
-- =============================================================================
CREATE TABLE IF NOT EXISTS pod_rules (
  pod_id UUID PRIMARY KEY REFERENCES pursuits(id) ON DELETE CASCADE,
  rules_rich TEXT,
  font_family TEXT DEFAULT 'System',
  font_size TEXT DEFAULT 'normal',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- INDEXES
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_pod_meeting_pages_pod_id ON pod_meeting_pages(pod_id);
CREATE INDEX IF NOT EXISTS idx_pod_meeting_pages_date ON pod_meeting_pages(pod_id, meeting_date DESC);
CREATE INDEX IF NOT EXISTS idx_pod_meeting_agenda_items_page ON pod_meeting_agenda_items(meeting_page_id);
CREATE INDEX IF NOT EXISTS idx_pod_meeting_recap_items_page ON pod_meeting_recap_items(meeting_page_id);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================
ALTER TABLE pod_meeting_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE pod_meeting_agenda_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE pod_meeting_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE pod_meeting_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE pod_meeting_recap_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE pod_docs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pod_rules ENABLE ROW LEVEL SECURITY;

-- Helper function to check pod membership
CREATE OR REPLACE FUNCTION is_pod_member(p_pod_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM pursuits WHERE id = p_pod_id AND creator_id = p_user_id
  ) OR EXISTS (
    SELECT 1 FROM team_members 
    WHERE pursuit_id = p_pod_id 
      AND user_id = p_user_id 
      AND status IN ('active', 'accepted')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- RLS POLICIES FOR POD_MEETING_PAGES
-- =============================================================================
CREATE POLICY "Pod members can view meeting pages"
  ON pod_meeting_pages FOR SELECT
  TO authenticated
  USING (is_pod_member(pod_id, (select auth.uid())));

CREATE POLICY "Pod members can create meeting pages"
  ON pod_meeting_pages FOR INSERT
  TO authenticated
  WITH CHECK (is_pod_member(pod_id, (select auth.uid())));

CREATE POLICY "Pod members can update meeting pages"
  ON pod_meeting_pages FOR UPDATE
  TO authenticated
  USING (is_pod_member(pod_id, (select auth.uid())));

CREATE POLICY "Pod members can delete meeting pages"
  ON pod_meeting_pages FOR DELETE
  TO authenticated
  USING (is_pod_member(pod_id, (select auth.uid())));

-- =============================================================================
-- RLS POLICIES FOR POD_MEETING_AGENDA_ITEMS
-- =============================================================================
CREATE POLICY "Pod members can view agenda items"
  ON pod_meeting_agenda_items FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM pod_meeting_pages p 
    WHERE p.id = meeting_page_id 
      AND is_pod_member(p.pod_id, (select auth.uid()))
  ));

CREATE POLICY "Pod members can manage agenda items"
  ON pod_meeting_agenda_items FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM pod_meeting_pages p 
    WHERE p.id = meeting_page_id 
      AND is_pod_member(p.pod_id, (select auth.uid()))
  ));

-- =============================================================================
-- RLS POLICIES FOR POD_MEETING_MATERIALS
-- =============================================================================
CREATE POLICY "Pod members can view materials"
  ON pod_meeting_materials FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM pod_meeting_pages p 
    WHERE p.id = meeting_page_id 
      AND is_pod_member(p.pod_id, (select auth.uid()))
  ));

CREATE POLICY "Pod members can manage materials"
  ON pod_meeting_materials FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM pod_meeting_pages p 
    WHERE p.id = meeting_page_id 
      AND is_pod_member(p.pod_id, (select auth.uid()))
  ));

-- =============================================================================
-- RLS POLICIES FOR POD_MEETING_NOTES
-- =============================================================================
CREATE POLICY "Pod members can view meeting notes"
  ON pod_meeting_notes FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM pod_meeting_pages p 
    WHERE p.id = meeting_page_id 
      AND is_pod_member(p.pod_id, (select auth.uid()))
  ));

CREATE POLICY "Pod members can manage meeting notes"
  ON pod_meeting_notes FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM pod_meeting_pages p 
    WHERE p.id = meeting_page_id 
      AND is_pod_member(p.pod_id, (select auth.uid()))
  ));

-- =============================================================================
-- RLS POLICIES FOR POD_MEETING_RECAP_ITEMS
-- =============================================================================
CREATE POLICY "Pod members can view recap items"
  ON pod_meeting_recap_items FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM pod_meeting_pages p 
    WHERE p.id = meeting_page_id 
      AND is_pod_member(p.pod_id, (select auth.uid()))
  ));

CREATE POLICY "Pod members can manage recap items"
  ON pod_meeting_recap_items FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM pod_meeting_pages p 
    WHERE p.id = meeting_page_id 
      AND is_pod_member(p.pod_id, (select auth.uid()))
  ));

-- =============================================================================
-- RLS POLICIES FOR POD_DOCS
-- =============================================================================
CREATE POLICY "Pod members can view pod docs"
  ON pod_docs FOR SELECT
  TO authenticated
  USING (is_pod_member(pod_id, (select auth.uid())));

CREATE POLICY "Pod members can create pod docs"
  ON pod_docs FOR INSERT
  TO authenticated
  WITH CHECK (is_pod_member(pod_id, (select auth.uid())));

CREATE POLICY "Pod members can update pod docs"
  ON pod_docs FOR UPDATE
  TO authenticated
  USING (is_pod_member(pod_id, (select auth.uid())));

-- =============================================================================
-- RLS POLICIES FOR POD_RULES
-- =============================================================================
CREATE POLICY "Pod members can view pod rules"
  ON pod_rules FOR SELECT
  TO authenticated
  USING (is_pod_member(pod_id, (select auth.uid())));

CREATE POLICY "Pod members can create pod rules"
  ON pod_rules FOR INSERT
  TO authenticated
  WITH CHECK (is_pod_member(pod_id, (select auth.uid())));

CREATE POLICY "Pod members can update pod rules"
  ON pod_rules FOR UPDATE
  TO authenticated
  USING (is_pod_member(pod_id, (select auth.uid())));

-- =============================================================================
-- TRIGGER FOR UPDATED_AT
-- =============================================================================
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_pod_meeting_pages_modtime
  BEFORE UPDATE ON pod_meeting_pages
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_pod_meeting_agenda_items_modtime
  BEFORE UPDATE ON pod_meeting_agenda_items
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_pod_meeting_notes_modtime
  BEFORE UPDATE ON pod_meeting_notes
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_pod_meeting_recap_items_modtime
  BEFORE UPDATE ON pod_meeting_recap_items
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_pod_docs_modtime
  BEFORE UPDATE ON pod_docs
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_pod_rules_modtime
  BEFORE UPDATE ON pod_rules
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- Grant execute on helper function
GRANT EXECUTE ON FUNCTION is_pod_member(UUID, UUID) TO authenticated;

