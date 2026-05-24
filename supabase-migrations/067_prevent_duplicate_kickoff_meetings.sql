-- Migration: 067_prevent_duplicate_kickoff_meetings.sql
-- Description: Two pod members concurrently scheduling a kickoff for the same
-- pursuit could both pass the JS-side conflict check and both INSERT a meeting,
-- leaving duplicate kickoff rows. A unique partial index makes the second insert
-- fail at the database, which the client surfaces as a friendly conflict error.

CREATE UNIQUE INDEX IF NOT EXISTS meetings_one_kickoff_per_pursuit
ON public.meetings (pursuit_id)
WHERE is_kickoff = true;
