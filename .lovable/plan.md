# Refonte Dashboard Coach & Suivi des Coachés

Objectif : transformer `coach/Dashboard.jsx` en poste de pilotage temps réel, enrichir la fiche membre et le détail de séance, brancher notifications + Realtime.

## Pré-requis BDD (1 migration)

Avant tout, créer les éléments manquants :

1. **Table `pain_reports`** (Phase 2 du plan précédent, jamais exécutée)
   - colonnes : `member_id`, `session_id`, `exercise_name`, `zone`, `intensity` (1-5), `comment`, `resolved_at`, `created_at`
   - RLS : membre gère ses signalements ; coach lit tout ; coach peut marquer `resolved_at`.
   - GRANT authenticated + service_role.
2. **`sessions.coach_seen boolean default false`** — pour badges "NOUVEAU" et compteur "à traiter".
3. **Realtime** : `ALTER PUBLICATION supabase_realtime ADD TABLE sessions, pain_reports, technique_videos, messages, exercise_feedbacks;`
4. Optionnel : index `sessions(member_id, ended_at desc)`, `exercise_feedbacks(session_id)`.

## 1. Dashboard Coach — `src/pages/coach/Dashboard.jsx` → réécriture

Nouvelle structure (sections numérotées style design system existant) :

- **Header** : "01 TABLEAU DE BORD · {prénom} · {jour date}"
- **Cartes métriques (4)** : Coachés actifs, Séances cette semaine, À traiter (accent si >0), Adhérence moyenne 7j.
- **02 À TRAITER EN PRIORITÉ** : flux trié
  1. Douleurs actives (`pain_reports` where `resolved_at is null`) — tri intensité desc
  2. Séances avec RPE anormal (`exercise_feedbacks.rpe ≥ 9` ≥ 2× ou un 10) non vues
  3. Vidéos technique non revues (`coach_reviewed = false`)
  4. Messages non lus (`to_id = coach AND read = false`)
  5. Décrochage : membres sans séance depuis > 4j vs fréquence prévue
  - Chaque item : icône colorée, libellé, contexte, **boutons inline** (Voir séance, Adapter, Message, Marquer résolu…)
  - État vide : "Rien à traiter — tes coachés sont à jour 💪"
- **03 SÉANCES RÉCENTES** : 10 dernières sessions completed, temps réel (channel `sessions`)
  - Avatar, nom, label séance, semaine/jour, temps relatif
  - Stats : blocs faits, durée, RPE moyen, note membre tronquée, badge douleur si présente
  - Badge "NOUVEAU" si `coach_seen=false`
  - Clic → route détail séance
- **04 MES COACHÉS** : tableau triable (alerte par défaut, nom, adhérence, dernière séance)
  - Pastille 🔴/🟠/🟢 dérivée (douleur active > RPE élevé récent > OK)
  - Colonnes : Coaché, Programme, Semaine x/y, Dernière séance, Adhérence 7j, État
  - Actions rapides ligne : Voir / Adapter / Message
  - Clic ligne → `/coach/membre/$memberId?tab=suivi`

Chargement progressif : métriques + "à traiter" d'abord, reste en suspense.

## 2. Détail séance coach — nouvelle route

`src/routes/_authenticated.coach.seance.$sessionId.tsx` + page `src/pages/coach/SessionDetail.tsx`.

Vue lecture seule :
- **Résumé** : blocs complétés, RPE moyen, volume total, ressenti global
- **Note membre** (session.member_note)
- **Bandeau douleur** si `pain_reports` lié à la session (zone, intensité, commentaire, [Adapter cet exo] [Marquer résolu])
- **Détail par exercice** : pour chaque bloc du programme
  - Prévu (depuis `programs.structure`) vs réalisé (depuis `set_logs` + `exercise_feedbacks`)
  - Série par série : poids × reps · RPE · note série
  - Badge ⚠ "RPE > prévu" quand `feedback.rpe > rpe_cible + 1`
  - Badge 🔴 DOULEUR si exo dans `pain_reports`
- **Actions** : [Répondre au membre] [Préparer la semaine suivante] [✓ Marquer comme vu] (set `coach_seen=true`)

Au montage, marquer `coach_seen=true` (optimiste + update Supabase).

