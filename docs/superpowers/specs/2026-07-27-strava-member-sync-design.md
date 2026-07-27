# Intégration Strava membre par membre — Design

## Objectif

Permettre à chaque membre de connecter son propre compte Strava afin que ses activités de course remontent automatiquement dans l'application et soient rattachées à la séance course prévue du jour quand cela est possible.

## Contexte existant

- L'application possède déjà un flux course membre avec persistance structurée dans `run_stats`.
- Les séances course sont déjà distinguées du flux musculation.
- Le produit dispose déjà d'un fallback manuel par capture d'écran et saisie des stats.
- La production Supabase n'est pas accessible via MCP ; les migrations devront donc être livrées en SQL prêt à coller.

## Périmètre

### Inclus

- Connexion Strava individuelle côté membre
- Stockage serveur des credentials Strava
- Callback OAuth Strava
- Webhook Strava pour synchronisation automatique
- Rattachement automatique d'une activité à la séance course du jour
- Alimentation de `run_stats`
- Visibilité du statut de connexion côté membre
- Déconnexion Strava
- Fallback conservé vers le flux manuel déjà existant

### Exclus

- Connexion Garmin native
- Import musculation depuis Strava
- Réconciliation parfaite de plusieurs courses le même jour
- Historique Strava complet à l'installation
- Dashboard admin Strava avancé

## Approche retenue

Chaque membre connecte Strava depuis son espace membre. Une fois l'autorisation donnée, l'application stocke les jetons côté serveur et enregistre l'identifiant athlète Strava. Un webhook Strava notifie l'application lors de la création ou mise à jour d'une activité. L'application récupère alors l'activité complète via l'API Strava, normalise les métriques utiles, cherche une séance course candidate pour ce membre à la même date, puis écrit les données dans `run_stats`.

Le système doit être idempotent : une même activité Strava ne doit pas créer plusieurs enregistrements ou écraser abusivement des données plus fiables.

## Architecture

### 1. Données

Créer une table dédiée de liaison Strava membre, par exemple `member_strava_connections`, contenant :

- `member_id`
- `strava_athlete_id`
- `access_token`
- `refresh_token`
- `expires_at`
- `scope`
- `last_sync_at`
- `created_at`
- `updated_at`

Créer une table d'import d'activités, par exemple `member_strava_activities`, contenant :

- `member_id`
- `strava_activity_id`
- `session_id` nullable
- `activity_type`
- `name`
- `started_at`
- `distance_m`
- `moving_time_s`
- `elapsed_time_s`
- `elevation_gain_m`
- `average_heartrate`
- `average_speed_mps`
- `raw_payload`
- `sync_status`
- `sync_error`
- `created_at`
- `updated_at`

Cette table sert d'audit, d'idempotence et de zone tampon quand le rattachement automatique est ambigu.

### 2. OAuth membre

Ajouter un bouton `Connecter Strava` dans l'espace membre, de préférence dans le profil. Le membre est redirigé vers Strava avec les scopes minimums nécessaires à la lecture de ses activités. Le callback serveur échange le `code` contre des jetons, récupère l'athlète, puis enregistre ou met à jour la connexion.

### 3. Synchronisation

Le webhook Strava reçoit les événements `create` et `update` sur les activités. À réception :

1. vérifier le challenge et la signature
2. identifier le membre via `owner_id` / `athlete_id`
3. rafraîchir le token si besoin
4. récupérer l'activité complète
5. ignorer ce qui n'est pas une course utile au produit
6. upsert l'activité dans `member_strava_activities`
7. tenter le rattachement automatique
8. si rattachement possible, upsert `run_stats`

### 4. Rattachement automatique

Ordre de priorité :

1. séance `course` du jour en `in_progress`
2. séance `course` du jour en `planned` ou équivalent logique côté produit
3. séance `course` du jour en `completed` sans `run_stats`

Cas de non-rattachement :

- plusieurs séances course candidates le même jour
- activité hors fenêtre temporelle raisonnable
- activité déjà rattachée à une autre séance

Dans ces cas, l'activité reste importée mais non liée. Une future itération pourra proposer une résolution manuelle.

### 5. Source de vérité

Pour les séances course liées à Strava :

- `run_stats` devient la source de vérité des métriques de course
- les interprétations texte générées automatiquement ne doivent pas écraser les métriques brutes
- le fallback capture d'écran reste disponible si Strava n'est pas connecté

## UX

### Côté membre

- état `non connecté`
- état `connecté à Strava`
- affichage du dernier sync
- bouton `déconnecter`
- message simple expliquant que les courses du jour seront rattachées automatiquement

### Côté coach

Rien de nouveau n'est requis pour la première version si le coach lit déjà `run_stats`. Il faut simplement que les données Strava injectées remontent dans les écrans existants de suivi course.

## Sécurité

- jetons stockés côté serveur uniquement
- aucune exposition du `refresh_token` au client
- vérification du webhook Strava
- refresh token géré côté serveur
- suppression de la connexion et purge locale au moment de la déconnexion
- politiques RLS strictes sur les nouvelles tables

## Gestion d'erreurs

- token expiré ou révoqué : marquer la connexion comme invalide et demander une reconnexion
- webhook reçu avant la fin de l'onboarding OAuth : journaliser puis ignorer
- activité non course : stocker ou ignorer selon le bruit attendu, sans créer de `run_stats`
- ambiguïté de rattachement : garder l'activité importée non liée

## Tests à prévoir

- callback OAuth heureux
- refresh token
- idempotence webhook
- rattachement automatique à la séance course du jour
- non-rattachement quand plusieurs séances course existent
- alimentation correcte de `run_stats`
- déconnexion membre

## Critères de succès

- un membre peut connecter son compte Strava sans passer par le coach
- une course Strava du jour remonte automatiquement dans l'application
- Léo voit les métriques brutes remontées côté coach via les écrans existants
- le fallback manuel continue de fonctionner pour les membres non connectés

