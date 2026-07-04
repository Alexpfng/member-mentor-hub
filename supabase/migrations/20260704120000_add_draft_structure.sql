-- Brouillon de révision pour les semaines déjà livrées au membre.
-- Le membre lit `structure` : les éditions du coach sur une semaine
-- published/in_progress vont désormais dans `draft_structure` et ne basculent
-- dans `structure` qu'à la republication (publishWeek).
ALTER TABLE public.assignment_weeks
  ADD COLUMN IF NOT EXISTS draft_structure jsonb;
