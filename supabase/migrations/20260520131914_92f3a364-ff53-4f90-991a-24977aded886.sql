
-- ============ ROLES ============
CREATE TYPE public.app_role AS ENUM ('coach', 'member');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

-- ============ TABLES (create all first, then policies) ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  first_name TEXT,
  last_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.member_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE NOT NULL,
  weight_kg NUMERIC,
  height_cm INTEGER,
  level TEXT CHECK (level IN ('beginner','intermediate','advanced')),
  goal TEXT,
  injuries TEXT,
  coach_private_notes TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.member_profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  duration_weeks INTEGER,
  frequency_per_week INTEGER,
  objective TEXT,
  level TEXT,
  structure JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID REFERENCES public.programs(id) ON DELETE CASCADE NOT NULL,
  member_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  start_date DATE,
  end_date DATE,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT,
  muscles TEXT[],
  description TEXT,
  youtube_url TEXT,
  youtube_id TEXT,
  color TEXT CHECK (color IN ('red','green','yellow','blue')),
  starts_at_top BOOLEAN DEFAULT TRUE,
  requires_pelvis_cue BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_global BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  program_id UUID REFERENCES public.programs(id) ON DELETE SET NULL,
  week_number INTEGER,
  day_number INTEGER,
  session_label TEXT,
  date DATE,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_minutes INTEGER,
  overall_feeling INTEGER CHECK (overall_feeling BETWEEN 1 AND 10),
  member_note TEXT,
  coach_note TEXT,
  average_rpe NUMERIC,
  total_volume_kg NUMERIC,
  status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed','skipped')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.set_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE NOT NULL,
  exercise_id UUID REFERENCES public.exercises(id) ON DELETE SET NULL,
  exercise_name TEXT,
  set_number INTEGER,
  weight_kg NUMERIC,
  reps INTEGER,
  rpe INTEGER CHECK (rpe BETWEEN 1 AND 10),
  duration_seconds INTEGER,
  distance_m INTEGER,
  note TEXT,
  completed BOOLEAN DEFAULT TRUE,
  logged_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.set_logs ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.exercise_feedbacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE NOT NULL,
  exercise_name TEXT,
  block_id TEXT,
  rpe INTEGER CHECK (rpe BETWEEN 1 AND 10),
  member_comment TEXT,
  felt_too_easy BOOLEAN DEFAULT FALSE,
  felt_too_hard BOOLEAN DEFAULT FALSE,
  could_not_do BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.exercise_feedbacks ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.personal_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  exercise_id UUID REFERENCES public.exercises(id) ON DELETE SET NULL,
  exercise_name TEXT,
  weight_kg NUMERIC,
  reps INTEGER,
  date DATE,
  session_id UUID REFERENCES public.sessions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.personal_records ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.technique_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  session_id UUID REFERENCES public.sessions(id) ON DELETE SET NULL,
  exercise_name TEXT,
  storage_path TEXT,
  public_url TEXT,
  thumbnail_url TEXT,
  coach_feedback TEXT,
  coach_reviewed BOOLEAN DEFAULT FALSE,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.technique_videos ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  to_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  pinned BOOLEAN DEFAULT FALSE,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.weight_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  weight_kg NUMERIC NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.weight_logs ENABLE ROW LEVEL SECURITY;

-- ============ POLICIES ============
CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Profiles viewable by self" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Coaches view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'coach'));
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Member views own" ON public.member_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Coach views all members" ON public.member_profiles FOR SELECT USING (public.has_role(auth.uid(), 'coach'));
CREATE POLICY "Member updates own" ON public.member_profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Member inserts own" ON public.member_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Coach updates members" ON public.member_profiles FOR UPDATE USING (public.has_role(auth.uid(), 'coach'));

CREATE POLICY "Coach manages own programs" ON public.programs FOR ALL USING (auth.uid() = coach_id) WITH CHECK (auth.uid() = coach_id);
CREATE POLICY "Members view assigned programs" ON public.programs FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.assignments a WHERE a.program_id = programs.id AND a.member_id = auth.uid())
);

CREATE POLICY "Member views own assignments" ON public.assignments FOR SELECT USING (auth.uid() = member_id);
CREATE POLICY "Coach manages all assignments" ON public.assignments FOR ALL USING (public.has_role(auth.uid(), 'coach')) WITH CHECK (public.has_role(auth.uid(), 'coach'));

