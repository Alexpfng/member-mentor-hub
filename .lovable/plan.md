
# Séance interactive guidée pour le coaché

Aujourd'hui la page séance affiche toute la séance comme une longue liste de blocs statiques (`ProgramBlocks`). On va la transformer en parcours pas-à-pas, "un écran = une action", avec chrono automatique, repères de couleur/tempo/RPE/EMOM/superset, exactement dans la logique des Excel de Léo.

## 1. Nouveau composant `LiveSession` (mode guidé)

Fichier : `src/components/cst/LiveSession.tsx`

Une seule "scène" active à la fois, machine d'états :

```text
INTRO ─► EXERCISE_BRIEF ─► SET_ACTIVE ─► SET_LOGGING ─► REST
   ▲                                                       │
   └───────────  next set / next exo / next block  ────────┘
                              │
                              └──► SESSION_RECAP (fin)
```

- **INTRO** : nom de la séance, nombre d'exos, durée estimée, rappel code couleur (4 pastilles cliquables), bouton **COMMENCER**.
- **EXERCISE_BRIEF** (1 écran par exo, ou par bloc superset/EMOM) :
  - Pastille couleur géante + libellé court ("Mouvement clé – garde 1 rép de réserve" / "Isolation – tu peux aller à l'échec" / etc.)
  - Code lettre (A, B1+B2, …) avec mini-explication si superset / EMOM / ladder
  - Vignette vidéo démo (YouTube) en grand
  - Format : `4×6-10 @ RPE 8 · Tempo 3010 · Récup 2'30`
  - Bouton tempo qui ouvre l'explication "3-0-1-0"
  - Coach notes si présentes
  - Bouton **JE COMMENCE**
- **SET_ACTIVE** : grand compteur de série "SÉRIE 2 / 4", rappel charge/reps/tempo, bouton **SÉRIE TERMINÉE**. Pour un superset B1+B2, on enchaîne B1 série 1 → B2 série 1 → repos → B1 série 2…
- **SET_LOGGING** : saisie poids + reps + RPE (sélecteur 6-10, déjà existant), micro-feedback contextuel selon couleur ("RPE 6 sur du rouge → tu peux charger plus la prochaine fois"), bouton ✓.
- **REST** : `RestTimer` plein écran (déjà existant), durée par défaut selon couleur (rouge 180s, vert 90s, bleu 120s), surchargée par `recup` de l'exo si défini. Notification sonore/vibration à la fin, ±15s, skip. Pendant le repos, on affiche l'aperçu de la **prochaine série**.
- **EMOM** : remplace SET_ACTIVE + REST par un chrono "minute par minute" qui décompte et vibre à chaque top, avec le nb de reps attendu par minute (gère ladder 1/2/3).
- **SESSION_RECAP** : volume total, RPE moyen, durée, exercices loggés, bouton **TERMINER LA SÉANCE** (réutilise `finishSession` existant).

Barre de progression fine en haut : `■■■■□□□□□□` série courante / total séries de la séance, + "Exo 3/8".

## 2. Données : transformer le programme en "steps"

Helper `buildSteps(exercises)` dans `src/components/cst/LiveSession.tsx` :
- Regroupe par lettre (réutiliser `groupBlocks` existant de `ProgramBlocks.tsx`).
- Génère une liste de steps : pour un bloc standard `[BRIEF, SET×n alternés avec REST]`, pour un superset `[BRIEF, (B1.s1 → B2.s1 → REST) × n]`, pour un EMOM `[BRIEF, EMOM_RUN]`.
- Repos par défaut : parse `ex.recup` ("2'30", "90s", "2 min"). Fallback couleur.

## 3. Indications pédagogiques (depuis l'Excel partagé)

Centralisées dans `src/components/cst/pedagogy.tsx` (déjà existant, à enrichir) :
- `colorMeaning(color)` : phrases courtes du code couleur (rouge / vert / jaune / bleu) reprises mot pour mot de l'Excel.
- `tempoExplain(tempo, startsAtTop)` : déjà là.
- `rpeFeedbackMessage(color, rpe, isLastSet)` : déjà là, on l'utilise sur l'écran SET_LOGGING et sur le RECAP.
- Nouveau `blockExplain(type)` : EMOM, ladder, superset, AMRAP, dropset (1-2 phrases chacune).

## 4. Page séance

`src/routes/_authenticated.membre.seance.$sessionId.tsx` :
- Garde le chargement session + program + exercises.
- Remplace `<ProgramBlocks …>` + bouton "Terminer" par `<LiveSession exercises={exercises} sessionId={…} userId={…} session={…} onFinish={finishSession} />`.
- La saisie de set continue d'écrire dans `set_logs` (logique déjà dans `validateSet` de `ExerciseBlock`, on la déplace dans `LiveSession`).
- L'`ExerciseThread` (vidéo + commentaires) reste accessible : bouton "💬 Échanger avec le coach" sur l'écran EXERCISE_BRIEF et sur le RECAP de l'exo, qui ouvre un panneau coulissant utilisant le composant existant.

## 5. Mode "tout voir" optionnel

Petit lien discret "VOIR TOUT LE PROGRAMME" dans l'INTRO et le menu (icône ☰ en haut à droite) qui réaffiche la vue actuelle `ProgramBlocks` en lecture seule, pour les membres qui veulent jeter un œil global. Aucune logique de log dedans.

## Hors scope

- Côté coach builder : aucun changement (l'Excel et le builder produisent déjà les bons champs `color`, `tempo`, `recup`, `block_type`, `code`).
- Pas de notifications push, pas de Bluetooth cardio, pas de musique.
- Pas de refonte du schéma DB.

## Fichiers touchés

- **Créé** : `src/components/cst/LiveSession.tsx`
- **Modifié** : `src/routes/_authenticated.membre.seance.$sessionId.tsx`, `src/components/cst/pedagogy.tsx` (textes code couleur + `blockExplain`)
- **Inchangé / réutilisé** : `RestTimer`, `RPESelector`, `TempoBadge/Explainer`, `ColorDot/Tooltip`, `ExerciseThread`, `ProgramBlocks` (mode aperçu)
