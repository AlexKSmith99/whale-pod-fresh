-- Applicant pod interests collected during the application flow:
-- which pod TYPES and pod CATEGORIES they're interested in (multi-select).
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS pod_types text[];
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS pod_categories text[];

NOTIFY pgrst, 'reload schema';
