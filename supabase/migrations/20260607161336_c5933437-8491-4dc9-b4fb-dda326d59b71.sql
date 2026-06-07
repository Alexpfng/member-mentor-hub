
-- Enable RLS on realtime.messages and restrict topic subscriptions
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

-- Helper to authorize a topic for the current user
CREATE OR REPLACE FUNCTION public.can_subscribe_topic(_topic text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL OR _topic IS NULL THEN
    RETURN false;
  END IF;

  -- Per-user private topics: "user:<uid>" or "user:<uid>:<suffix>"
  IF _topic = 'user:' || uid::text
     OR _topic LIKE 'user:' || uid::text || ':%' THEN
    RETURN true;
  END IF;

  -- Coach-only topics: "coach:*"
  IF _topic LIKE 'coach:%' AND public.has_role(uid, 'coach') THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_subscribe_topic(text) TO authenticated;

-- Authorization policy: a user may receive a realtime message only if its
-- topic is one they are authorized to subscribe to.
CREATE POLICY "Authenticated users subscribe to authorized topics"
ON realtime.messages
FOR SELECT
TO authenticated
USING (public.can_subscribe_topic((realtime.topic())::text));
