-- Rename the pod type "Explore" -> "Travel" in existing data.
-- Safe to re-run: array_replace only touches exact 'Explore' entries.
UPDATE pursuits
   SET pursuit_types = array_replace(pursuit_types, 'Explore', 'Travel')
 WHERE pursuit_types IS NOT NULL AND 'Explore' = ANY(pursuit_types);

UPDATE profiles
   SET pod_types = array_replace(pod_types, 'Explore', 'Travel')
 WHERE pod_types IS NOT NULL AND 'Explore' = ANY(pod_types);

UPDATE profiles
   SET interests = array_replace(interests, 'Explore', 'Travel')
 WHERE interests IS NOT NULL AND 'Explore' = ANY(interests);
