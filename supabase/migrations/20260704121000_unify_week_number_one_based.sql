-- Unification de la numérotation des semaines : week_number est 1-based PARTOUT
-- (convention d'assignment_weeks). Historique du problème :
--   · sessions        : anciennes lignes 0-based, récentes 1-based (mixte)
--   · planned_sessions: 0-based
--   · weekly_logbooks : 0-based
-- Conséquences avant migration : progression globale qui ignore les anciennes
-- séances, « SEM 00 » dans l'historique, feedback RPE réel décalé côté Adapter.
--
-- ⚠️ À exécuter UNE SEULE FOIS (les étapes 2 et 3 sont gardées par la présence
--    de lignes en semaine 0, absentes après le premier passage).

BEGIN;

-- 1) sessions — idempotent : recalcule week_number (1-based) depuis la date de
--    séance et le start_date de l'assignation correspondante (même membre +
--    même programme ; en cas de réassignation, la plus récente ≤ date de séance).
WITH best AS (
  SELECT DISTINCT ON (s.id)
    s.id,
    GREATEST(1, ((s.date - a.start_date) / 7) + 1) AS wn
  FROM public.sessions s
  JOIN public.assignments a
    ON a.member_id = s.member_id
   AND a.program_id = s.program_id
   AND a.start_date IS NOT NULL
   AND a.start_date <= s.date
  WHERE s.program_id IS NOT NULL
    AND s.date IS NOT NULL
    AND s.week_number IS NOT NULL
  ORDER BY s.id, a.start_date DESC
)
UPDATE public.sessions s
SET week_number = best.wn
FROM best
WHERE best.id = s.id
  AND s.week_number IS DISTINCT FROM best.wn;

-- 2) planned_sessions — décale tout de +1 (uniformément 0-based avant).
UPDATE public.planned_sessions
SET week_number = week_number + 1
WHERE week_number IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.planned_sessions WHERE week_number = 0);

-- 3) weekly_logbooks — idem.
UPDATE public.weekly_logbooks
SET week_number = week_number + 1
WHERE EXISTS (SELECT 1 FROM public.weekly_logbooks WHERE week_number = 0);

COMMIT;
