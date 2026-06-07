
CREATE OR REPLACE FUNCTION public.messages_prevent_content_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.content IS DISTINCT FROM OLD.content
     OR NEW.from_id IS DISTINCT FROM OLD.from_id
     OR NEW.to_id IS DISTINCT FROM OLD.to_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'messages.content, from_id, to_id and created_at are immutable';
  END IF;
  RETURN NEW;
END;
$$;
