-- Feature A : séance auto-composée par le membre depuis la bibliothèque.
-- Le coaché pioche des exercices, fixe ses cibles et lance la séance ; les
-- exercices planifiés sont portés par la séance et relus par l'exécution
-- (LiveSession), comme une séance créée par le coach.

-- Exercices planifiés portés par la séance (séances 'self', sans programme).
alter table public.sessions
  add column if not exists planned_exercises jsonb;

-- Nouveau type de séance 'self' (composée par le membre).
alter table public.sessions
  drop constraint if exists sessions_session_type_check;
alter table public.sessions
  add constraint sessions_session_type_check
  check (session_type = any (array['program'::text, 'free'::text, 'self'::text]));
