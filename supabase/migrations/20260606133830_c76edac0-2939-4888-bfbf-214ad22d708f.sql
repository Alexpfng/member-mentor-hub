
-- ============ planned_sessions ============
CREATE TABLE public.planned_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL,
  program_id UUID,
  week_number INTEGER,
  day_label TEXT NOT NULL,
  planned_date DATE,
  reminder_time TIME,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','done','skipped','rest')),
  session_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_planned_sessions_member ON public.planned_sessions(member_id, planned_date);
CREATE INDEX idx_planned_sessions_week ON public.planned_sessions(member_id, program_id, week_number);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.planned_sessions TO authenticated;
GRANT ALL ON public.planned_sessions TO service_role;

ALTER TABLE public.planned_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Member manages own planned sessions"
ON public.planned_sessions FOR ALL
USING (auth.uid() = member_id)
WITH CHECK (auth.uid() = member_id);

CREATE POLICY "Coach views planned sessions"
ON public.planned_sessions FOR SELECT
USING (public.has_role(auth.uid(), 'coach'::app_role));

CREATE TRIGGER trg_planned_sessions_updated
BEFORE UPDATE ON public.planned_sessions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ weekly_logbooks ============
CREATE TABLE public.weekly_logbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL,
  program_id UUID,
  week_number INTEGER NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  sessions_done INTEGER DEFAULT 0,
  sessions_planned INTEGER DEFAULT 0,
  total_volume_kg NUMERIC DEFAULT 0,
  total_duration_min INTEGER DEFAULT 0,
  avg_rpe NUMERIC,
  weight_start NUMERIC,
  weight_end NUMERIC,
  new_prs JSONB DEFAULT '[]'::jsonb,
  feelings JSONB DEFAULT '{}'::jsonb,
  pain_summary TEXT,
  coach_message TEXT,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (member_id, program_id, week_number)
);
CREATE INDEX idx_weekly_logbooks_member ON public.weekly_logbooks(member_id, week_number DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.weekly_logbooks TO authenticated;
GRANT ALL ON public.weekly_logbooks TO service_role;

ALTER TABLE public.weekly_logbooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Member views own logbooks"
ON public.weekly_logbooks FOR SELECT
USING (auth.uid() = member_id);

CREATE POLICY "Coach views all logbooks"
ON public.weekly_logbooks FOR SELECT
USING (public.has_role(auth.uid(), 'coach'::app_role));

CREATE POLICY "Coach updates logbooks"
ON public.weekly_logbooks FOR UPDATE
USING (public.has_role(auth.uid(), 'coach'::app_role));

CREATE TRIGGER trg_weekly_logbooks_updated
BEFORE UPDATE ON public.weekly_logbooks
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ member_notification_prefs ============
CREATE TABLE public.member_notification_prefs (
  user_id UUID PRIMARY KEY,
  planned_session BOOLEAN NOT NULL DEFAULT true,
  weight_reminder BOOLEAN NOT NULL DEFAULT true,
  logbook BOOLEAN NOT NULL DEFAULT true,
  pr BOOLEAN NOT NULL DEFAULT true,
  new_week BOOLEAN NOT NULL DEFAULT true,
  coach_msg BOOLEAN NOT NULL DEFAULT true,
  streak BOOLEAN NOT NULL DEFAULT true,
  weight_reminder_dow INTEGER NOT NULL DEFAULT 0,
  weight_reminder_time TIME NOT NULL DEFAULT '09:00',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_notification_prefs TO authenticated;
GRANT ALL ON public.member_notification_prefs TO service_role;

ALTER TABLE public.member_notification_prefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User manages own notification prefs"
ON public.member_notification_prefs FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_notif_prefs_updated
BEFORE UPDATE ON public.member_notification_prefs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ PR detection trigger ============
CREATE OR REPLACE FUNCTION public.detect_personal_record()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member_id UUID;
  v_max_weight NUMERIC;
  v_max_reps INTEGER;
BEGIN
  IF NEW.exercise_name IS NULL OR COALESCE(NEW.completed, true) = false THEN
    RETURN NEW;
  END IF;

  SELECT s.member_id INTO v_member_id FROM public.sessions s WHERE s.id = NEW.session_id;
  IF v_member_id IS NULL THEN RETURN NEW; END IF;

  -- best weight ever for this exercise (exclude current row)
  SELECT COALESCE(MAX(sl.weight_kg), 0)
  INTO v_max_weight
  FROM public.set_logs sl
  JOIN public.sessions s ON s.id = sl.session_id
  WHERE s.member_id = v_member_id
    AND sl.exercise_name = NEW.exercise_name
    AND sl.id <> NEW.id
    AND COALESCE(sl.completed, true) = true;

  SELECT COALESCE(MAX(sl.reps), 0)
  INTO v_max_reps
  FROM public.set_logs sl
  JOIN public.sessions s ON s.id = sl.session_id
  WHERE s.member_id = v_member_id
    AND sl.exercise_name = NEW.exercise_name
    AND sl.id <> NEW.id
    AND COALESCE(sl.completed, true) = true;

  IF (NEW.weight_kg IS NOT NULL AND NEW.weight_kg > v_max_weight)
     OR (NEW.weight_kg IS NULL AND NEW.reps IS NOT NULL AND NEW.reps > v_max_reps) THEN
    INSERT INTO public.personal_records (member_id, exercise_id, exercise_name, weight_kg, reps, session_id, date)
    VALUES (v_member_id, NEW.exercise_id, NEW.exercise_name, NEW.weight_kg, NEW.reps, NEW.session_id, CURRENT_DATE);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_logs_pr
AFTER INSERT ON public.set_logs
FOR EACH ROW EXECUTE FUNCTION public.detect_personal_record();

-- ============ Realtime ============
ALTER PUBLICATION supabase_realtime ADD TABLE public.planned_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.weekly_logbooks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.personal_records;
