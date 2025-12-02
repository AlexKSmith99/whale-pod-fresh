-- Temporarily disable RLS on meetings tables to diagnose the issue
-- This will allow the calendar to work while we figure out the RLS recursion

-- First, drop ALL policies (using CASCADE to ensure everything is removed)
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Drop all policies on meetings table
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'meetings' AND schemaname = 'public')
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON meetings';
    END LOOP;

    -- Drop all policies on meeting_participants table
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'meeting_participants' AND schemaname = 'public')
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON meeting_participants';
    END LOOP;

    -- Drop all policies on kickoff_time_proposals table
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'kickoff_time_proposals' AND schemaname = 'public')
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON kickoff_time_proposals';
    END LOOP;

    -- Drop all policies on meeting_agenda_items table
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'meeting_agenda_items' AND schemaname = 'public')
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON meeting_agenda_items';
    END LOOP;
END $$;

-- Disable RLS on all meeting-related tables
ALTER TABLE meetings DISABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_participants DISABLE ROW LEVEL SECURITY;
ALTER TABLE kickoff_time_proposals DISABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_agenda_items DISABLE ROW LEVEL SECURITY;

-- Note: This makes the tables accessible to all authenticated users
-- We'll implement proper RLS later once the recursion issue is resolved
