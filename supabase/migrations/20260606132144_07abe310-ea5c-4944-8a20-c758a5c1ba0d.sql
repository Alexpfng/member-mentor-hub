-- 1. Table pain_reports
CREATE TABLE public.pain_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL,
  session_id uuid,
  exercise_name text NOT NULL,
  zone text NOT NULL,
  intensity integer NOT NULL CHECK (intensity BETWEEN 1 AND 5),
  comment text,
  resolved_at timestamptz,
  resolved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pain_reports TO authenticated;
GRANT ALL ON public.pain_reports TO service_role;

ALTER TABLE public.pain_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Member manages own pain reports"
ON public.pain_reports FOR ALL
USING (auth.uid() = member_id)
WITH CHECK (auth.uid() = member_id);

CREATE POLICY "Coach views all pain reports"
ON public.pain_reports FOR SELECT
USING (has_role(auth.uid(), 'coach'::app_role));

CREATE POLICY "Coach updates pain reports"
ON public.pain_reports FOR UPDATE
USING (has_role(auth.uid(), 'coach'::app_role));

CREATE TRIGGER update_pain_reports_updated_at
BEFORE UPDATE ON public.pain_reports
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_pain_reports_member ON public.pain_reports(member_id, created_at DESC);
CREATE INDEX idx_pain_reports_unresolved ON public.pain_reports(resolved_at) WHERE resolved_at IS NULL;

-- 2. Colonne coach_seen sur sessions
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS coach_seen boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_sessions_member_ended ON public.sessions(member_id, ended_at DESC);
CREATE INDEX IF NOT EXISTS idx_exercise_feedbacks_session ON public.exercise_feedbacks(session_id);

-- 3. Realtime
ALTER TABLE public.sessions REPLICA IDENTITY FULL;
ALTER TABLE public.pain_reports REPLICA IDENTITY FULL;
ALTER TABLE public.exercise_feedbacks REPLICA IDENTITY FULL;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.sessions;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.pain_reports;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.exercise_feedbacks;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.technique_videos;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;