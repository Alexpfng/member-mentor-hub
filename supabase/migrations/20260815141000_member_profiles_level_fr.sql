-- Fix : l'enregistrement du profil d'un coaché échouait côté coach ET côté membre
--   « new row for relation "member_profiles" violates check constraint
--     "member_profiles_level_check" »
--
-- Cause : la contrainte n'autorisait que les valeurs EN {beginner, intermediate,
-- advanced}, alors que l'UI (française) envoie le niveau en français
-- {débutant, intermédiaire, avancé, élite} (select des fiches coach + réglages
-- coaché). Toute sauvegarde d'un niveau était donc rejetée.
--
-- Correctif : on élargit l'ensemble autorisé aux valeurs FR de l'app, tout en
-- gardant les valeurs EN historiques (données de seed / anciens comptes) pour ne
-- rien invalider. NULL reste permis (niveau non renseigné).

ALTER TABLE public.member_profiles
  DROP CONSTRAINT IF EXISTS member_profiles_level_check;

ALTER TABLE public.member_profiles
  ADD CONSTRAINT member_profiles_level_check
  CHECK (
    level IS NULL
    OR level = ANY (ARRAY[
      'débutant', 'intermédiaire', 'avancé', 'élite',
      'beginner', 'intermediate', 'advanced'
    ])
  );
