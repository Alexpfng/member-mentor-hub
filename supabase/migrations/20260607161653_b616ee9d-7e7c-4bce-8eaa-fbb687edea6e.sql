
-- 1) Move coach_private_notes out of member_profiles into a coach-only table

CREATE TABLE IF NOT EXISTS public.member_coach_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL UNIQUE,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_coach_notes TO authenticated;
GRANT ALL ON public.member_coach_notes TO service_role;

ALTER TABLE public.member_coach_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coach manages member coach notes"
ON public.member_coach_notes
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'coach'))
WITH CHECK (public.has_role(auth.uid(), 'coach'));

CREATE TRIGGER member_coach_notes_set_updated
BEFORE UPDATE ON public.member_coach_notes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Migrate existing data, then drop the leaky column
INSERT INTO public.member_coach_notes (member_id, notes)
SELECT user_id, coach_private_notes
FROM public.member_profiles
WHERE coach_private_notes IS NOT NULL AND coach_private_notes <> ''
ON CONFLICT (member_id) DO UPDATE SET notes = EXCLUDED.notes;

ALTER TABLE public.member_profiles DROP COLUMN IF EXISTS coach_private_notes;

-- 2) Enforce immutability of messages.content / from_id / to_id / created_at
--    Members and coaches may still flip `pinned` and `read`.

CREATE OR REPLACE FUNCTION public.messages_prevent_content_change()
RETURNS trigger
LANGUAGE plpgsql
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

DROP TRIGGER IF EXISTS messages_prevent_content_change ON public.messages;
CREATE TRIGGER messages_prevent_content_change
BEFORE UPDATE ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.messages_prevent_content_change();
