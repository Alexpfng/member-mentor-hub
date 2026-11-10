-- Mark dedicated public demo profiles and keep their activity out of coach views.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.programs
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS profiles_is_demo_idx
  ON public.profiles (id)
  WHERE is_demo = true;

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.is_demo_profile(profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'coach'::app_role)
      THEN COALESCE((SELECT p.is_demo FROM public.profiles p WHERE p.id = profile_id), false)
    ELSE false
  END;
$$;
REVOKE ALL ON FUNCTION private.is_demo_profile(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_demo_profile(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.is_demo_profile_path(profile_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'coach'::app_role)
      THEN COALESCE((SELECT p.is_demo FROM public.profiles p WHERE p.id::text = profile_id), false)
    ELSE false
  END;
$$;
REVOKE ALL ON FUNCTION private.is_demo_profile_path(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_demo_profile_path(text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.is_demo_program(target_program_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'coach'::app_role)
      THEN COALESCE((SELECT pr.is_demo FROM public.programs pr WHERE pr.id = target_program_id), false)
    ELSE false
  END;
$$;
REVOKE ALL ON FUNCTION private.is_demo_program(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_demo_program(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.keep_demo_flags_server_only()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND (NEW.is_demo IS DISTINCT FROM COALESCE(OLD.is_demo, false) OR NEW.is_demo = true) THEN
    RAISE EXCEPTION 'Demo flags can only be changed by the server';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.keep_demo_flags_server_only() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS profiles_keep_demo_flag_server_only ON public.profiles;
CREATE TRIGGER profiles_keep_demo_flag_server_only
  BEFORE INSERT OR UPDATE OF is_demo ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.keep_demo_flags_server_only();
DROP TRIGGER IF EXISTS programs_keep_demo_flag_server_only ON public.programs;
CREATE TRIGGER programs_keep_demo_flag_server_only
  BEFORE INSERT OR UPDATE OF is_demo ON public.programs
  FOR EACH ROW EXECUTE FUNCTION public.keep_demo_flags_server_only();

DROP POLICY IF EXISTS "Coaches view all profiles" ON public.profiles;
CREATE POLICY "Coaches view non-demo profiles"
  ON public.profiles FOR SELECT
  USING (public.has_role(auth.uid(), 'coach') AND NOT private.is_demo_profile(id));

DROP POLICY IF EXISTS "Coach views all members" ON public.member_profiles;
CREATE POLICY "Coach views non-demo members"
  ON public.member_profiles FOR SELECT
  USING (
    public.has_role(auth.uid(), 'coach')
    AND NOT private.is_demo_profile(member_profiles.user_id)
  );

DROP POLICY IF EXISTS "Coach updates members" ON public.member_profiles;
CREATE POLICY "Coach updates non-demo members"
  ON public.member_profiles FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'coach')
    AND NOT private.is_demo_profile(member_profiles.user_id)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'coach')
    AND NOT private.is_demo_profile(member_profiles.user_id)
  );

DROP POLICY IF EXISTS "Coach views all sessions" ON public.sessions;
CREATE POLICY "Coach views non-demo sessions"
  ON public.sessions FOR SELECT
  USING (
    public.has_role(auth.uid(), 'coach')
    AND NOT private.is_demo_profile(sessions.member_id)
  );

DROP POLICY IF EXISTS "Coach updates sessions" ON public.sessions;
CREATE POLICY "Coach updates non-demo sessions"
  ON public.sessions FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'coach')
    AND NOT private.is_demo_profile(sessions.member_id)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'coach')
    AND NOT private.is_demo_profile(sessions.member_id)
  );

DROP POLICY IF EXISTS "Coach manages own programs" ON public.programs;
CREATE POLICY "Coach manages own non-demo programs"
  ON public.programs FOR ALL
  USING (auth.uid() = coach_id AND is_demo = false)
  WITH CHECK (auth.uid() = coach_id AND is_demo = false);

DROP POLICY IF EXISTS "Coach manages all assignments" ON public.assignments;
CREATE POLICY "Coach manages non-demo assignments"
  ON public.assignments FOR ALL
  USING (
    public.has_role(auth.uid(), 'coach')
    AND NOT private.is_demo_profile(assignments.member_id)
    AND NOT private.is_demo_program(assignments.program_id)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'coach')
    AND NOT private.is_demo_profile(assignments.member_id)
    AND NOT private.is_demo_program(assignments.program_id)
  );

