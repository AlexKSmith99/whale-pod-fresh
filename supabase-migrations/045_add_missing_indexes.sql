-- Migration: 045_add_missing_indexes.sql
-- Description: Add indexes for unindexed foreign keys and remove unused indexes
-- This improves JOIN performance on foreign key columns
-- Generated: 2025-01-19

-- ============================================
-- ADD MISSING FOREIGN KEY INDEXES
-- These improve JOIN/WHERE performance on FK columns
-- ============================================

-- board_tasks
CREATE INDEX IF NOT EXISTS idx_board_tasks_assigned_to ON board_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_board_tasks_board_id ON board_tasks(board_id);

-- connections
CREATE INDEX IF NOT EXISTS idx_connections_user_id_2 ON connections(user_id_2);

-- kick_proposals
CREATE INDEX IF NOT EXISTS idx_kick_proposals_created_by ON kick_proposals(created_by);
CREATE INDEX IF NOT EXISTS idx_kick_proposals_pursuit_id ON kick_proposals(pursuit_id);
CREATE INDEX IF NOT EXISTS idx_kick_proposals_target_user_id ON kick_proposals(target_user_id);

-- kickoff_meetings
CREATE INDEX IF NOT EXISTS idx_kickoff_meetings_created_by ON kickoff_meetings(created_by);
CREATE INDEX IF NOT EXISTS idx_kickoff_meetings_pursuit_id ON kickoff_meetings(pursuit_id);

-- kickoff_time_proposals
CREATE INDEX IF NOT EXISTS idx_kickoff_time_proposals_user_id ON kickoff_time_proposals(user_id);

-- meeting_agenda_items
CREATE INDEX IF NOT EXISTS idx_meeting_agenda_items_creator_id ON meeting_agenda_items(creator_id);

-- meeting_contributions
CREATE INDEX IF NOT EXISTS idx_meeting_contributions_user_id ON meeting_contributions(user_id);

-- meeting_notes
CREATE INDEX IF NOT EXISTS idx_meeting_notes_created_by ON meeting_notes(created_by);
CREATE INDEX IF NOT EXISTS idx_meeting_notes_pursuit_id ON meeting_notes(pursuit_id);

-- member_roles
CREATE INDEX IF NOT EXISTS idx_member_roles_user_id ON member_roles(user_id);

-- pod_agenda_documents
CREATE INDEX IF NOT EXISTS idx_pod_agenda_documents_last_edited_by ON pod_agenda_documents(last_edited_by);

-- pod_chat_messages (important for chat performance)
CREATE INDEX IF NOT EXISTS idx_pod_chat_messages_sender_id ON pod_chat_messages(sender_id);

-- pod_chat_read_status
CREATE INDEX IF NOT EXISTS idx_pod_chat_read_status_user_id ON pod_chat_read_status(user_id);

-- pod_meeting_materials
CREATE INDEX IF NOT EXISTS idx_pod_meeting_materials_meeting_page_id ON pod_meeting_materials(meeting_page_id);

-- pod_meeting_pages
CREATE INDEX IF NOT EXISTS idx_pod_meeting_pages_created_by ON pod_meeting_pages(created_by);

-- pursuit_applications
CREATE INDEX IF NOT EXISTS idx_pursuit_applications_interview_meeting_id ON pursuit_applications(interview_meeting_id);

-- shared_media
CREATE INDEX IF NOT EXISTS idx_shared_media_user_id ON shared_media(user_id);

-- team_gallery
CREATE INDEX IF NOT EXISTS idx_team_gallery_pursuit_id ON team_gallery(pursuit_id);
CREATE INDEX IF NOT EXISTS idx_team_gallery_uploaded_by ON team_gallery(uploaded_by);

-- time_slot_proposals
CREATE INDEX IF NOT EXISTS idx_time_slot_proposals_pursuit_id ON time_slot_proposals(pursuit_id);
CREATE INDEX IF NOT EXISTS idx_time_slot_proposals_user_id ON time_slot_proposals(user_id);

-- votes
CREATE INDEX IF NOT EXISTS idx_votes_created_by ON votes(created_by);
CREATE INDEX IF NOT EXISTS idx_votes_pursuit_id ON votes(pursuit_id);

-- ============================================
-- REMOVE UNUSED INDEXES (optional - reduces storage overhead)
-- Only uncomment if you want to remove these
-- ============================================

-- These indexes have never been used according to pg_stat_user_indexes
-- Keeping them commented out for safety - can run manually if desired

-- DROP INDEX IF EXISTS idx_contributions_meeting_date;
-- DROP INDEX IF EXISTS idx_media_pursuit;
-- DROP INDEX IF EXISTS idx_messages_pursuit;
-- DROP INDEX IF EXISTS idx_pursuits_pursuit_categories;
-- DROP INDEX IF EXISTS idx_meetings_creator;
-- DROP INDEX IF EXISTS idx_meetings_scheduled_time;
-- DROP INDEX IF EXISTS idx_reviews_reviewer;
-- DROP INDEX IF EXISTS idx_reviews_pursuit;
-- DROP INDEX IF EXISTS idx_reviews_created_at;
-- DROP INDEX IF EXISTS idx_pursuits_pursuit_type;
-- DROP INDEX IF EXISTS idx_pursuits_category;
-- DROP INDEX IF EXISTS idx_pursuits_location;
-- DROP INDEX IF EXISTS idx_pod_meeting_pages_pod_id;
