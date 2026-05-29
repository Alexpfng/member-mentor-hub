
# Plan — Beta Phase 1

## Objectif
Livrer un MVP fonctionnel end-to-end pour Léo (coach) et Teddy (membre), avec uniquement les fonctions listées dans le brief. Le reste est masqué.

---

## 1. Seed des comptes beta

Pas de script à exécuter au boot de l'app (anti-pattern Worker + risque de réexécution). À la place : **une seule migration SQL** qui crée les 2 comptes via `auth.admin` côté serveur Supabase, idempotente (`ON CONFLICT DO NOTHING`).

Contenu :
- Créer Léo (`leocolognesi@gmail.com` / `ColoSmart2024!`) → rôle `coach` dans `user_roles`, profil rempli.
- Créer Teddy (`morin.td@gmail.com` / `TeddyBeta2024!`) → rôle `member`, profil rempli.
- Email auto-confirmé.
- Pas de table `coach_members` à ajouter — le projet utilise déjà `user_roles` + `assignments`. Le lien coach→membre passe par `assignments` (déjà en place). On garde ça pour rester cohérent avec l'existant.

> Note : le brief mentionne `profiles.role` et `profiles.coach_id` et une table `coach_members`. Le schéma actuel utilise `user_roles` (table séparée, plus sécurisée — anti-escalation) et `assignments`. **On garde l'existant**, qui est déjà correct et sécurisé. Pas de duplication.

## 2. Scope-down de l'UI (cacher hors-beta)

Flag global `BETA_MODE = true` dans `src/lib/site.ts`. Quand actif, masquer dans la navigation et les pages :

**Côté coach** :
- Cacher : `/coach/import` (Excel), `/coach/running`, lien "Vidéos technique", PR, courbes de progression.
- Garder : Dashboard membres, Builder de programme, Messages, vue session d'un membre.

**Côté membre** :
- Cacher : `/membre/progression`, `/membre/historique` (poids), upload vidéo, install PWA.
- Garder : Dashboard, Programme, Logger (séance + chrono repos + YouTube), Messages.
- Skip onboarding → après login, redirection directe vers `/membre`.

Implémentation : retirer les entrées de `CoachSidebar.jsx` et `MemberNav.jsx` quand `BETA_MODE`, et early-return sur les routes correspondantes.

## 3. Builder programme — finaliser

L'infra existe (`saveProgram`, `assignProgram`). À compléter dans `BuilderNew.tsx` :
- Champ "lien YouTube" par exercice (déjà en partie en place — vérifier).
- Bouton "Assigner →" sur un programme sauvegardé → modal liste des membres (déjà coté via `listMembers`), check Teddy, confirme.
- Toast succès.

## 4. Séance membre — finaliser

Dans `src/pages/membre/Logger.jsx` :
- Vérifier : saisie poids/reps/RPE par set, démo YouTube cliquable (thumbnail → lecteur), chrono de récup avec vibration en fin.
- Modal fin de séance : RPE global + note pour le coach → `sessions.update({ status: 'completed', average_rpe, member_note, duration_minutes })`.
- Retour dashboard.

## 5. Messages — vérifier flow temps-réel

Déjà branché (`sendMessage`, `listConversations`, `listMessages`). Vérifier :
- Polling ou realtime sur `messages` pour rafraîchir la conversation côté destinataire.
- Pin d'un message côté coach affiché en bas du dashboard membre.

## 6. Vue coach d'une séance terminée

Page `/coach/membre/:id` (existe) doit lister les `sessions` de Teddy avec : date, RPE moyen, durée, note du membre, détail des `set_logs` + `exercise_feedbacks`.

## 7. Bannière beta

Composant `<BetaBanner />` monté dans `__root.tsx`, affiché si `BETA_MODE` :
```
BÊTA PRIVÉE · VOS RETOURS COMPTENT → leocolognesi@gmail.com
```
Style monospace vert (#2D5A35), 11px, en haut de chaque page.

## 8. Login — helper beta

Sous le formulaire de `Login.jsx`, bloc discret (texte muted, séparateur pointillé) listant les 2 emails de test si `BETA_MODE`.

## 9. Welcome cards première connexion

Pas besoin d'ajouter une colonne `first_login` en DB. Utiliser `localStorage` côté client (`beta_welcome_seen_coach` / `beta_welcome_seen_member`) :
- **Léo** : carte "Bienvenue, Léo 👋" sur `/coach` au 1er affichage, bouton "Créer un programme pour Teddy" → `/coach/builder?assign=<teddy_id>`.
- **Teddy** : si aucun `assignments.active`, page d'attente "Ton programme arrive bientôt" + bouton "Écrire à Léo".

## 10. RLS

Pas de migration de policies. Les policies actuelles sont déjà correctes et plus strictes que le brief (qui utilise une table `coach_members` qu'on n'a pas). Le coach voit tout via `has_role(auth.uid(), 'coach')`. On garde tel quel.

---

## Détails techniques

```text
Fichiers à créer / modifier
├── supabase/migrations/<ts>_seed_beta_accounts.sql   (seed Léo + Teddy)
├── src/lib/site.ts                                   (BETA_MODE flag)
├── src/components/BetaBanner.tsx                     (nouveau)
├── src/routes/__root.tsx                             (monter BetaBanner)
├── src/pages/auth/Login.jsx                          (helper beta sous form)
├── src/components/CoachSidebar.jsx                   (cacher entrées hors-beta)
├── src/components/MemberNav.jsx                      (idem)
├── src/pages/coach/Dashboard.jsx                     (welcome card Léo)
├── src/pages/membre/Dashboard.jsx                    (waiting screen Teddy)
├── src/pages/coach/BuilderNew.tsx                    (YouTube + assign flow)
├── src/pages/membre/Logger.jsx                       (vérif flow complet)
└── src/routes/_authenticated.coach.{import,running}.tsx  (redirect si BETA_MODE)
```

Pas de nouvelles dépendances. Pas d'edge function. Tout passe par les `createServerFn` existants et la migration de seed.

---

## Questions avant de coder

1. **Mot de passe en clair dans la migration** : la migration sera lisible dans le repo. OK pour la beta ou tu veux que je passe par un secret + script one-shot ?
2. **Pré-sélection Teddy dans le builder** : OK pour passer son user_id en query param `?assign=<uuid>` (lisible mais sans risque) ?
3. **Polling messages** : Supabase Realtime est branchable en 10 lignes — tu le veux ou un simple refetch toutes les 5s suffit pour la beta ?