DROP POLICY IF EXISTS "Coach views planned sessions" ON public.planned_sessions;
CREATE POLICY "Coach views non-demo planned sessions"
  ON public.planned_sessions FOR SELECT
  USING (
    public.has_role(auth.uid(), 'coach')
    AND NOT private.is_demo_profile(planned_sessions.member_id)
  );

-- Keep the same boundary on every coach-readable member record, not only the
-- main profile and plan tables.
DROP POLICY IF EXISTS "Coach views set_logs" ON public.set_logs;
CREATE POLICY "Coach views non-demo set_logs"
  ON public.set_logs FOR SELECT
  USING (
    public.has_role(auth.uid(), 'coach')
    AND EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = set_logs.session_id AND NOT private.is_demo_profile(s.member_id)
    )
  );

DROP POLICY IF EXISTS "Coach views feedbacks" ON public.exercise_feedbacks;
CREATE POLICY "Coach views non-demo feedbacks"
  ON public.exercise_feedbacks FOR SELECT
  USING (
    public.has_role(auth.uid(), 'coach')
    AND EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = exercise_feedbacks.session_id AND NOT private.is_demo_profile(s.member_id)
    )
  );

DROP POLICY IF EXISTS "Coach views PRs" ON public.personal_records;
CREATE POLICY "Coach views non-demo PRs"
  ON public.personal_records FOR SELECT
  USING (
    public.has_role(auth.uid(), 'coach')
    AND NOT private.is_demo_profile(personal_records.member_id)
  );

DROP POLICY IF EXISTS "Coach views videos" ON public.technique_videos;
CREATE POLICY "Coach views non-demo videos"
  ON public.technique_videos FOR SELECT
  USING (
    public.has_role(auth.uid(), 'coach')
    AND NOT private.is_demo_profile(technique_videos.member_id)
  );

DROP POLICY IF EXISTS "Coach updates videos" ON public.technique_videos;
CREATE POLICY "Coach updates non-demo videos"
  ON public.technique_videos FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'coach')
    AND NOT private.is_demo_profile(technique_videos.member_id)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'coach')
    AND NOT private.is_demo_profile(technique_videos.member_id)
  );

DROP POLICY IF EXISTS "Coach views weight" ON public.weight_logs;
CREATE POLICY "Coach views non-demo weight"
  ON public.weight_logs FOR SELECT
  USING (
    public.has_role(auth.uid(), 'coach')
    AND NOT private.is_demo_profile(weight_logs.member_id)
  );

DROP POLICY IF EXISTS "Coach views all pain reports" ON public.pain_reports;
CREATE POLICY "Coach views non-demo pain reports"
  ON public.pain_reports FOR SELECT
  USING (
    public.has_role(auth.uid(), 'coach'::app_role)
    AND NOT private.is_demo_profile(pain_reports.member_id)
  );
DROP POLICY IF EXISTS "Coach updates pain reports" ON public.pain_reports;
CREATE POLICY "Coach updates non-demo pain reports"
  ON public.pain_reports FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'coach'::app_role)
    AND NOT private.is_demo_profile(pain_reports.member_id)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'coach'::app_role)
    AND NOT private.is_demo_profile(pain_reports.member_id)
  );

DROP POLICY IF EXISTS "Coach views measurements" ON public.body_measurements;
CREATE POLICY "Coach views non-demo measurements"
  ON public.body_measurements FOR SELECT
  USING (
    public.has_role(auth.uid(), 'coach'::app_role)
    AND NOT private.is_demo_profile(body_measurements.member_id)
  );

DROP POLICY IF EXISTS "Coach views progress photos" ON public.progress_photos;
CREATE POLICY "Coach views non-demo progress photos"
  ON public.progress_photos FOR SELECT
  USING (
    public.has_role(auth.uid(), 'coach'::app_role)
    AND NOT private.is_demo_profile(progress_photos.member_id)
  );

DROP POLICY IF EXISTS "Coach manages nutrition goals" ON public.nutrition_goals;
CREATE POLICY "Coach manages non-demo nutrition goals"
  ON public.nutrition_goals FOR ALL
  USING (
    public.has_role(auth.uid(), 'coach'::app_role)
    AND NOT private.is_demo_profile(nutrition_goals.member_id)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'coach'::app_role)
    AND NOT private.is_demo_profile(nutrition_goals.member_id)
  );

DROP POLICY IF EXISTS "Coach views nutrition entries" ON public.nutrition_entries;
CREATE POLICY "Coach views non-demo nutrition entries"
  ON public.nutrition_entries FOR SELECT
  USING (
    public.has_role(auth.uid(), 'coach'::app_role)
    AND NOT private.is_demo_profile(nutrition_entries.member_id)
  );