CREATE POLICY "Anyone views global or own exercises" ON public.exercises FOR SELECT USING (is_global = TRUE OR created_by = auth.uid() OR public.has_role(auth.uid(), 'coach'));
CREATE POLICY "Coach manages exercises" ON public.exercises FOR ALL USING (public.has_role(auth.uid(), 'coach')) WITH CHECK (public.has_role(auth.uid(), 'coach'));

CREATE POLICY "Member manages own sessions" ON public.sessions FOR ALL USING (auth.uid() = member_id) WITH CHECK (auth.uid() = member_id);
CREATE POLICY "Coach views all sessions" ON public.sessions FOR SELECT USING (public.has_role(auth.uid(), 'coach'));
CREATE POLICY "Coach updates sessions" ON public.sessions FOR UPDATE USING (public.has_role(auth.uid(), 'coach'));

CREATE POLICY "Member manages own set_logs" ON public.set_logs FOR ALL USING (
  EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = session_id AND s.member_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = session_id AND s.member_id = auth.uid())
);
CREATE POLICY "Coach views set_logs" ON public.set_logs FOR SELECT USING (public.has_role(auth.uid(), 'coach'));

CREATE POLICY "Member manages own feedbacks" ON public.exercise_feedbacks FOR ALL USING (
  EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = session_id AND s.member_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = session_id AND s.member_id = auth.uid())
);
CREATE POLICY "Coach views feedbacks" ON public.exercise_feedbacks FOR SELECT USING (public.has_role(auth.uid(), 'coach'));

CREATE POLICY "Member manages own PRs" ON public.personal_records FOR ALL USING (auth.uid() = member_id) WITH CHECK (auth.uid() = member_id);
CREATE POLICY "Coach views PRs" ON public.personal_records FOR SELECT USING (public.has_role(auth.uid(), 'coach'));

CREATE POLICY "Member manages own videos" ON public.technique_videos FOR ALL USING (auth.uid() = member_id) WITH CHECK (auth.uid() = member_id);
CREATE POLICY "Coach views videos" ON public.technique_videos FOR SELECT USING (public.has_role(auth.uid(), 'coach'));
CREATE POLICY "Coach updates videos" ON public.technique_videos FOR UPDATE USING (public.has_role(auth.uid(), 'coach'));

CREATE POLICY "Users view own messages" ON public.messages FOR SELECT USING (auth.uid() = from_id OR auth.uid() = to_id);
CREATE POLICY "Users send messages" ON public.messages FOR INSERT WITH CHECK (auth.uid() = from_id);
CREATE POLICY "Users update own message receipts" ON public.messages FOR UPDATE USING (auth.uid() = to_id OR auth.uid() = from_id);

CREATE POLICY "Member manages own weight" ON public.weight_logs FOR ALL USING (auth.uid() = member_id) WITH CHECK (auth.uid() = member_id);
CREATE POLICY "Coach views weight" ON public.weight_logs FOR SELECT USING (public.has_role(auth.uid(), 'coach'));

-- ============ TRIGGERS ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'first_name', NEW.raw_user_meta_data->>'last_name');
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'member');
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_member_profiles_updated_at BEFORE UPDATE ON public.member_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_programs_updated_at BEFORE UPDATE ON public.programs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ INDEXES ============
CREATE INDEX idx_sessions_member ON public.sessions(member_id, date DESC);
CREATE INDEX idx_set_logs_session ON public.set_logs(session_id);
CREATE INDEX idx_assignments_member ON public.assignments(member_id, active);
CREATE INDEX idx_messages_to ON public.messages(to_id, created_at DESC);

-- ============ STORAGE ============
INSERT INTO storage.buckets (id, name, public) VALUES ('technique-videos', 'technique-videos', FALSE);

CREATE POLICY "Members upload own videos" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'technique-videos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Members view own videos" ON storage.objects FOR SELECT
  USING (bucket_id = 'technique-videos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Coach views all videos" ON storage.objects FOR SELECT
  USING (bucket_id = 'technique-videos' AND public.has_role(auth.uid(), 'coach'));
CREATE POLICY "Members delete own videos" ON storage.objects FOR DELETE
  USING (bucket_id = 'technique-videos' AND auth.uid()::text = (storage.foldername(name))[1]);
