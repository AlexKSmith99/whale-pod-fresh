-- Helper function to insert notifications for any user without running into RLS barriers
-- This lets authenticated clients request notification creation while the function
-- runs with elevated privileges to perform the actual insert.

-- Ensure we start from a clean state when re-running migrations locally
DROP FUNCTION IF EXISTS public.create_notifications(jsonb);

CREATE OR REPLACE FUNCTION public.create_notifications(input_notifications jsonb)
RETURNS SETOF public.notifications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF input_notifications IS NULL OR jsonb_typeof(input_notifications) <> 'array' THEN
    RAISE EXCEPTION 'input_notifications must be a JSON array';
  END IF;

  RETURN QUERY
  INSERT INTO public.notifications (
    user_id,
    title,
    body,
    type,
    related_id,
    related_type,
    action_url,
    data
  )
  SELECT
    (notification ->> 'user_id')::uuid,
    COALESCE(notification ->> 'title', ''),
    COALESCE(notification ->> 'body', ''),
    COALESCE(notification ->> 'type', 'general'),
    NULLIF(notification ->> 'related_id', '')::uuid,
    NULLIF(notification ->> 'related_type', ''),
    NULLIF(notification ->> 'action_url', ''),
    notification -> 'data'
  FROM jsonb_array_elements(input_notifications) AS notification
  RETURNING *;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_notifications(jsonb) TO authenticated;