DROP POLICY IF EXISTS "Coach views activity" ON public.activity_logs;
CREATE POLICY "Coach views non-demo activity"
  ON public.activity_logs FOR SELECT
  USING (
    public.has_role(auth.uid(), 'coach'::app_role)
    AND NOT private.is_demo_profile(activity_logs.member_id)
  );

DROP POLICY IF EXISTS "Coach views run stats" ON public.run_stats;
CREATE POLICY "Coach views non-demo run stats"
  ON public.run_stats FOR SELECT
  USING (
    public.has_role(auth.uid(), 'coach'::app_role)
    AND NOT private.is_demo_profile(run_stats.member_id)
  );

DROP POLICY IF EXISTS "Coach reads member app events" ON public.member_app_events;
CREATE POLICY "Coach reads non-demo member app events"
  ON public.member_app_events FOR SELECT TO authenticated
  USING (
    public.has_role((SELECT auth.uid()), 'coach')
    AND NOT private.is_demo_profile(member_app_events.member_id)
  );

DROP POLICY IF EXISTS "Coach views free activities" ON public.free_activities;
CREATE POLICY "Coach views non-demo free activities"
  ON public.free_activities FOR SELECT
  USING (
    public.has_role(auth.uid(), 'coach'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = free_activities.session_id AND NOT private.is_demo_profile(s.member_id)
    )
  );

DROP POLICY IF EXISTS "Coach views session media" ON public.session_media;
CREATE POLICY "Coach views non-demo session media"
  ON public.session_media FOR SELECT
  USING (
    public.has_role(auth.uid(), 'coach'::app_role)
    AND NOT private.is_demo_profile(session_media.member_id)
  );

DROP POLICY IF EXISTS "Coach manages all assignment weeks" ON public.assignment_weeks;
CREATE POLICY "Coach manages non-demo assignment weeks"
  ON public.assignment_weeks FOR ALL
  USING (
    public.has_role(auth.uid(), 'coach')
    AND NOT private.is_demo_profile(assignment_weeks.member_id)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'coach')
    AND NOT private.is_demo_profile(assignment_weeks.member_id)
  );

DROP POLICY IF EXISTS "Coach views all logbooks" ON public.weekly_logbooks;
CREATE POLICY "Coach views non-demo logbooks"
  ON public.weekly_logbooks FOR SELECT
  USING (
    public.has_role(auth.uid(), 'coach'::app_role)
    AND NOT private.is_demo_profile(weekly_logbooks.member_id)
  );
DROP POLICY IF EXISTS "Coach updates logbooks" ON public.weekly_logbooks;
CREATE POLICY "Coach updates non-demo logbooks"
  ON public.weekly_logbooks FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'coach'::app_role)
    AND NOT private.is_demo_profile(weekly_logbooks.member_id)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'coach'::app_role)
    AND NOT private.is_demo_profile(weekly_logbooks.member_id)
  );

DROP POLICY IF EXISTS "Coach reads progress photos" ON storage.objects;
CREATE POLICY "Coach reads non-demo progress photos"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'progress-photos'
    AND public.has_role(auth.uid(), 'coach'::app_role)
    AND NOT private.is_demo_profile_path((storage.foldername(name))[1])
  );
DROP POLICY IF EXISTS "Coach reads session media" ON storage.objects;
CREATE POLICY "Coach reads non-demo session media"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'session-media'
    AND public.has_role(auth.uid(), 'coach'::app_role)
    AND NOT private.is_demo_profile_path((storage.foldername(name))[1])
  );

-- Defense in depth: suppress coach messages and activity-feed rows even when a
-- server function uses the service role or an older code path is called.
CREATE OR REPLACE FUNCTION public.suppress_demo_member_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.from_id AND is_demo)
     OR EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.to_id AND is_demo) THEN
    RETURN NULL;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.suppress_demo_member_message() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS suppress_demo_member_message ON public.messages;
CREATE TRIGGER suppress_demo_member_message
  BEFORE INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.suppress_demo_member_message();

CREATE OR REPLACE FUNCTION public.suppress_demo_member_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.member_id AND is_demo) THEN
    RETURN NULL;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.suppress_demo_member_event() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS suppress_demo_member_event ON public.member_app_events;
CREATE TRIGGER suppress_demo_member_event
  BEFORE INSERT ON public.member_app_events
  FOR EACH ROW EXECUTE FUNCTION public.suppress_demo_member_event();
