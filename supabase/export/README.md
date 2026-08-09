# Export complet — vers Supabase externe `wvcfiimxudedppmolsic`

Généré le **2026-08-09** par introspection de la base live (source `lupqpeqvtxnohjpolhna`).
**Tous les UUID d'origine sont préservés** (users, profils, programmes, assignments, séances, logs, médias).

## Fichiers

| Fichier | Contenu |
|---|---|
| `01_schema_public.sql` | Schéma `public` complet : 36 tables, enums, 64 objets (tables/types/fonctions/triggers), 85 policies RLS, 203 GRANT, index, FK vers `auth.users` |
| `02_auth_users.sql` | 9 comptes `auth.users` + `auth.identities` — **hashs bcrypt inclus, donc les mots de passe actuels continuent de fonctionner** |
| `03_data_public.sql` | Toutes les données `public` (~3 100 lignes d'INSERT), UUID d'origine, FK neutralisées pendant l'import |
| `04_storage.sql` | 3 buckets (`progress-photos`, `session-media`, `technique-videos`) + policies `storage.objects` + métadonnées des 36 fichiers |
| `05_verify.sql` | Contrôles post-migration (orphelins, RLS, GRANT, comptages attendus) |

## Ordre d'exécution sur la cible

```bash
export TARGET="postgresql://postgres.wvcfiimxudedppmolsic:<PWD>@aws-0-<region>.pooler.supabase.com:5432/postgres"

# 0. BACKUP de la cible (obligatoire)
pg_dump "$TARGET" -Fc -f TARGET_BACKUP_$(date +%F_%H%M).dump

# 1. Extensions
psql "$TARGET" -c 'create extension if not exists "uuid-ossp"; create extension if not exists pgcrypto; create extension if not exists pg_net; create extension if not exists pg_cron;'

# 2. Comptes utilisateurs AVANT le schéma public (les FK pointent sur auth.users)
psql "$TARGET" -f 02_auth_users.sql

# 3. Schéma public
psql "$TARGET" -f 01_schema_public.sql

# 4. Données
psql "$TARGET" -f 03_data_public.sql

# 5. Storage (buckets + policies + métadonnées)
psql "$TARGET" -f 04_storage.sql

# 6. Vérification
psql "$TARGET" -f 05_verify.sql
```

Les fichiers sont aussi copiables/collables dans le **SQL Editor** du dashboard cible
(`03_data_public.sql` est volumineux → préférer `psql`).

## Fichiers binaires du storage

`04_storage.sql` ne transporte que les métadonnées. Pour les fichiers eux-mêmes, en
conservant **exactement les mêmes chemins** (`session_media.storage_path`,
`technique_videos.storage_path`, `member_measurement_photos.storage_path` y font référence) :

```bash
npx -y @supabase/storage-migrate \
  --source-url https://lupqpeqvtxnohjpolhna.supabase.co --source-key "$SRC_SERVICE_KEY" \
  --target-url https://wvcfiimxudedppmolsic.supabase.co --target-key "$DST_SERVICE_KEY" \
  --buckets progress-photos,session-media,technique-videos
```

Si tu laisses l'outil recréer les objets, saute le dernier bloc de `04_storage.sql`
(les lignes `insert into storage.objects`).

## À ne pas oublier après l'import

1. **Auth cible** : provider Email activé, Site URL = `https://app.colosmartraining.fr`,
   Redirect URLs incluant `/reset-password` et l'URL de preview.
2. **Cron carnet hebdo** :
   ```sql
   select cron.schedule('generate-weekly-logbooks','0 20 * * 0',
     $$select net.http_post(
        url := 'https://app.colosmartraining.fr/api/public/hooks/generate-logbooks',
        headers := jsonb_build_object('Content-Type','application/json','x-cron-secret','<CRON_SECRET>'))$$);
   ```
3. **Variables d'env** (`VITE_SUPABASE_*`, `SUPABASE_*`, `SUPABASE_SERVICE_ROLE_KEY`) +
   `supabase/config.toml` → `project_id = "wvcfiimxudedppmolsic"`, puis **redeploy**
   (les `VITE_*` sont inlinés au build).
4. **Strava** : callback `https://app.colosmartraining.fr/api/strava/callback` et
   re-souscription du webhook.

Détail complet du runbook et rollback : `docs/migration-supabase-externe.md`.

## Note

Une `DATABASE_URL` Postgres de la source n'est pas récupérable ici : sur cette
plateforme le mot de passe de la base et la clé `service_role` ne sont pas exposés.
Ces exports SQL en sont l'équivalent fonctionnel (schéma + données + comptes +
storage, UUID conservés).
