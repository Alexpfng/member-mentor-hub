ALTER TABLE public.exercises
  ADD COLUMN IF NOT EXISTS default_tempo TEXT,
  ADD COLUMN IF NOT EXISTS coach_notes TEXT;