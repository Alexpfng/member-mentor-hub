-- Archivage des profils membres
-- Quand is_archived = true : le membre est masqué de la liste coach
-- et son accès Supabase Auth est bloqué via l'API admin (ban_duration)

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_profiles_is_archived ON public.profiles(is_archived);
