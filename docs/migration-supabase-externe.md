# Migration de la base Lovable Cloud → Supabase externe

**Source** : `lupqpeqvtxnohjpolhna` (Lovable Cloud) — actuellement **en pause**
**Cible** : `wvcfiimxudedppmolsic.supabase.co` (ta Supabase)

> Règle absolue de ce runbook : **on n'écrase jamais la cible sans backup**, et **aucun UUID n'est régénéré**.

---

## 0. Pré-requis

Sur ta machine :

```bash
brew install postgresql@16 supabase/tap/supabase   # ou apt install postgresql-client
psql --version   # doit être >= 15
```

Tu as besoin de 2 chaînes de connexion :

| Rôle | Où la trouver |
|---|---|
| **SOURCE** (Lovable Cloud) | La base doit d'abord être **réactivée** (Cloud → Resume). Le mot de passe DB n'est pas exposé côté Lovable Cloud : voir §1 pour les deux voies possibles. |
| **CIBLE** (ta Supabase) | Dashboard `wvcfiimxudedppmolsic` → Project Settings → Database → Connection string (URI, port 5432, pas le pooler 6543) |

```bash
export TARGET="postgresql://postgres.wvcfiimxudedppmolsic:<MOT_DE_PASSE>@aws-0-<region>.pooler.supabase.com:5432/postgres"
```

---

## 1. Récupérer le contenu de la source

Deux voies, selon ce que tu peux obtenir.

### Voie A — tu as un accès `pg_dump` à la source (recommandée)

Si tu obtiens la chaîne de connexion complète de la source (support Lovable, ou si le projet est rattaché à ton org Supabase) :

```bash
export SOURCE="postgresql://postgres.lupqpeqvtxnohjpolhna:<PWD>@aws-0-eu-west-1.pooler.supabase.com:5432/postgres"

mkdir -p ~/cst-migration && cd ~/cst-migration

# 1. Schéma public (tables, types, fonctions, triggers, RLS, grants)
pg_dump "$SOURCE" --schema=public --no-owner --no-privileges \
  --schema-only -f 01_schema_public.sql

# 2. Privilèges + policies (déjà inclus au-dessus si tu retires --no-privileges)
pg_dump "$SOURCE" --schema=public --no-owner --schema-only -f 01b_schema_with_acl.sql

# 3. Données public
pg_dump "$SOURCE" --schema=public --data-only --no-owner \
  --disable-triggers -f 02_data_public.sql

# 4. Comptes utilisateurs (auth) — hashs de mots de passe inclus
pg_dump "$SOURCE" --table=auth.users --table=auth.identities \
  --data-only --no-owner -f 03_auth_users.sql

# 5. Métadonnées storage (les objets, pas les fichiers binaires)
pg_dump "$SOURCE" --table=storage.buckets --table=storage.objects \
  --data-only --no-owner -f 04_storage_meta.sql
```

### Voie B — pas d'accès `pg_dump` (cas Lovable Cloud standard)

