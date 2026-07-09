-- Statistiques de course structurées (une ligne par séance de type course).
-- Aujourd'hui les stats de course vivent en texte libre dans sessions.member_note,
-- ce qui empêche toute comparaison d'une séance à l'autre. Cette table sert de
-- source unique (saisie manuelle, extraction depuis capture d'écran, ou Strava
-- plus tard) pour le retour "donnant-donnant" au coaché et l'analyse du coach.

CREATE TABLE IF NOT EXISTS public.run_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE NOT NULL,
  member_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  distance_km NUMERIC(6,2),
  duration_sec INTEGER,
  elevation_m INTEGER,
  avg_hr INTEGER,
  pace_sec_per_km INTEGER,
  rpe INTEGER,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'screenshot', 'strava')),
  confidence NUMERIC(3,2),
  screenshot_media_id UUID REFERENCES public.session_media(id) ON DELETE SET NULL,
  raw_extraction JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (session_id)
);
ALTER TABLE public.run_stats ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Member manages own run stats" ON public.run_stats
    FOR ALL USING (auth.uid() = member_id) WITH CHECK (auth.uid() = member_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Coach views run stats" ON public.run_stats
    FOR SELECT USING (public.has_role(auth.uid(), 'coach'::app_role));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS run_stats_member_idx ON public.run_stats(member_id, created_at DESC);
CREATE INDEX IF NOT EXISTS run_stats_session_idx ON public.run_stats(session_id);
