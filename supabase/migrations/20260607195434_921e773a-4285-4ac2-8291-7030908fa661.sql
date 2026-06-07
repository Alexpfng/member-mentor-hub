
CREATE TABLE public.assignment_weeks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL,
  member_id uuid NOT NULL,
  program_id uuid,
  week_number integer NOT NULL,
  based_on_week integer,
  structure jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','in_progress','done')),
  changes_summary jsonb NOT NULL DEFAULT '[]'::jsonb,
  start_date date,
  published_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_assignment_weeks_member ON public.assignment_weeks(member_id, week_number);
CREATE INDEX idx_assignment_weeks_assignment ON public.assignment_weeks(assignment_id, week_number);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assignment_weeks TO authenticated;
GRANT ALL ON public.assignment_weeks TO service_role;

ALTER TABLE public.assignment_weeks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coach manages all assignment weeks"
  ON public.assignment_weeks FOR ALL
  USING (public.has_role(auth.uid(), 'coach'))
  WITH CHECK (public.has_role(auth.uid(), 'coach'));

CREATE POLICY "Member views own published weeks"
  ON public.assignment_weeks FOR SELECT
  USING (auth.uid() = member_id AND status IN ('published','in_progress','done'));

CREATE TRIGGER trg_assignment_weeks_updated
  BEFORE UPDATE ON public.assignment_weeks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Bootstrap : pour chaque assignment actif, créer les semaines déjà existantes en 'published'
INSERT INTO public.assignment_weeks (assignment_id, member_id, program_id, week_number, structure, status, published_at, start_date)
SELECT
  a.id,
  a.member_id,
  a.program_id,
  w.idx::int,
  COALESCE(w.week, '{}'::jsonb),
  'published',
  a.created_at,
  a.start_date
FROM public.assignments a
JOIN public.programs p ON p.id = a.program_id
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(p.structure->'weeks','[]'::jsonb)) WITH ORDINALITY AS w(week, idx)
WHERE a.active = true
ON CONFLICT DO NOTHING;

ALTER PUBLICATION supabase_realtime ADD TABLE public.assignment_weeks;
