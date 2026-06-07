# Audit complet — Colosmartraining

Date : 7 juin 2026
Auteur : Lovable
Scope : revue end-to-end auth + espace membre + espace coach + server functions + RLS

Légende : **🔴 bloquant** · **🟠 dégradé** · **🟡 cosmétique / dette** · **✅ corrigé Phase 1**

---

## ✅ Phase 1 — déjà corrigé

| # | Domaine | Problème | Fix |
|---|---|---|---|
| P1-1 | Lancement séance | `_authenticated.membre.seance.$sessionId.tsx` : fallback silencieux sur 4 exercices génériques (Tractions / Row / Face pull / Curl) quand la structure ne renvoie rien. **Cause directe de la "séance aléatoire"**. | `DEFAULT_EXERCISES` supprimé. Écran d'erreur explicite + bouton « Choisir une autre séance ». Log diagnostic console. |
| P1-2 | Launcher séance | `_authenticated.membre.logger.tsx` : si le label ne matche aucun jour du programme, créait quand même une session avec `day_number: null`. | Erreur affichée, pas de session créée. Match avec normalisation NFD (accents/espaces tolérants). |
| P1-3 | Login Leo | Si la requête `user_roles` échoue après login, on restait bloqué sur l'écran sans navigation. | Try/catch + fallback rôle = `member` (Leo arrive sur `/membre` puis le layout `_authenticated` redirige vers `/coach`). |
| P1-4 | Layout authentifié | Double check session (beforeLoad + useEffect bloquant) → écran « CHARGEMENT… » potentiellement infini si le rôle ne se résout pas. | `useEffect` non bloquant : `<Outlet />` rendu immédiatement, redirection seulement si rôle ↔ chemin incohérent. |
| P1-5 | Code mort | `src/pages/membre/Logger.jsx` = 380 lignes de mock pur (PULL B, MOCK_EXERCISES) non importé. | Supprimé. |

---

## 🔴 Bloquants restants

Aucun identifié à ce stade après corrections P1. À reconfirmer avec un test de bout en bout côté Leo (cf. § « Tests à faire »).

---

## 🟠 Dégradés à corriger en priorité

### D1 — `_authenticated.tsx` : aucune protection si le membre arrive sur `/coach/...` directement
Maintenant que la redirection est non bloquante, un membre qui visite `/coach/dashboard` voit brièvement le contenu coach avant la redirection. **Fix proposé** : si `path.startsWith('/coach')` et rôle ≠ coach, rendre un splash plutôt que `<Outlet />` pendant le check.

### D2 — `_authenticated.membre.seance.$sessionId.tsx` : `finishSession` ne gère pas l'erreur
Si l'`update` Supabase échoue (RLS, réseau), `setFinishing(false)` est appelé dans `finally` mais l'utilisateur est navigué vers `/membre/historique` SANS savoir si la séance a été close. **Fix** : ne naviguer que si `error == null`, sinon toast.

### D3 — `Commencer.tsx` : `recommendedIdx` ne tient pas compte de l'ordre planifié réel
Calcule la « recommandée » comme « premier jour non complété ». Bonnes pratiques : prendre en compte `planned_sessions` avec `planned_date` le plus proche. Risque : on suggère un jour ancien alors qu'un jour planifié plus pertinent existe.

### D4 — Sessions « in_progress » zombies
Base actuelle : 5 sessions `in_progress` ouvertes (Séance libre depuis le 30 mai…). Le launcher actuel reprend la dernière → confusion. **Fix** : ajouter un cron / server function qui marque comme `abandoned` les sessions in_progress de + 24 h sans set_log.

### D5 — Login : pas de protection re-soumission
Si la requête est lente, plusieurs clics envoient plusieurs `signInWithPassword`. Le bouton est disabled si `loading` mais le state n'est posé qu'après début du fetch. **Fix** : disabled aussi dès `handleSubmit` invoqué.

### D6 — Realtime : channels potentiellement dupliqués
Plusieurs composants (MemberNav, Messages…) appellent `supabase.channel()` à chaque mount. Si un composant remonte (navigation rapide), le précédent channel est unsub mais le nouveau peut prendre quelques ms à se reconnecter → notifications manquées. À surveiller, pas bloquant.

### D7 — `coach/Messages` & `membre/Messages` : pas de scroll-to-bottom
À confirmer visuellement, mais le pattern de chat sans auto-scroll est un standard manquant.

---

## 🟡 Cosmétique / dette

- C1 — `_authenticated.membre.logger.tsx` : la route ne fait rien d'autre que créer/résumer une session. Pourrait être renommée en `/membre/start` pour plus de clarté (path actuel `/membre/logger` reste).
- C2 — Beaucoup de styles inline (`style={{ ... }}`). Pour la maintenabilité, à terme tout passer par `cst-*` classes.
- C3 — Console.error sur erreurs silencieuses → ajouter des toasts utilisateur (sonner est déjà installé, utilisé sporadiquement).
- C4 — Bundle : `LiveSession.tsx` = 1553 lignes, à découper en sous-composants.
- C5 — `rrd-shim.tsx` : nombreuses pages importent encore `react-router-dom`. Migration graduelle vers TanStack natif recommandée.
- C6 — Pas de `errorComponent`/`notFoundComponent` sur les routes individuelles (seul `__root.tsx` en a). Si un loader plante dans une route enfant, on remonte au root.

---

## 🔒 Sécurité — état

Audit sécurité du jour conclu : 0 finding ouvert. RLS en place sur toutes les tables sensibles, realtime gated par `can_subscribe_topic`, trigger anti-tampering sur `messages`. Mémoire sécurité : voir issues fermées récemment.

Note résiduelle : les 3 mots de passe en clair dans 2 anciennes migrations restent dans l'historique git. Les comptes concernés DOIVENT changer leur mot de passe.

---

## Tests à faire après Phase 1

1. **Leo (coach)** : se déconnecter complètement, fermer le navigateur, vider le cache du domaine, retenter `/login`. Confirmer la redirection vers `/coach`.
2. **Membre** : depuis `/membre/commencer`, cliquer chaque jour du programme. Vérifier que les exercices affichés sont ceux du programme et pas le fallback générique (qui a maintenant disparu).
3. **Membre** : démarrer une séance, en quitter une avant de la terminer, en redémarrer une autre → vérifier que la nouvelle prend bien la place de la première (realign de l'existante).
4. **Membre** : démarrer une séance libre, ajouter une activité, terminer. Confirmer que le coach reçoit la notif (table `messages`).

---

## Phase 3 — proposition d'ordre

Sous réserve que les tests Phase 1 confirment login + séances OK :

1. **D1 → D5** (lot 1, ~30 min) : protections UX manquantes
2. **D4** (lot 2, ~20 min) : cron sessions zombies (server function + pg_cron)
3. **C3 → C6** (lot 3, à la demande) : dette technique

Dis-moi si tu veux que j'enchaîne sur le lot 1, ou si tu préfères tester d'abord et revenir.