1. **Réactive la base** (Cloud → Resume), puis dans Lovable : **Cloud → Advanced settings → Export data** → tu récupères les données `public` en CSV.
2. Pour le **schéma** et **auth.users**, demande-moi de les générer : une fois la base active, je produis par introspection
   - `supabase/export/01_schema_public.sql` (33 tables, enums, fonctions, triggers, policies, grants),
   - `supabase/export/02_data_public.sql` (INSERT avec UUID d'origine, ordre FK respecté),
   - `supabase/export/03_auth_users.sql` (UUID + email + `encrypted_password` bcrypt).

   ⚠️ Les migrations du dossier `supabase/migrations/` sont **incomplètes** (les dernières — `assignment_weeks`, `member_coach_notes`, `can_subscribe_topic`, durcissements RLS — ont été appliquées hors dossier). **Ne reconstruis pas le schéma en rejouant ce dossier**, il produirait une base fausse. Le dump/introspection de la base live est la seule source de vérité.

---

## 2. Backup de la CIBLE avant tout (obligatoire)

```bash
pg_dump "$TARGET" -Fc -f ~/cst-migration/TARGET_BACKUP_$(date +%F_%H%M).dump
```

Et côté dashboard cible : Database → Backups → note le dernier PITR disponible.

Vérifie ensuite que la cible est bien vide (sinon on s'arrête et on décide quoi faire) :

```sql
-- À exécuter dans le SQL Editor de la CIBLE
select table_name from information_schema.tables
where table_schema = 'public' order by 1;

select count(*) as nb_users from auth.users;
```

Si `nb_users > 0` ou des tables existent déjà : **stop**, on repart sur un projet Supabase neuf (le plus sûr) plutôt que de fusionner.

---

## 3. Ordre d'exécution sur la CIBLE

Chaque étape dans le **SQL Editor** de `wvcfiimxudedppmolsic`, ou via `psql "$TARGET" -f <fichier>`.

### Étape 3.1 — Extensions

```sql
create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;
create extension if not exists pg_net;
create extension if not exists pg_cron;
```

### Étape 3.2 — Comptes utilisateurs (AVANT le schéma public)

`public.profiles`, `user_roles`, etc. référencent `auth.users(id)` : les users doivent exister d'abord.

**Option 1 — les mots de passe sont conservés** (voie A, ou fichier `03_auth_users.sql` que je génère).
Les hashs bcrypt sont portables entre projets Supabase :

```bash
psql "$TARGET" -f 03_auth_users.sql
```

Le dump contient, par utilisateur, exactement :

```sql
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token,
  email_change_token_new, email_change, is_sso_user, is_anonymous
) values (
  '<UUID D'ORIGINE>', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  'coach@exemple.fr', '<hash bcrypt copié tel quel>',
  now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
  '<created_at d'origine>', now(), '', '', '', '', false, false
);

insert into auth.identities (id, user_id, provider_id, provider, identity_data, created_at, updated_at)
values (gen_random_uuid(), '<UUID D'ORIGINE>', '<UUID D'ORIGINE>', 'email',
        jsonb_build_object('sub','<UUID D'ORIGINE>','email','coach@exemple.fr','email_verified',true),
        now(), now());
```

Points clés : `instance_id` = zéros, `aud`/`role` = `authenticated`, les colonnes token = `''` (pas NULL, sinon le login casse), et **une ligne `auth.identities` par user** sinon la connexion email/mot de passe échoue.

**Option 2 — mots de passe non transférables** (tu n'as que les emails).
On recrée chaque compte **avec son UUID d'origine** via l'Admin API, puis on envoie un reset :

```bash
# pour chaque (uuid, email) de la source
curl -X POST "https://wvcfiimxudedppmolsic.supabase.co/auth/v1/admin/users" \
  -H "apikey: $TARGET_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $TARGET_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"id":"<UUID D_ORIGINE>","email":"coach@exemple.fr","email_confirm":true,
       "password":"<mot de passe temporaire aléatoire>"}'
```

`"id"` est accepté par l'Admin API → **les UUID sont préservés**, donc aucun lien de données ne casse. Ensuite, pour chacun :

```bash
curl -X POST "https://wvcfiimxudedppmolsic.supabase.co/auth/v1/recover" \
  -H "apikey: $TARGET_ANON_KEY" -H "Content-Type: application/json" \
  -d '{"email":"coach@exemple.fr"}'
```

Le membre reçoit un mail « définir un nouveau mot de passe » et atterrit sur `/reset-password` (route déjà existante dans l'app). Prérequis : dans la cible, Authentication → URL Configuration → Site URL = `https://app.colosmartraining.fr`, et Redirect URLs incluant `https://app.colosmartraining.fr/reset-password` + l'URL Vercel de preview.

### Étape 3.3 — Schéma public

```bash
psql "$TARGET" -f 01b_schema_with_acl.sql
```

Contient : enum `app_role`, les 33 tables, les FK vers `auth.users`, les fonctions (`has_role`, `get_user_role`, `consume_invitation`, `validate_invitation`, `can_subscribe_topic`, `enqueue_email`, …), les triggers (`update_updated_at`, immutabilité du contenu des messages, …), RLS + policies, et les GRANT (`authenticated`, `anon`, `service_role`).

Contrôle immédiat après exécution :

```sql
-- toutes les tables doivent avoir RLS activé
select relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r' and not c.relrowsecurity;
-- doit renvoyer 0 ligne

-- toutes les tables doivent avoir au moins un GRANT
select t.table_name from information_schema.tables t
left join information_schema.role_table_grants g
  on g.table_name=t.table_name and g.table_schema='public'
  and g.grantee in ('authenticated','anon','service_role')
where t.table_schema='public' and t.table_type='BASE TABLE'
group by 1 having count(g.grantee)=0;
-- doit renvoyer 0 ligne
```

### Étape 3.4 — Données public

```bash
psql "$TARGET" -f 02_data_public.sql
```

Si tu insères à la main / depuis les CSV, respecte **cet ordre** (dépendances FK) :

```
1.  profiles
2.  user_roles
3.  member_profiles
4.  member_coach_notes
5.  member_notification_prefs
6.  exercises · intensity_codes · glossary
7.  programs
8.  assignments
9.  assignment_weeks
10. planned_sessions
11. sessions
12. set_logs
13. exercise_feedbacks · exercise_comments
14. free_activities · run_stats · session_media
15. pain_reports · technique_videos · personal_records
16. weight_logs · weekly_logbooks
17. messages
18. invitations
19. member_strava_connections → member_strava_activities
20. running_routes
21. email_send_log · email_send_state · email_unsubscribe_tokens · suppressed_emails
```

Toujours en `--disable-triggers` (ou `set session_replication_role = replica;` … `reset session_replication_role;`) pour éviter que les triggers `updated_at` / immutabilité ne réécrivent les données historiques.

**Aucun `gen_random_uuid()` dans les INSERT** : les `id` sont ceux de la source, sinon `sessions.assignment_id`, `set_logs.session_id`, `exercise_feedbacks.session_id`, `assignment_weeks.assignment_id`, `programs.coach_id` pointent dans le vide.

### Étape 3.5 — Storage : buckets + fichiers

4 buckets utilisés par l'app :

| Bucket | Public | Contenu |
|---|---|---|
| `technique-videos` | non | vidéos technique membre |
| `session-media` | non | photos/vidéos de séance |
| `progress-photos` | non | photos de progression |
| `running-routes` | **oui** | traces GPX/images de parcours |

Crée-les dans la cible (Dashboard → Storage → New bucket) **avec exactement ces noms**, puis rejoue les policies `storage.objects` (elles sont dans le dump de schéma ; sinon voici le motif) :

```sql
-- exemple pour session-media (dossier = auth.uid())
create policy "member upload own session media" on storage.objects for insert to authenticated
  with check (bucket_id = 'session-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "member read own session media" on storage.objects for select to authenticated
  using (bucket_id = 'session-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "member delete own session media" on storage.objects for delete to authenticated
  using (bucket_id = 'session-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "coach read session media" on storage.objects for select to authenticated
  using (bucket_id = 'session-media' and public.has_role(auth.uid(), 'coach'::app_role));
```

Copie des fichiers (les chemins `storage_path` en base doivent rester identiques) :

```bash
# nécessite les service_role keys des deux projets
npx -y @supabase/storage-migrate \
  --source-url  https://lupqpeqvtxnohjpolhna.supabase.co --source-key "$SRC_SERVICE_KEY" \
  --target-url  https://wvcfiimxudedppmolsic.supabase.co --target-key "$DST_SERVICE_KEY" \
  --buckets technique-videos,session-media,progress-photos,running-routes
```

À défaut : script Node listant `storage.objects` de la source, `createSignedUrl` → download → `upload` vers la cible **en conservant le même `name`/chemin**. Ne renomme rien : `session_media.storage_path`, `technique_videos.storage_path`, `member_measurement_photos.storage_path` référencent ces chemins.

### Étape 3.6 — Cron du carnet hebdo

L'app a un job `generate-weekly-logbooks` (dimanche 20h UTC) qui appelle `/api/public/hooks/generate-logbooks`. À recréer dans la cible :

```sql
select cron.schedule(
  'generate-weekly-logbooks',
  '0 20 * * 0',
  $$select net.http_post(
      url := 'https://app.colosmartraining.fr/api/public/hooks/generate-logbooks',
      headers := jsonb_build_object('Content-Type','application/json',
                                    'x-cron-secret', '<CRON_SECRET>')
    )$$
);
```

Utilise le même secret que celui configuré côté app.

---

## 4. Variables d'environnement à basculer

### Vercel (Project Settings → Environment Variables, pour Production **et** Preview)

| Variable | Nouvelle valeur |
|---|---|
| `VITE_SUPABASE_URL` | `https://wvcfiimxudedppmolsic.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | anon/publishable key de la cible |
| `VITE_SUPABASE_PROJECT_ID` | `wvcfiimxudedppmolsic` |
| `SUPABASE_URL` | `https://wvcfiimxudedppmolsic.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | anon/publishable key de la cible |
| `SUPABASE_PROJECT_ID` | `wvcfiimxudedppmolsic` |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key de la cible (**server only**) |

Autres secrets à reporter tels quels (indépendants de Supabase) : `LOVABLE_API_KEY`, `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, secret du cron, clés email.

Après changement de variables : **redeploy** (les `VITE_*` sont inlinés au build, un simple restart ne suffit pas).

### Repo

`.env` local et `supabase/config.toml` (`project_id = "wvcfiimxudedppmolsic"`). Aucun code applicatif à modifier : tout passe déjà par `src/integrations/supabase/client.ts` / `client.server.ts` qui lisent ces variables.

### Côté fournisseurs externes

- **Strava** : callback `https://app.colosmartraining.fr/api/strava/callback` (inchangé si le domaine ne change pas), et l'abonnement webhook à recréer si tu changes de domaine.
- **Auth cible** : Site URL + Redirect URLs (§3.2), et activation du provider Email (+ Google si utilisé).

---

## 5. Vérification post-migration

À exécuter sur la CIBLE — chaque requête doit renvoyer **0 ligne** :

```sql
-- 1. profils orphelins
select p.id from public.profiles p left join auth.users u on u.id=p.id where u.id is null;

-- 2. rôles orphelins
select r.user_id from public.user_roles r left join auth.users u on u.id=r.user_id where u.id is null;

-- 3. programmes sans coach
select pr.id from public.programs pr left join auth.users u on u.id=pr.coach_id where u.id is null;

-- 4. assignments cassés
select a.id from public.assignments a
  left join public.programs pr on pr.id=a.program_id
  left join auth.users u on u.id=a.member_id
where pr.id is null or u.id is null;

-- 5. séances cassées
select s.id from public.sessions s left join auth.users u on u.id=s.member_id where u.id is null;

-- 6. logs de séries orphelins
select l.id from public.set_logs l left join public.sessions s on s.id=l.session_id where s.id is null;

-- 7. RPE / feedbacks orphelins
select f.id from public.exercise_feedbacks f left join public.sessions s on s.id=f.session_id where s.id is null;

-- 8. semaines adaptées orphelines
select w.id from public.assignment_weeks w left join public.assignments a on a.id=w.assignment_id where a.id is null;

-- 9. médias sans séance
select m.id from public.session_media m left join public.sessions s on s.id=m.session_id where s.id is null;
```

Et un comptage comparatif source ↔ cible :

```sql
select 'profiles' t, count(*) from public.profiles
union all select 'user_roles', count(*) from public.user_roles
union all select 'programs', count(*) from public.programs
union all select 'assignments', count(*) from public.assignments
union all select 'assignment_weeks', count(*) from public.assignment_weeks
union all select 'sessions', count(*) from public.sessions
union all select 'set_logs', count(*) from public.set_logs
union all select 'exercise_feedbacks', count(*) from public.exercise_feedbacks
union all select 'messages', count(*) from public.messages
union all select 'users(auth)', count(*) from auth.users
order by 1;
```

Puis tests fonctionnels : connexion coach → dashboard chargé, fiche membre → semaines livrées visibles, connexion membre → programme + planning + historique corrects, démarrer une séance → bons exercices, upload photo de séance → visible côté coach.

---

## 6. Rollback

Rien n'est détruit côté source : tant que tu n'as pas supprimé le projet Lovable Cloud, le retour arrière consiste à remettre les anciennes variables d'environnement dans Vercel et à redeployer. Côté cible, `TARGET_BACKUP_*.dump` permet de repartir de zéro :

```bash
psql "$TARGET" -c 'drop schema public cascade; create schema public;'
pg_restore -d "$TARGET" ~/cst-migration/TARGET_BACKUP_<date>.dump
```

Conserve la source active (non supprimée) **au moins 2 semaines** après bascule.

---

## 7. Ce que je peux générer pour toi

Dès que la base hébergée est réactivée, dis-le moi et je produis par introspection de la base live :

- `supabase/export/01_schema_public.sql` — schéma complet exact (types, tables, FK, fonctions, triggers, RLS, grants)
- `supabase/export/02_data_public.sql` — toutes les données, UUID d'origine, ordre FK garanti
- `supabase/export/03_auth_users.sql` — comptes coach + coachés avec hashs de mots de passe (donc **connexions préservées**)
- `supabase/export/04_storage_policies.sql` — buckets + policies
- `supabase/export/05_verify.sql` — le bloc de vérification ci-dessus

Il ne te restera qu'à les exécuter dans l'ordre sur `wvcfiimxudedppmolsic`.
