# Strava Member Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connecter chaque membre à son propre compte Strava pour importer automatiquement les courses du jour dans l'app et alimenter `run_stats`.

**Architecture:** Ajouter une connexion OAuth Strava côté membre, stocker les credentials côté serveur, recevoir les activités via webhook, les normaliser dans une table d'import, puis les rattacher automatiquement aux séances course du jour avant d'upsert `run_stats`.

**Tech Stack:** TanStack Start, React, TypeScript, Supabase Auth/Postgres, server functions, routes SSR/API, Strava OAuth/Webhooks.

---

## Fichiers pressentis

- Créer `src/lib/strava.functions.ts`
- Créer `src/lib/strava-match.ts`
- Créer `src/routes/api/strava/webhook.ts`
- Créer `src/routes/api/strava/connect.ts`
- Créer `src/routes/api/strava/callback.ts`
- Modifier `src/pages/membre/Profil.tsx`
- Modifier `src/lib/run.functions.ts`
- Modifier `src/integrations/supabase/types.ts`
- Créer une migration SQL dans `supabase/migrations/`
- Ajouter tests unitaires autour du matching et de la normalisation

## Tâches

### Task 1: Modèle de données Strava

**Files:**
- Create: `supabase/migrations/<timestamp>_add_member_strava_sync.sql`
- Modify: `src/integrations/supabase/types.ts`

- [ ] Écrire la migration SQL pour `member_strava_connections` et `member_strava_activities`
- [ ] Ajouter les index utiles (`member_id`, `strava_athlete_id`, `strava_activity_id`, `session_id`)
- [ ] Activer RLS et définir les policies membre/coach minimales
- [ ] Mettre à jour les types Supabase générés manuellement ou via workflow local
- [ ] Vérifier que le schéma reste compatible avec `run_stats`

### Task 2: Client serveur Strava

**Files:**
- Create: `src/lib/strava.functions.ts`

- [ ] Centraliser les helpers OAuth Strava: URL de connexion, échange de code, refresh token, lecture activité
- [ ] Ajouter un helper d'upsert de connexion membre
- [ ] Ajouter un helper d'upsert d'activité Strava importée
- [ ] Ajouter la validation minimale des payloads Strava

### Task 3: Matching activité → séance

**Files:**
- Create: `src/lib/strava-match.ts`
- Test: `src/lib/strava-match.test.ts`

- [ ] Écrire les règles pures de rattachement automatique
- [ ] Prioriser `in_progress`, puis séance du jour sans `run_stats`
- [ ] Retourner un résultat explicite: `matched`, `ambiguous`, `none`
- [ ] Tester les cas simples, ambigus et déjà liés

### Task 4: OAuth membre

**Files:**
- Create: `src/routes/api/strava/connect.ts`
- Create: `src/routes/api/strava/callback.ts`
- Modify: `src/pages/membre/Profil.tsx`

- [ ] Ajouter l’entrée UI `Connecter Strava`
- [ ] Rediriger le membre vers Strava avec les scopes retenus
- [ ] Gérer le callback et persister la connexion
- [ ] Afficher l’état connecté, le dernier sync et le bouton déconnecter

### Task 5: Webhook Strava

**Files:**
- Create: `src/routes/api/strava/webhook.ts`
- Modify: `src/lib/strava.functions.ts`

- [ ] Implémenter la vérification challenge Strava
- [ ] Recevoir `create` / `update`
- [ ] Identifier le membre à partir de l’athlète Strava
- [ ] Télécharger l’activité détaillée avec refresh token si nécessaire
- [ ] Enregistrer l’activité brute et son statut

### Task 6: Injection dans `run_stats`

**Files:**
- Modify: `src/lib/run.functions.ts`
- Modify: `src/lib/strava.functions.ts`

- [ ] Transformer l’activité Strava en métriques `run_stats`
- [ ] Réutiliser le flux existant autant que possible
- [ ] Upsert `run_stats` sans casser la saisie manuelle
- [ ] Marquer la source comme `strava`

### Task 7: Déconnexion et robustesse

**Files:**
- Modify: `src/lib/strava.functions.ts`
- Modify: `src/pages/membre/Profil.tsx`

- [ ] Ajouter la déconnexion membre
- [ ] Purger ou désactiver proprement les tokens
- [ ] Afficher un état de reconnexion si token invalide
- [ ] Conserver le fallback capture/saisie si Strava indisponible

### Task 8: Vérification produit

**Files:**
- Test: `src/lib/strava-match.test.ts`
- Test: `src/lib/run-stats.test.ts`

- [ ] Vérifier qu’une course importée du jour ressort côté coach via les écrans existants
- [ ] Vérifier qu’aucune séance muscu n’est impactée
- [ ] Vérifier qu’un membre non connecté garde le parcours manuel actuel
- [ ] Documenter les variables d’environnement Strava requises

