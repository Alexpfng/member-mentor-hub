-- ============ RUNNING ROUTES ============

-- Storage bucket for GPX files (public)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('running-routes', 'running-routes', true, 5242880, ARRAY['application/gpx+xml','application/octet-stream','text/xml'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read running routes"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'running-routes');

CREATE POLICY "Coach upload running routes"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'running-routes' AND auth.role() = 'authenticated');

-- Table for route metadata
CREATE TABLE IF NOT EXISTS public.running_routes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  short_id    TEXT UNIQUE DEFAULT substring(replace(gen_random_uuid()::text, '-', ''), 1, 8),
  coach_id    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  name        TEXT NOT NULL,
  description TEXT,
  distance_km NUMERIC(6,2),
  dplus_m     INTEGER,
  dminus_m    INTEGER,
  difficulty  TEXT CHECK (difficulty IN ('facile','intermédiaire','difficile','expert')),
  points      JSONB NOT NULL DEFAULT '[]',
  gpx_url     TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.running_routes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read routes"    ON public.running_routes FOR SELECT USING (true);
CREATE POLICY "Coach insert routes"   ON public.running_routes FOR INSERT WITH CHECK (auth.uid() = coach_id);
CREATE POLICY "Coach update routes"   ON public.running_routes FOR UPDATE USING (auth.uid() = coach_id);
CREATE POLICY "Coach delete routes"   ON public.running_routes FOR DELETE USING (auth.uid() = coach_id);
