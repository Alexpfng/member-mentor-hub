
-- 1) sessions: type, free title, free category
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS session_type text NOT NULL DEFAULT 'program',
  ADD COLUMN IF NOT EXISTS free_title text,
  ADD COLUMN IF NOT EXISTS free_category text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sessions_session_type_check'
  ) THEN
    ALTER TABLE public.sessions
      ADD CONSTRAINT sessions_session_type_check
      CHECK (session_type IN ('program', 'free'));
  END IF;
END$$;

-- 2) free_activities
CREATE TABLE IF NOT EXISTS public.free_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text,
  series integer,
  reps text,
  charge text,
  distance_km numeric,
  duration_min integer,
  elevation_m integer,
  rpe integer,
  note text,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.free_activities TO authenticated;
GRANT ALL ON public.free_activities TO service_role;

ALTER TABLE public.free_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Member manages own free activities"
  ON public.free_activities FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.sessions s
    WHERE s.id = free_activities.session_id AND s.member_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.sessions s
    WHERE s.id = free_activities.session_id AND s.member_id = auth.uid()
  ));

CREATE POLICY "Coach views free activities"
  ON public.free_activities FOR SELECT
  USING (public.has_role(auth.uid(), 'coach'::app_role));

CREATE INDEX IF NOT EXISTS free_activities_session_idx
  ON public.free_activities(session_id, order_index);

-- 3) session_media (photos / videos)
CREATE TABLE IF NOT EXISTS public.session_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  member_id uuid NOT NULL,
  type text NOT NULL CHECK (type IN ('photo', 'video')),
  storage_path text NOT NULL,
  thumbnail_path text,
  caption text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_media TO authenticated;
GRANT ALL ON public.session_media TO service_role;

ALTER TABLE public.session_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Member manages own session media"
  ON public.session_media FOR ALL
  USING (auth.uid() = member_id)
  WITH CHECK (auth.uid() = member_id);

CREATE POLICY "Coach views session media"
  ON public.session_media FOR SELECT
  USING (public.has_role(auth.uid(), 'coach'::app_role));

CREATE INDEX IF NOT EXISTS session_media_session_idx
  ON public.session_media(session_id);

-- 4) Storage bucket policies (bucket itself created via storage tool)
-- Policies for storage.objects on bucket 'session-media'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Member uploads own session media'
  ) THEN
    CREATE POLICY "Member uploads own session media"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id = 'session-media'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Member reads own session media'
  ) THEN
    CREATE POLICY "Member reads own session media"
      ON storage.objects FOR SELECT TO authenticated
      USING (
        bucket_id = 'session-media'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Member deletes own session media'
  ) THEN
    CREATE POLICY "Member deletes own session media"
      ON storage.objects FOR DELETE TO authenticated
      USING (
        bucket_id = 'session-media'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Coach reads session media'
  ) THEN
    CREATE POLICY "Coach reads session media"
      ON storage.objects FOR SELECT TO authenticated
      USING (
        bucket_id = 'session-media'
        AND public.has_role(auth.uid(), 'coach'::app_role)
      );
  END IF;
END$$;
