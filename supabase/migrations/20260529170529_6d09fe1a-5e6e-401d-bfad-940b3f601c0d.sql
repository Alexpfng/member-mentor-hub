-- Intensity codes (legend / color)
CREATE TABLE public.intensity_codes (
  code text PRIMARY KEY,
  label text NOT NULL,
  description text NOT NULL,
  color_hex text NOT NULL,
  created_at timestamptz DEFAULT now()
);
GRANT SELECT ON public.intensity_codes TO authenticated;
GRANT ALL ON public.intensity_codes TO service_role;
ALTER TABLE public.intensity_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth reads intensity_codes" ON public.intensity_codes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Coach writes intensity_codes" ON public.intensity_codes FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'coach'::app_role)) WITH CHECK (has_role(auth.uid(), 'coach'::app_role));

-- Glossary (tempo, EMOM, RPE, code lettre)
CREATE TABLE public.glossary (
  cle text PRIMARY KEY,
  titre text NOT NULL,
  contenu text NOT NULL,
  created_at timestamptz DEFAULT now()
);
GRANT SELECT ON public.glossary TO authenticated;
GRANT ALL ON public.glossary TO service_role;
ALTER TABLE public.glossary ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth reads glossary" ON public.glossary FOR SELECT TO authenticated USING (true);
CREATE POLICY "Coach writes glossary" ON public.glossary FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'coach'::app_role)) WITH CHECK (has_role(auth.uid(), 'coach'::app_role));

-- Enrich exercises
ALTER TABLE public.exercises
  ADD COLUMN IF NOT EXISTS muscle_group text,
  ADD COLUMN IF NOT EXISTS equipement text,
  ADD COLUMN IF NOT EXISTS is_archived boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS intensity_code text REFERENCES public.intensity_codes(code) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_exercises_muscle_group ON public.exercises(muscle_group);
CREATE INDEX IF NOT EXISTS idx_exercises_equipement ON public.exercises(equipement);
CREATE INDEX IF NOT EXISTS idx_exercises_intensity_code ON public.exercises(intensity_code);
CREATE INDEX IF NOT EXISTS idx_exercises_is_archived ON public.exercises(is_archived);

-- Seed intensity_codes
INSERT INTO public.intensity_codes (code, label, description, color_hex) VALUES
  ('epuisant', 'Mouvements épuisants', 'Garder 1 répétition de réserve sur chacune des séries. Tu dois t''approcher de l''échec mais pas y aller complètement.', '#F4CCCC'),
  ('semi_epuisant', 'Mouvements semi-épuisants', 'Garder 1 à 2 répétitions de réserve sur chaque série et presque échec sur la dernière. S''approcher de l''échec sur la dernière série sans y aller.', '#D9EAD3'),
  ('isolation', 'Mouvement d''isolation', 'Objectif : congestionner le muscle. Tu peux aller à l''échec et sentir la brûlure musculaire.', '#FFF2CC'),
  ('prevention', 'Prévention de blessure', 'Travail prévention, effacement des déséquilibres + abdos. Facultatif si manque de temps mais important.', '#CFE2F3'),
  ('non_classe', 'Non classé', 'À classer par le coach.', '#EFEFEF')
ON CONFLICT (code) DO NOTHING;

-- Seed glossary
INSERT INTO public.glossary (cle, titre, contenu) VALUES
  ('tempo', 'Tempo (vitesse d''exécution)', '4 chiffres = phases du mouvement. 1er = excentrique (descente), 2e = pause en bas, 3e = concentrique (poussée), 4e = pause en haut. Ex 3010 : 3s de descente, pas de pause, remontée rapide, pas de pause. X = explosif. Objectif : accumuler du temps sous tension.'),
  ('emom', 'EMOM (Every Minute On the Minute)', 'Au lieu de 3x à 85-90% avec 5min de repos : 1 rép toutes les minutes à la même intensité, sur X minutes. EMOM1 = 1 rép/min, EMOM2 = 2 rép/min. Permet plus de volume avec meilleure qualité, moins de fatigue. Ladder possible : 1/2/3 puis 3/2/1.'),
  ('code_lettre', 'Code lettre (ordre & supersets)', 'Les lettres = ordre des exercices. A seul : tu fais A puis ta récup. A1, A2 ensemble : enchaîne les deux puis récup commune après le 2e. Idem B1/B2, C1/C2...'),
  ('rpe', 'RPE (Rate of Perceived Exertion)', 'Note subjective /10 de l''effort perçu sur l''exercice. 10 = échec, 0 = très facile. Sert à manager l''intensité au fil des semaines. Si trop facile, augmenter la semaine suivante. Si 8-9, ne pas augmenter. Noter sur chaque exo, surtout les gros (en rouge).')
ON CONFLICT (cle) DO NOTHING;