-- Allow pod creators to mark a pod as "open" so anyone can join instantly
-- without an application/interview flow.

ALTER TABLE pursuits ADD COLUMN IF NOT EXISTS is_open_pod boolean DEFAULT false;
