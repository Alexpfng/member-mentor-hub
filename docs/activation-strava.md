# Activer Strava en production

Le code est **entièrement écrit** (connexion du membre, rafraîchissement des jetons,
import des sorties, webhook temps réel, rattachement à la séance du jour, écrans
coach et membre). Il ne tourne pas encore parce que **rien n'a été créé côté
production** : ni les tables, ni l'application Strava, ni les clés.

Quatre étapes, dans cet ordre. Compter 20 minutes.

---

## 1. Créer les deux tables (Supabase)

La production est hors MCP : le SQL se colle à la main.

1. Ouvrir le **dashboard Supabase** du projet `lupqpeqvtxnohjpolhna` → **SQL Editor**.
2. Copier **tout le contenu** de `supabase/migrations/20260727170000_add_member_strava_sync.sql`.
3. Coller, exécuter.

Le script est **idempotent** (`create table if not exists`, policies conditionnelles) :
le relancer ne casse rien.

Il crée :

| Table | Rôle |
|---|---|
| `member_strava_connections` | Un membre ↔ son compte Strava : jetons, expiration, scopes, dates de synchro. |
| `member_strava_activities` | Les sorties importées, et la séance à laquelle elles sont rattachées. |

Avec les index et les politiques RLS (le membre lit les siennes, le coach lit celles
de ses athlètes).

### Vérifier
```sql
select count(*) from public.member_strava_connections;
select count(*) from public.member_strava_activities;
```
Deux `0` = c'est bon.

---

## 2. Créer l'application Strava

Sur **https://www.strava.com/settings/api** (avec le compte Strava qui portera l'app) :

| Champ | Valeur |
|---|---|
| Application Name | ColoSmart Training |
| Category | Training |
| Website | `https://app.colosmartraining.fr` |
| **Authorization Callback Domain** | `app.colosmartraining.fr` |

> ⚠️ Le champ callback attend **le domaine seul** — sans `https://`, sans chemin.
> C'est l'erreur classique qui fait échouer la connexion avec « redirect_uri invalid ».

Strava affiche ensuite un **Client ID** et un **Client Secret** : garde-les pour l'étape 3.

---

## 3. Ajouter les variables d'environnement (Vercel)

Projet `colo-smart-app` → **Settings → Environment Variables**.
À créer pour **Production** (et Preview si tu veux tester sur les previews) :

| Variable | Valeur |
|---|---|
| `STRAVA_CLIENT_ID` | le Client ID donné par Strava |
| `STRAVA_CLIENT_SECRET` | le Client Secret donné par Strava |
| `STRAVA_STATE_SECRET` | une phrase secrète **que tu inventes** (voir ci-dessous) |
| `STRAVA_WEBHOOK_VERIFY_TOKEN` | une seconde phrase secrète que tu inventes |
| `APP_URL` | `https://app.colosmartraining.fr` (si elle n'existe pas déjà) |

`STRAVA_STATE_SECRET` signe le jeton d'état de la connexion OAuth : il empêche
qu'on rattache un compte Strava au mauvais membre. `STRAVA_WEBHOOK_VERIFY_TOKEN`
sert uniquement à ce que Strava prouve son identité en s'abonnant.

Pour générer deux secrets solides :
```bash
openssl rand -hex 32
openssl rand -hex 32
```

**Redéployer** après avoir ajouté les variables (elles ne sont lues qu'au démarrage).

---

## 4. Abonner le webhook

C'est ce qui fait remonter les sorties **automatiquement**, sans que le membre
ouvre l'app. À lancer **une seule fois**, une fois le site redéployé :

```bash
curl -X POST https://www.strava.com/api/v3/push_subscriptions \
  -F client_id=TON_CLIENT_ID \
  -F client_secret=TON_CLIENT_SECRET \
  -F callback_url=https://app.colosmartraining.fr/api/strava/webhook \
  -F verify_token=TON_STRAVA_WEBHOOK_VERIFY_TOKEN
```

Strava appelle immédiatement l'URL en `GET` pour la valider, puis répond un `id`
d'abonnement. Si tu obtiens une erreur, c'est presque toujours que le site n'a pas
encore été redéployé avec `STRAVA_WEBHOOK_VERIFY_TOKEN`.

Vérifier l'abonnement existant :
```bash
curl -G https://www.strava.com/api/v3/push_subscriptions \
  -d client_id=TON_CLIENT_ID -d client_secret=TON_CLIENT_SECRET
```

---

## 5. Tester

1. Se connecter en **coaché** → **Réglages → Connexions → Connecter Strava**.
2. Autoriser sur Strava (scopes demandés : `read`, `activity:read_all`).
3. De retour dans l'app, la section affiche **« Compte Strava connecté »** avec
   l'identifiant athlète et la date de dernière synchro.
4. Enregistrer une sortie sur Strava (ou en modifier une) → elle doit apparaître
   dans **Trail & Run** en moins d'une minute, sans rien faire.

---

## Ce que ça fait une fois activé

- Les sorties **course à pied et trail** (`Run`, `TrailRun`) remontent toutes seules :
  distance, temps, dénivelé, fréquence cardiaque moyenne, vitesse moyenne.
- Chaque sortie est **rattachée à la séance de course du jour** quand il y en a une :
  le coach voit le réalisé en face du prescrit.
- Les jetons se **rafraîchissent tout seuls** (ils expirent toutes les 6 heures).
- Le membre peut **déconnecter** son compte quand il veut, depuis les mêmes réglages.

## Limites connues

- Seuls `Run` et `TrailRun` sont importés. Le vélo, la natation et le renfo sont
  ignorés volontairement — dis-le moi si tu veux élargir.
- L'abonnement webhook est **unique par application Strava** : si tu veux le faire
  pointer un jour vers une autre URL, il faut supprimer l'abonnement existant
  (`DELETE /push_subscriptions/{id}`) avant d'en créer un autre.
