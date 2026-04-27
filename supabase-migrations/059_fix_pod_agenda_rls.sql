-- Fix: pod_agenda_documents RLS only allowed team_members with status='active',
-- but accept-application and open-pod join both set status='accepted'. That made
-- saveAgendaDocument fail with 42501 for anyone who joined normally.
-- This migration recreates the SELECT/INSERT/UPDATE policies to accept both
-- 'active' and 'accepted' statuses.

DROP POLICY IF EXISTS "Pod members can view agenda documents" ON pod_agenda_documents;
DROP POLICY IF EXISTS "Pod members can insert agenda documents" ON pod_agenda_documents;
DROP POLICY IF EXISTS "Pod members can update agenda documents" ON pod_agenda_documents;

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
          AND tm.status IN ('active', 'accepted')
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
          AND tm.status IN ('active', 'accepted')
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
          AND tm.status IN ('active', 'accepted')
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
          AND tm.status IN ('active', 'accepted')
        )
      )
    )
  );
