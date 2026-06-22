-- Ajoute la 5e couleur « lime » (jaune clair = mobilité) à la palette des exercices.
-- La contrainte d'origine n'autorisait que red/green/yellow/blue.
ALTER TABLE public.exercises DROP CONSTRAINT IF EXISTS exercises_color_check;
ALTER TABLE public.exercises
  ADD CONSTRAINT exercises_color_check
  CHECK (color IN ('red', 'green', 'yellow', 'lime', 'blue'));
