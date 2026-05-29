
CREATE TABLE public.running_routes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  short_id TEXT NOT NULL DEFAULT substr(replace(gen_random_uuid()::text,'-',''),1,8) UNIQUE,
  coach_id UUID NOT NULL,
  name TEXT NOT NULL,
  difficulty TEXT,
  distance_km NUMERIC,
  dplus_m NUMERIC,
  dminus_m NUMERIC,
  points JSONB NOT NULL DEFAULT '[]'::jsonb,
  gpx_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.running_routes TO authenticated;
GRANT ALL ON public.running_routes TO service_role;

ALTER TABLE public.running_routes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coach manages own routes"
ON public.running_routes
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'coach'::app_role) AND coach_id = auth.uid())
WITH CHECK (public.has_role(auth.uid(), 'coach'::app_role) AND coach_id = auth.uid());

CREATE POLICY "Authenticated read routes"
ON public.running_routes
FOR SELECT
TO authenticated
USING (true);

CREATE TRIGGER trg_running_routes_updated_at
BEFORE UPDATE ON public.running_routes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_running_routes_coach ON public.running_routes(coach_id);
