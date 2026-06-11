-- P2 — Suivi d'évolution côté membre : mensurations + photos de progression.
-- Le poids existe déjà (public.weight_logs). Ici on ajoute les tours (cm) et les photos.

-- 1) Mensurations (tours en cm), une ligne par date
CREATE TABLE IF NOT EXISTS public.body_measurements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  waist_cm NUMERIC,
  hips_cm NUMERIC,
  chest_cm NUMERIC,
  arm_cm NUMERIC,
  thigh_cm NUMERIC,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.body_measurements ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Member manages own measurements" ON public.body_measurements
    FOR ALL USING (auth.uid() = member_id) WITH CHECK (auth.uid() = member_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Coach views measurements" ON public.body_measurements
    FOR SELECT USING (public.has_role(auth.uid(), 'coach'::app_role));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS body_measurements_member_idx ON public.body_measurements(member_id, date);

-- 2) Photos de progression (métadonnées ; fichiers dans le bucket privé 'progress-photos')
CREATE TABLE IF NOT EXISTS public.progress_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  storage_path TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.progress_photos ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Member manages own progress photos" ON public.progress_photos
    FOR ALL USING (auth.uid() = member_id) WITH CHECK (auth.uid() = member_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Coach views progress photos" ON public.progress_photos
    FOR SELECT USING (public.has_role(auth.uid(), 'coach'::app_role));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS progress_photos_member_idx ON public.progress_photos(member_id, date);

-- 3) Bucket de stockage privé + politiques (dossier par utilisateur : {auth.uid}/...)
INSERT INTO storage.buckets (id, name, public)
VALUES ('progress-photos', 'progress-photos', false)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Member uploads own progress photo') THEN
    CREATE POLICY "Member uploads own progress photo" ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'progress-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Member reads own progress photo') THEN
    CREATE POLICY "Member reads own progress photo" ON storage.objects FOR SELECT TO authenticated
      USING (bucket_id = 'progress-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Member deletes own progress photo') THEN
    CREATE POLICY "Member deletes own progress photo" ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id = 'progress-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Coach reads progress photos') THEN
    CREATE POLICY "Coach reads progress photos" ON storage.objects FOR SELECT TO authenticated
      USING (bucket_id = 'progress-photos' AND public.has_role(auth.uid(), 'coach'::app_role));
  END IF;
END $$;