## 3. Fiche membre — onglet SUIVI enrichi

Dans `src/pages/coach/Member.jsx`, ajouter/refondre onglet "SUIVI" :
- KPIs 30j : adhérence %, RPE moyen, douleurs actives, prochaine séance prévue
- **Courbe adhérence 8 semaines** (Recharts LineChart)
- **Courbe RPE moyen par semaine** (LineChart, seuil visuel à 9)
- **Exercices à surveiller** : top exos avec RPE ≥ 9 récurrent OU sous-coté (RPE ≤ 6) OU douleur récente — calcul côté serveur
- **Historique douleurs** (résolues + actives) avec action ✓ résoudre
- Actions : [Préparer la semaine X+1] [Message] [Changer de programme]

## 4. Progression par exercice (vue coach)

Sous-section ou onglet de la fiche membre :
- Sélecteur d'exercice (exos présents dans l'historique du membre)
- Graphe charge max + RPE par séance (Recharts ComposedChart)
- Texte d'analyse simple : "charge stable, RPE qui monte → plateau"

## 5. Signalement de douleur côté membre (Phase 2 manquante)

Pour que les douleurs remontent : dans `src/components/cst/LiveSession.tsx`, ajouter bouton "🔴 Signaler une douleur" par exercice → drawer (zone, intensité 1-5, commentaire) → insert `pain_reports`.

## 6. Notifications coach

- Composant `<NotificationBell />` dans le header coach
- Channel Realtime global au layout coach : écoute `pain_reports` (INSERT), `technique_videos` (INSERT), `sessions` (UPDATE status=completed), `messages` (INSERT to_id=coach), `exercise_feedbacks` (INSERT rpe≥9)
- Toast immédiat + badge compteur
- Centre déroulant : 20 dernières notifs, persistées en localStorage (lu/non lu)

## 7. Server functions

`src/lib/coach-dashboard.functions.ts` (avec `requireSupabaseAuth` + check role coach) :
- `getDashboardMetrics()` → 4 KPIs
- `getPriorityFeed()` → liste typée (pain | high_rpe | video | message | skipped)
- `getRecentSessions(limit=10)` → sessions enrichies (membre, RPE moyen, douleur ?)
- `getMembersOverview()` → ligne par coaché avec état dérivé
- `getSessionDetail(sessionId)` → session + program block + set_logs + feedbacks + pain_reports
- `getMemberFollowup(memberId)` → KPIs 30j, séries adhérence, séries RPE, exos à surveiller, douleurs
- `getExerciseProgression(memberId, exerciseName)` → points {date, max_weight, avg_rpe, reps}
- `markSessionSeen(sessionId)`, `resolvePainReport(id)`

## 8. Fichiers à créer / modifier

**Créer**
- migration SQL (pain_reports + coach_seen + realtime)
- `src/lib/coach-dashboard.functions.ts`
- `src/lib/pain-reports.functions.ts`
- `src/pages/coach/SessionDetail.tsx`
- `src/routes/_authenticated.coach.seance.$sessionId.tsx`
- `src/components/coach/PriorityFeed.tsx`
- `src/components/coach/RecentSessionsList.tsx`
- `src/components/coach/MembersTable.tsx`
- `src/components/coach/NotificationBell.tsx`
- `src/components/coach/MemberFollowup.tsx`
- `src/components/coach/ExerciseProgressChart.tsx`
- `src/components/cst/PainReportDialog.tsx`

**Modifier**
- `src/pages/coach/Dashboard.jsx` → refonte complète
- `src/pages/coach/Member.jsx` → onglet SUIVI + Progression
- `src/components/cst/LiveSession.tsx` → bouton signaler douleur

## 9. Réalisation en 3 lots (proposition)

Pour livrer testable rapidement :

- **Lot A** (fondations) : migration BDD + server functions + `PainReportDialog` dans LiveSession.
- **Lot B** (dashboard) : refonte Dashboard + nouvelle route détail séance + Realtime séances récentes.
- **Lot C** (suivi + notifs) : onglet SUIVI enrichi, progression par exo, NotificationBell.

## Question pour vous

Souhaitez-vous que je livre **les 3 lots d'un coup**, ou **lot par lot** avec validation entre chaque (recommandé vu l'ampleur) ?
