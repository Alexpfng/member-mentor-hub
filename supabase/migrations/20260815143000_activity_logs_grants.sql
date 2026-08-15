-- Fix : le coaché ne peut pas enregistrer son activité du jour (pas / calories)
--   « permission denied for table activity_logs »
--
-- Cause : la table activity_logs (migration 20260811120000_add_activity_module) a été
-- créée avec RLS + policies mais SANS GRANT explicite. Sur ce projet, les privilèges
-- par défaut ne s'appliquent PAS automatiquement — les autres tables émettent leurs
-- GRANT à la main (cf. weight_logs et email_send_log). Du coup la fonction serveur
-- logActivity (service_role via supabaseAdmin), et tout accès PostgREST, se voit
-- refuser l'accès à la table.
--
-- Correctif : on aligne activity_logs sur weight_logs (mêmes GRANT). RLS reste actif,
-- donc l'accès demeure borné par les policies existantes (membre = ses propres lignes,
-- coach = SELECT).

GRANT ALL ON TABLE public.activity_logs TO anon;
GRANT ALL ON TABLE public.activity_logs TO authenticated;
GRANT ALL ON TABLE public.activity_logs TO service_role;
