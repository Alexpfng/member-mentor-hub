## Constat de l'audit (rapide)

J'ai inspecté la base, le code de lancement de séance, les routes et les logs. Voici ce qui est avéré, ce qui est probable, et ce qui ne l'est pas.

### 1. Login — pas de bug serveur
- Le compte `leocolognesi@gmail.com` (coach) **s'est connecté avec succès aujourd'hui à 16:17 UTC** (last_sign_in_at en base). Donc l'auth Supabase fonctionne.
- La route `/login` rend bien (200 après canonicalisation du search param).
- Cause probable côté Leo : redirection bloquée ou écran "CHARGEMENT…" qui ne sort jamais, ou session corrompue dans le navigateur. Je traite ce point ci-dessous (étape 2).

### 2. Lancement de séance — bug confirmé
Fichier : `src/routes/_authenticated.membre.seance.$sessionId.tsx`

```text
if (!exos.length) exos = DEFAULT_EXERCISES; // Tractions / Row / Face pull / Curl
```

Si la résolution `program.structure.weeks[w].days[d].exercises` échoue (mauvais `day_number`, mauvais `week_number`, ou exercices vides), la page **affiche silencieusement 4 exercices génériques** au lieu d'avertir. C'est l'origine des "séances aléatoires".

Vérif base : les 3 programmes actifs (Teddy, Pierre, Max) ont bien des exercices (7 à 12 par jour). Donc le fallback ne devrait pas se déclencher — mais il existe et il masque un vrai problème quand il se déclenche.

### 3. Code mort à risque
`src/pages/membre/Logger.jsx` (380 lignes) est **du mock pur** (`MOCK_EXERCISES = [...]`, "PULL B" en dur). Aucune route ne l'importe — la vraie route `/membre/logger` utilise `SessionLauncher` défini dans `_authenticated.membre.logger.tsx`. À supprimer.

### 4. Reste à auditer (rapport, pas correction immédiate)
- Onboarding (`onboarding.$step.tsx`) — flow d'invitation/inscription
- Messages coach/membre (realtime, déjà sécurisé via `can_subscribe_topic`)
- Carnet hebdo (`/membre/carnet`) — génération via cron
- Coach dashboard, programme builder, page membre du coach
- Page `/membre/seance/$sessionId` complète (le composant `LiveSession.tsx` fait 1553 lignes — à vérifier pour mocks résiduels)
- `_authenticated.tsx` : le double check (beforeLoad + useEffect AuthenticatedLayout) peut générer des navigations en double si rôle ↔ chemin

---

## Plan d'action

### Phase 1 — Bugs bloquants (à corriger maintenant)

**A. Lancement de séance — supprimer le fallback silencieux**
- `_authenticated.membre.seance.$sessionId.tsx` : retirer `DEFAULT_EXERCISES`. Quand la structure ne renvoie rien, afficher un message clair ("Aucun exercice n'est défini pour ce jour — contacte ton coach") + bouton retour, et logger en console le couple `(programId, week, day, label)` pour diagnostic.
- `_authenticated.membre.logger.tsx` (SessionLauncher) : quand `search.day` ne matche aucun jour du programme, **ne pas créer de session avec `day_number: null`** — afficher l'erreur et rediriger vers `/membre/commencer`.
- Match plus tolérant : normaliser (trim + lowercase + suppression accents) côté launcher pour résister aux libellés saisis avec/sans accents/espaces.

**B. Login Leo — diagnostic + fix réactif**
- Demander à Leo de vider le cache + retenter (la session navigateur peut être désynchronisée du dernier déploiement).
- Renforcer `_authenticated.tsx` : supprimer la double redirection (le `beforeLoad` fait déjà `getUser`, le `useEffect` ré-interroge en plus → flicker possible). Garder une seule source de vérité côté `useEffect` pour la vérif de rôle, et afficher un bouton "Se reconnecter" si la session est invalide au lieu d'un écran "CHARGEMENT…" infini.
- Sur `/login`, si `supabase.auth.signInWithPassword` réussit mais que la requête `user_roles` échoue (RLS, latence), aujourd'hui on reste bloqué → ajouter fallback "/membre" + log.

**C. Nettoyage**
- Supprimer `src/pages/membre/Logger.jsx` (mock, plus utilisé).

### Phase 2 — Audit large (rapport)

Je passerai en revue dans cet ordre et te livrerai un rapport `AUDIT.md` listant chaque problème trouvé avec un niveau (bloquant / dégradé / cosmétique) **avant** de toucher au code :

1. Auth / onboarding / reset password (3 routes)
2. Espace membre : commencer, logger, seance, seance-libre, carnet, planning, programme, profil, progression, historique, messages
3. Espace coach : dashboard, builder, programmes, exercices, membre, seance, messages, invitations, import, running
4. Composant `LiveSession.tsx` (1553 lignes — chercher mocks, états orphelins, fuites realtime)
5. Server functions (`src/lib/*.functions.ts`) — cohérence des inputValidators, fuites de données via `supabaseAdmin`
6. RLS — vérifier que les policies présentes correspondent aux usages réels du code

### Phase 3 — Correctifs issus du rapport
Après ta validation des items priorisés du rapport, je corrige par lots (1 lot = 1 domaine fonctionnel) pour que tu puisses tester au fur et à mesure.

---

## Ce qu'il me faut pour démarrer
Rien de plus : je peux lancer Phase 1 immédiatement. Phase 2 (audit) suit dans la foulée — je te livre `AUDIT.md` avant toute autre modification.

Validation pour lancer Phase 1 + Phase 2 ?
