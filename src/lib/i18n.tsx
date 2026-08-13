/* ColosmartTraining — i18n léger (FR par défaut, EN optionnel côté coaché)
 *
 * L'app est écrite en français. Pour la cliente anglophone, on ne réécrit pas tout :
 * un petit moteur traduit à la volée les chaînes de l'espace membre. La CLÉ de
 * traduction EST la chaîne française source → fallback naturel : une chaîne non encore
 * traduite reste affichée en français, sans casse. On enrichit `EN` écran par écran.
 *
 * Choix de langue : sélecteur dans les Réglages, persisté en localStorage (comme le
 * thème). Pas de colonne DB : le choix suit le navigateur de la personne, ce qui suffit
 * pour ce besoin.
 *
 * SSR : on rend FR au premier paint (serveur + hydratation), puis on bascule vers la
 * langue stockée après montage → pas de mismatch d'hydratation (léger flash FR→EN accepté).
 */
import { createContext, useCallback, useContext, useEffect, useState } from "react";

export type Locale = "fr" | "en";

const STORAGE_KEY = "cst-locale";

// Dictionnaire FR → EN. On complète au fur et à mesure des écrans traduits.
// Une clé absente = on garde le français (fallback). Espace membre uniquement.
const EN: Record<string, string> = {
  // — Navigation membre —
  Accueil: "Home",
  Programme: "Program",
  Planning: "Schedule",
  Carnet: "Logbook",
  Progrès: "Progress",
  Messages: "Messages",
  Réglages: "Settings",

  // — Réglages / Profil —
  Langue: "Language",
  "Choisis la langue de l'application.": "Choose the app language.",
  "← Retour": "← Back",
  RÉGLAGES: "SETTINGS",
  "HUB COACHÉ": "MEMBER HUB",
  "Tous tes réglages au même endroit": "All your settings in one place",
  "Retrouve ici tout ce que tu peux modifier en tant que coaché.":
    "Everything you can adjust as a member lives here.",
  "Début de ma semaine": "My week starts on",
  "Choisis le jour qui doit lancer ton cycle hebdomadaire de 7 jours.":
    "Pick the day that starts your 7-day weekly cycle.",
  "Semaine perso :": "Custom week:",
  PLANNING: "SCHEDULE",
  CONNEXIONS: "CONNECTIONS",
  COMPTE: "ACCOUNT",
  "Semaine perso mise à jour": "Custom week updated",
  "Mise à jour impossible": "Update failed",
  "Chargement…": "Loading…",
  // Rappels / notifications
  "Rappel jour de séance planifié": "Reminder on scheduled workout days",
  "Rappel hebdo pour noter ton poids": "Weekly reminder to log your weight",
  "Carnet de bord prêt": "Logbook ready",
  "Nouveau record personnel": "New personal record",
  "Nouvelle semaine publiée par le coach": "New week published by your coach",
  "Messages du coach": "Coach messages",
  "Encouragements sur ta série de régularité": "Encouragement for your consistency streak",
  "Quand recevoir le rappel poids ?": "When should the weight reminder arrive?",
  // Jours (abréviations)
  DIM: "SUN",
  LUN: "MON",
  MAR: "TUE",
  MER: "WED",
  JEU: "THU",
  VEN: "FRI",
  SAM: "SAT",
  // Connexions / Strava
  "Compte Strava connecté": "Strava account connected",
  "Aucun compte Strava connecté": "No Strava account connected",
  "Tes courses du jour pourront être rattachées automatiquement à ta séance course.":
    "Your runs can be attached automatically to your running session.",
  "Connecte Strava pour faire remonter automatiquement tes sorties course dans l'app.":
    "Connect Strava to automatically pull your runs into the app.",
  "Athlète Strava :": "Strava athlete:",
  "Dernière synchro :": "Last sync:",
  "Expiration token :": "Token expiry:",
  "Connexion...": "Connecting...",
  "Connecter Strava": "Connect Strava",
  "Déconnexion...": "Disconnecting...",
  "Déconnecter Strava": "Disconnect Strava",
  "Connexion Strava impossible": "Could not connect to Strava",
  "Déconnexion Strava impossible": "Could not disconnect from Strava",
  "Strava déconnecté": "Strava disconnected",
  // Compte
  "Gestion du compte": "Account management",
  "Retrouve ici les actions liées à ton espace personnel.":
    "Actions related to your personal space live here.",
  "Se déconnecter": "Log out",
  Erreur: "Error",

  // — Tableau de bord (accueil membre) —
  "Aucun programme": "No program",
  "CHARGEMENT…": "LOADING…",
  "L'ESPACE · MEMBRE": "MEMBER · SPACE",
  Bibliothèque: "Library",
  MEMBRE: "MEMBER",
  DÉCONNEXION: "LOG OUT",
  "BON MATIN,": "GOOD MORNING,",
  "BONNE APRÈS-MIDI,": "GOOD AFTERNOON,",
  "BONNE SOIRÉE,": "GOOD EVENING,",
  SEM: "WK",
  "PLANNING · NOTIFS · STRAVA": "SCHEDULE · NOTIFS · STRAVA",
  "⏱ SÉANCE EN COURS": "⏱ WORKOUT IN PROGRESS",
  "SÉANCE LIBRE": "FREE SESSION",
  "REPRENDRE →": "RESUME →",
  "✓ SÉANCE DU JOUR TERMINÉE": "✓ TODAY'S WORKOUT DONE",
  "Durée non enregistrée": "Duration not recorded",
  "★ AUJOURD'HUI · PLANIFIÉ": "★ TODAY · PLANNED",
  "COMMENCER →": "START →",
  CHANGER: "CHANGE",
  "AUTRES SÉANCES DE LA SEMAINE": "OTHER WORKOUTS THIS WEEK",
  "★ CHOISIR MA SÉANCE": "★ CHOOSE MY WORKOUT",
  "QUE FAIS-TU AUJOURD'HUI ?": "WHAT ARE YOU DOING TODAY?",
  "★ AUJOURD'HUI": "★ TODAY",
  "CRÉER MA SÉANCE →": "CREATE MY WORKOUT →",
  "VOIR LES RETOURS DE LÉO": "SEE LÉO'S FEEDBACK",
  "séance commentée": "reviewed session",
  "séances commentées": "reviewed sessions",
  NOUVEAU: "NEW",
  NOUVEAUX: "NEW",
  "CHOISIR UNE AUTRE SÉANCE →": "CHOOSE ANOTHER WORKOUT →",
  "✏️ CRÉER MA SÉANCE →": "✏️ CREATE MY WORKOUT →",
  "📚 BIBLIOTHÈQUE D'EXERCICES →": "📚 EXERCISE LIBRARY →",
  "MA SEMAINE": "MY WEEK",
  SÉANCES: "WORKOUTS",
  "séances ce jour": "workouts that day",
  "ADHÉRENCE · SEMAINE": "ADHERENCE · WEEK",
  "DERNIER PR": "LAST PR",
  "Aucun PR encore": "No PR yet",
  "POIDS DU CORPS": "BODY WEIGHT",
  "Pas encore noté": "Not logged yet",
  "+ NOTER": "+ LOG",
  "ACTIVITÉ DU JOUR": "TODAY'S ACTIVITY",
  PAS: "STEPS",
  "💬 MESSAGE COACH": "💬 COACH MESSAGE",
  COMMUNAUTÉ: "COMMUNITY",
  "Vois ce que font les autres coachés, et envoie-leur un cololike":
    "See what other members are up to, and send them a cololike",
  "MON PROGRAMME →": "MY PROGRAM →",
  "MON CARNET →": "MY LOGBOOK →",
  "PLANNING →": "SCHEDULE →",
  "HISTORIQUE →": "HISTORY →",

  // — Planning membre —
  Dimanche: "Sunday",
  Lundi: "Monday",
  Mardi: "Tuesday",
  Mercredi: "Wednesday",
  Jeudi: "Thursday",
  Vendredi: "Friday",
  Samedi: "Saturday",
  Retour: "Back",
  "MON PLANNING": "MY SCHEDULE",
  "← Sem. préc.": "← Prev. week",
  Semaine: "Week",
  "Suivante →": "Next →",
  "À PLANIFIER · Tape une séance pour la placer (ou glisse-la sur un jour)":
    "TO SCHEDULE · Tap a workout to place it (or drag it onto a day)",
  Séance: "Session",
  " · en cours": " · in progress",
  Indispo: "Unavailable",
  "Aucune séance prévue cette semaine.": "No workout planned this week.",
  "Depuis mon programme": "From my program",
  "Toutes mes séances programme": "All my program workouts",
  Autre: "Other",
  "✦ Séance libre hors programme": "✦ Free session (off-program)",
  "— Marquer comme repos": "— Mark as rest",
  Annuler: "Cancel",
  "Placer :": "Place:",
  "Choisis un jour": "Choose a day",
  "Déplacer :": "Move:",
  "Choisis un nouveau jour": "Choose a new day",
  "Séance commencée, pas terminée": "Session started, not finished",
  "▶ Reprendre là où j'en étais": "▶ Resume where I left off",
  "↩︎ Annuler cette séance et la replanifier": "↩︎ Cancel this session and reschedule it",
  Fermer: "Close",
  "▶ Démarrer maintenant": "▶ Start now",
  "▶ Démarrer en avance": "▶ Start early",
  "📅 Déplacer à un autre jour": "📅 Move to another day",
  "Supprimer du planning": "Remove from schedule",
  "— Remplacer par repos": "— Replace with rest",
  "Séance annulée — tu peux la replanifier": "Session cancelled — you can reschedule it",
  " · actuel": " · current",
  " · indisponible": " · unavailable",
  " · occupé": " · busy",
  " · aujourd'hui": " · today",

  // — Programme membre —
  "MON PROGRAMME": "MY PROGRAM",
  "AUCUN PROGRAMME": "NO PROGRAM",
  "Ton coach ne t'a pas encore assigné de programme. Reviens plus tard.":
    "Your coach hasn't assigned you a program yet. Check back later.",
  PROGRAMME: "PROGRAM",
  SEMAINES: "WEEKS",
  "DÉMARRÉ LE": "STARTED ON",
  "SEMAINE PERSO :": "CUSTOM WEEK:",
  "PROGRESSION GLOBALE": "OVERALL PROGRESS",
  "📅 PLANIFIER MA SEMAINE →": "📅 PLAN MY WEEK →",
  SEMAINE: "WEEK",
  "· EN COURS": "· IN PROGRESS",
  SÉANCE: "WORKOUT",
  "DÉMARRER →": "START →",
  RÉCUPÉRATION: "RECOVERY",
  "Aucune séance.": "No workout.",
  "Le programme est encore vide.": "The program is still empty.",

  // — Séance / logger (libellés visibles) —
  "TECHNIQUE & ÉCHANGES COACH": "TECHNIQUE & COACH FEEDBACK",
  Toi: "You",
  "Écris à Léo…": "Message Léo…",
  ENVOYER: "SEND",
  "À FAIRE": "TO DO",
  "EN COURS": "IN PROGRESS",
  FAIT: "DONE",
  QUITTER: "QUIT",
  "TERMINER LA SÉANCE ✓": "FINISH WORKOUT ✓",
  "ENREGISTREMENT…": "SAVING…",
  "RÉINITIALISATION…": "RESETTING…",
  "SKIP LE REPOS →": "SKIP REST →",
  "ON Y RETOURNE →": "BACK TO IT →",
  "REPS RÉALISÉES": "REPS DONE",
  REPS: "REPS",
  "RPE MOY": "AVG RPE",
  "RPE —": "RPE —",
  VOLUME: "VOLUME",
  DURÉE: "DURATION",
  "RÉSUMÉ DE SÉANCE": "WORKOUT SUMMARY",
  RÉSUMÉ: "SUMMARY",
  "PROGRAMME COMPLET": "FULL PROGRAM",
  "Voir toute la séance": "See the whole workout",
  "Voir le résumé de séance": "See workout summary",
  "Voir la démo sur YouTube": "Watch the demo on YouTube",
  "Aperçu vidéo": "Video preview",
  "Choisis ton RPE perçu pour valider la série.": "Pick your perceived RPE to confirm the set.",
  "Indique au moins le nombre de reps pour valider cette série.":
    "Enter at least the number of reps to confirm this set.",
  "Impossible de terminer la séance. Vérifie ta connexion et réessaie.":
    "Couldn't finish the workout. Check your connection and try again.",
  "Enregistrement en attente — vérifie ta connexion.": "Save pending — check your connection.",
  "Pré-remplissage historique indisponible": "History pre-fill unavailable",
  "Superset : enchaîne les deux exercices sans repos, puis prends la récup commune.":
    "Superset: do both exercises back to back with no rest, then take the shared recovery.",
  "Circuit : enchaîne tous les exos du bloc, puis prends la récup et recommence.":
    "Circuit: do all the block's exercises in a row, then take the recovery and repeat.",
  TRAVAIL: "WORK",
  TRANSITION: "TRANSITION",
  TOUR: "ROUND",
  CÔTÉ: "SIDE",
  BRAS: "ARM",
  JAMBE: "LEG",
  PIED: "FOOT",
  Force: "Strength",
  Explosif: "Explosive",
  Isolation: "Isolation",
  Mobilité: "Mobility",
  Prévention: "Prevention",
  "★ TERMINÉ": "★ DONE",
  "BIEN JOUÉ.": "WELL DONE.",
  "Tes données sont envoyées au coach.": "Your data has been sent to the coach.",
  "ERREUR / JE CONSULTE LE PROGRAMME": "ERROR / VIEW THE PROGRAM",
  "EXERCICES RÉELLEMENT FAITS · RENSEIGNE LE RPE FINAL":
    "EXERCISES ACTUALLY DONE · ENTER THE FINAL RPE",
  "DURÉE (s)": "DURATION (s)",
  "→ REPOS": "→ REST",
  "— REPOS": "— REST",
  "📋 CONSIGNES": "📋 CUES",
  "APRÈS LE REPOS": "AFTER THE REST",
  SÉRIE: "SET",
  "SÉRIES ": "SETS ",
  "✓ SÉANCE TERMINÉE": "✓ WORKOUT DONE",
  "✓ CHRONO TERMINÉ — LOGGER LE RPE": "✓ TIMER DONE — LOG THE RPE",
  "✓ SÉRIE TERMINÉE — LOGGER": "✓ SET DONE — LOG",
  VALIDER: "CONFIRM",
  "→ EXO SUIVANT": "→ NEXT EXERCISE",
  "→ SUIVANT": "→ NEXT",
  "Aucune étape.": "No step.",
  "REPS ": "REPS ",
  "CHARGE ": "LOAD ",
  "RÉCUP ": "REST ",
  "RPE CIBLE ": "TARGET RPE ",
  PRÊT: "READY",

  // — Progression membre —
  Taille: "Waist",
  Hanches: "Hips",
  Poitrine: "Chest",
  Bras: "Arm",
  Cuisse: "Thigh",
  "Renseigne au moins une mesure.": "Enter at least one measurement.",
  "Enregistrement impossible. Réessaie.": "Couldn't save. Try again.",
  "Mensuration enregistrée ✓": "Measurement saved ✓",
  "Envoi de la photo impossible. Réessaie.": "Couldn't upload the photo. Try again.",
  "La photo n'a pas pu être enregistrée.": "The photo could not be saved.",
  "Photo ajoutée ✓": "Photo added ✓",
  "Suppression impossible. Réessaie.": "Couldn't delete. Try again.",
  "Photo supprimée": "Photo deleted",
  "Retour à l'accueil": "Back to home",
  PROGRESSION: "PROGRESS",
  "MA PROGRESSION": "MY PROGRESS",
  DEVANT: "AHEAD",
  "moi.": "of me.",
  "STATS GLOBALES": "OVERALL STATS",
  RECORDS: "RECORDS",
  POIDS: "WEIGHT",
  TROPHÉES: "TROPHIES",
  DÉCROCHÉS: "EARNED",
  "PROFIL DE MOUVEMENT": "MOVEMENT PROFILE",
  "Familles de mouvement": "Movement families",
  "8 SEMAINES": "8 WEEKS",
  "PROGRESSION EXERCICE": "EXERCISE PROGRESS",
  EXERCICE: "EXERCISE",
  "Poids (kg)": "Weight (kg)",
  "Pas encore de données.": "No data yet.",
  "RECORDS PERSONNELS": "PERSONAL RECORDS",
  "SUIVI CORPOREL": "BODY TRACKING",
  "MENSURATIONS (CM)": "MEASUREMENTS (CM)",
  "Note (optionnel)": "Note (optional)",
  "ENREGISTRER MES MENSURATIONS": "SAVE MY MEASUREMENTS",
  "PHOTOS D'ÉVOLUTION": "PROGRESS PHOTOS",
  "PRIVÉ · VISIBLE PAR TON COACH": "PRIVATE · VISIBLE TO YOUR COACH",
  "ENVOI…": "UPLOADING…",
  "📷 AJOUTER UNE PHOTO": "📷 ADD A PHOTO",
  Supprimer: "Delete",
  "Aucune photo pour l'instant.": "No photos yet.",
  "PAS ENCORE DE DONNÉES": "NO DATA YET",
  "Termine ta première séance pour voir ta progression ici.":
    "Finish your first workout to see your progress here.",
  "Supprimer cette photo ?": "Delete this photo?",
  "Cette action est définitive.": "This action is permanent.",

  " : Min 1→3 reps, Min 2→4, Min 3→5, puis on redescend — Min 4→4, Min 5→3, Min 6→4… La pyramide tourne jusqu'à la fin du bloc. Densifie la séance avec une meilleure qualité.":
    ": Min 1→3 reps, Min 2→4, Min 3→5, then back down — Min 4→4, Min 5→3, Min 6→4… The pyramid keeps cycling until the end of the block. Packs more quality into the session.",
  " : vise ": ": aim for ",
  " (ex: 80-70kg) : commence par la charge haute. Si trop dur → descends. Si elle passe → reste dessus.":
    " range (e.g. 80-70kg): start with the high load. If it's too hard → go down. If it moves → stay there.",
  " = EXPLOSIF : phase aussi rapide que possible.": " = EXPLOSIVE: phase as fast as possible.",
  " après chaque exercice.": " after each exercise.",
  " autour d'elle.": " around it.",
  " dès la première série. Si ton énergie baisse → descends à 9, puis 8.":
    " right from the first set. If your energy drops → go down to 9, then 8.",
  " entre eux. La récup ne s'effectue ": " between them. Recovery happens ",
  " le 2e exercice. Puis tu répètes le cycle pour chaque série.":
    " the 2nd exercise. Then repeat the cycle for each set.",
  " Pousse activement dans CHAQUE direction. La résistance vient de toi-même.":
    " Actively push in EVERY direction. The resistance comes from you.",
  "— FOURCHETTE DE REPS": "— REP RANGE",
  "— PLACEMENT DU BASSIN": "— PELVIS POSITION",
  "— TRAIL & RUN · PLANIFICATION": "— TRAIL & RUN · PLANNING",
  ", fesses serrées, abdos engagés, bas du dos plaqué. ":
    ", glutes squeezed, abs engaged, lower back flat. ",
  "« Bienvenue": "« Welcome",
  "← RETOUR": "← BACK",
  "↑↓ PROFIL ALTIMÉTRIQUE": "↑↓ ELEVATION PROFILE",
  "↖ CLIQUE SUR LA CARTE": "↖ CLICK ON THE MAP",
  "+ IMPORTER UN FICHIER": "+ IMPORT A FILE",
  "+ SÉRIE": "+ SET",
  "≈ 2 MIN · 4 ÉTAPES": "≈ 2 MIN · 4 STEPS",
  "▶ Rejouer": "▶ Replay",
  "◎ PARCOURS": "◎ ROUTES",
  "⚠ À SURVEILLER": "⚠ TO WATCH",
  "⚠️ Échec sur un mouvement de force. Réduis la charge la semaine prochaine — garde 1-2 reps en réserve.":
    "⚠️ Failure on a strength movement. Drop the load next week — keep 1-2 reps in reserve.",
  "⚠️ Sur les explosifs, la qualité prime. Réduis les reps pour maintenir la vitesse d'exécution.":
    "⚠️ On explosive work, quality comes first. Cut the reps to keep your execution speed.",
  "✅ RÉTROVERSION — à rechercher": "✅ POSTERIOR TILT — aim for this",
  "✎ CRÉER": "✎ CREATE",
  "✓ COURSE ENREGISTRÉE": "✓ RUN SAVED",
  "✓ ENREGISTRÉ !": "✓ SAVED!",
  "✓ LIEN GPX :": "✓ GPX LINK:",
  "✓ VALIDER LA TRACE": "✓ SAVE ROUTE",
  "✕ EFFACER LA TRACE": "✕ CLEAR ROUTE",
  "✕ SUPPRIMER": "✕ DELETE",
  "❌ ANTÉVERSION — à éviter": "❌ ANTERIOR TILT — avoid",
  "⟳ CHARGEMENT…": "⟳ LOADING…",
  "⟳ ENREG…": "⟳ SAVING…",
  "⟳ ENVOI…": "⟳ SENDING…",
  "⟳ ROUTAGE EN COURS…": "⟳ ROUTING…",
  "⟳ SUPPRESSION…": "⟳ DELETING…",
  "🏃 SÉANCE COURSE": "🏃 RUN SESSION",
  "💡 Note le RPE ": "💡 Log your RPE ",
  "💡 Si ton RPE remonte vs la semaine dernière pour la même charge → n'augmente pas. Le corps est plus fatigué.":
    "💡 If your RPE goes up vs last week for the same load → don't add weight. Your body is more fatigued.",
  "💡 Sur la prévention, vise un RPE plus bas (3-5). Contrôle, pas fatigue.":
    "💡 On prevention work, aim for a lower RPE (3-5). Control, not fatigue.",
  "💡 Sur les exercices d'isolation, approche-toi de l'échec sur ta dernière série. Tu as encore de la marge.":
    "💡 On isolation exercises, get close to failure on your last set. You've still got room to spare.",
  "💬 Léo va analyser ta course et te laisser un retour perso. Tu le retrouveras sur ta séance.":
    "💬 Léo will analyze your run and leave you personal feedback. You'll find it on your session.",
  "💬 MOT DE LÉO": "💬 A WORD FROM LÉO",
  "📷 PHOTOS / 🎥 VIDÉOS": "📷 PHOTOS / 🎥 VIDEOS",
  "🔍 Rechercher un exercice…": "🔍 Search for an exercise…",
  "🔴 Force : 1-2 reps en réserve — vise RPE 7-8":
    "🔴 Strength: 1-2 reps in reserve — aim for RPE 7-8",
  "🔵 Prévention : contrôle total — pas de fatigue excessive":
    "🔵 Prevention: total control — no excessive fatigue",
  "🟡 Explosif : qualité > quantité — jamais d'échec":
    "🟡 Explosive: quality > quantity — never to failure",
  "🟢 Isolation : 1 rep en réserve max — approche l'échec":
    "🟢 Isolation: 1 rep in reserve max — get close to failure",
  "🟢 Mobilité : amplitude max contrôlée — RPE 3-5, jamais de douleur":
    "🟢 Mobility: max controlled range — RPE 3-5, never any pain",
  "0–1 an": "0–1 yr",
  "1 rep possible. Très dur.": "1 rep possible. Very hard.",
  "1–3 ans": "1–3 yrs",
  "2 reps possibles. Zone force 🔴": "2 reps possible. Strength zone 🔴",
  "3 reps possibles. Modéré — progression.": "3 reps possible. Moderate — progression.",
  "3+ ans": "3+ yrs",
  "4 reps possibles. Confortable.": "4 reps possible. Comfortable.",
  "5 reps possibles. Facile.": "5 reps possible. Easy.",
  "Activité enregistrée 👟": "Activity saved 👟",
  "Ajoute des points de passage. Le tracé suit les chemins réels grâce au routage automatique.":
    "Add waypoints. The route follows real paths thanks to automatic routing.",
  "AJOUTER DEPUIS LA BIBLIOTHÈQUE": "ADD FROM LIBRARY",
  "Allure (/km)": "Pace (/km)",
  "Amplitude et contrôle articulaire": "Range of motion and joint control",
  "Antéversion vs Rétroversion": "Anterior vs Posterior tilt",
  "Approche l'échec en fin de série": "Get close to failure at the end of the set",
  ARRIVÉE: "FINISH",
  au: "to",
  "Au début de chaque minute, tu fais les reps. Le reste de la minute = ta récupération.":
    "At the start of each minute, you do the reps. The rest of the minute = your recovery.",
  "Aucun exercice pour l'instant. Ajoute-en depuis la bibliothèque ci-dessous.":
    "No exercises yet. Add some from the library below.",
  "Aucun exercice trouvé.": "No exercises found.",
  "AUCUN RETOUR": "NO FEEDBACK",
  "aujourd'hui": "today",
  Autres: "Others",
  AVANCÉ: "ADVANCED",
  "Bas du dos cambré, fesses qui ressortent, ventre en avant.":
    "Lower back arched, glutes sticking out, belly forward.",
  "basculé vers l'avant": "tilted forward",
  "Bassin ": "Pelvis ",
  "BEAU BOULOT 👏": "GREAT JOB 👏",
  BIENVENUE: "WELCOME",
  "BLESSURES · CONTRE-INDICATIONS": "INJURIES · CONTRAINDICATIONS",
  "Bonne semaine — la régularité paie sur la durée.": "Good week — consistency pays off over time.",
  "c'est": "that's",
  "Cadence d'exécution": "Execution tempo",
  Calories: "Calories",
  "Calories invalide": "Invalid calories",
  "Carnet de bord": "Logbook",
  "CARNET DE BORD": "LOGBOOK",
  "Cette semaine n'a pas été facile. La prochaine sera la bonne 🙌":
    "This week wasn't easy. The next one will be the good one 🙌",
  "CETTE SEMAINE, TU AS…": "THIS WEEK, YOU…",
  charge: "load",
  "Charge, reps, RPE — tout est tracé sans friction.":
    "Load, reps, RPE — everything tracked, friction-free.",
  "Cherche l'amplitude maximale contrôlée. Mouvements lents, sans à-coups, respiration ample. Jamais de douleur.":
    "Seek the maximum controlled range of motion. Slow, smooth movements, deep breathing. Never any pain.",
  "Code couleur": "Color code",
  "Colonne neutre, protégée.": "Neutral, protected spine.",
  "COMMENCER MA SÉANCE": "START MY WORKOUT",
  "Compris ✓": "Got it ✓",
  "Concentre-toi sur le temps de contact au sol et l'intention. Saute haut, réagis vite. JAMAIS d'échec.":
    "Focus on ground contact time and intention. Jump high, react fast. NEVER to failure.",
  Confirmer: "Confirm",
  "Construis un corps fort, peu importe où tu te trouves.":
    "Build a strong body, no matter where you are.",
  CONSULTE: "VIEW",
  "Consulte ton programme, puis reviens ici après ta course pour enregistrer tes stats.":
    "Check your program, then come back here after your run to log your stats.",
  "CONTINUER →": "CONTINUE →",
  COPIER: "COPY",
  "CRÉATION…": "CREATING…",
  "CRÉER MA": "CREATE MY",
  "CRÉER UNE TRACE": "CREATE A ROUTE",
  'Cue mental : "serre les fesses + tire le nombril vers la colonne". S\'applique aux gainages, hollow hold, Nordic curls, hip thrust, RDL, bird dog, dead bug.':
    'Mental cue: "squeeze your glutes + pull your navel toward your spine". Applies to planks, hollow hold, Nordic curls, hip thrust, RDL, bird dog, dead bug.',
  "d'entraînement": "of training",
  "dans l'équipage.": "to the crew.",
  Date: "Date",
  "de plus que zéro. On continue.": "more than zero. Keep going.",
  "de ton coach.": "from your coach.",
  DÉBUTANT: "BEGINNER",
  "Décoché, personne ne voit ton activité — tu continues de voir la tienne et celle des membres qui partagent.":
    "Unchecked, no one sees your activity — you still see yours and that of members who share.",
  "Décris ce qui pourrait limiter l'entraînement…":
    "Describe anything that could limit your training…",
  "DÉFI EN COURS": "ONGOING CHALLENGE",
  "Dénivelé +": "Elevation +",
  "Dénivelé −": "Elevation −",
  "Dénivelé D+ (m)": "Elevation gain (m)",
  DÉPART: "START",
  Descendre: "Move down",
  "DESCENTE (excentrique)": "LOWERING (eccentric)",
  DIFFICILE: "HARD",
  Difficulté: "Difficulty",
  "Difficulté :": "Difficulty:",
  Distance: "Distance",
  DISTANCE: "DISTANCE",
  "Distance :": "Distance:",
  "Distance (km)": "Distance (km)",
  Du: "From",
  "Durée (min)": "Duration (min)",
  "Échec total. Impossible 1 rep de plus.": "Total failure. Impossible to do 1 more rep.",
  "Échelle RPE": "RPE Scale",
  "en place.": "in place.",
  "Enchaîne les 2 exercices": "Chain the 2 exercises",
  Endurance: "Endurance",
  ENDURANCE: "ENDURANCE",
  "Enregistrement…": "Saving…",
  "Enregistrer ✓": "Save ✓",
  "ENTRE LES REPS": "BETWEEN REPS",
  "Envoi en cours…": "Uploading…",
  "Envoi impossible, réessaie.": "Couldn't send, try again.",
  "ENVOYER À LÉO ET TERMINER →": "SEND TO LÉO AND FINISH →",
  "Envoyer un cololike": "Send a cololike",
  "Erreur inconnue": "Unknown error",
  "Erreur lors de l'enregistrement.": "Error while saving.",
  ÉVOLUTION: "CHANGE",
  EXPERT: "EXPERT",
  "EXPLOSIF / PLYO": "EXPLOSIVE / PLYO",
  FACILE: "EASY",
  "FC moyenne (bpm)": "Avg HR (bpm)",
  "Forme, contrôle, mind-muscle": "Form, control, mind-muscle",
  "forte contraction musculaire": "strong muscular contraction",
  FRÉQUENCE: "FREQUENCY",
  "FRÉQUENCE / SEMAINE": "FREQUENCY / WEEK",
  "Garde 1 à 2 reps en réserve sur CHAQUE série. Approche-toi de l'échec sans jamais l'atteindre complètement.":
    "Keep 1 to 2 reps in reserve on EVERY set. Get close to failure without ever fully reaching it.",
  "Garde 1 rep en réserve max. Sur ta dernière série : presque l'échec.":
    "Keep 1 rep in reserve max. On your last set: almost to failure.",
  "GPX disponible — demande le lien à Léo sur l'app.":
    "GPX available — ask Léo for the link in the app.",
  hier: "yesterday",
  Hypertrophie: "Hypertrophy",
  HYPERTROPHIE: "HYPERTROPHY",
  immédiatement: "immediately",
  "Impossible de créer la séance. Réessaie.": "Couldn't create the workout. Try again.",
  "Impossible de supprimer cette trace.": "Unable to delete this route.",
  "Imprimé le": "Printed on",
  "Indique au moins tes pas ou tes calories.": "Enter at least your steps or your calories.",
  INTERMÉDIAIRE: "INTERMEDIATE",
  ISOLATION: "ISOLATION",
  J: "D",
  "J / SEM": "D / WK",
  "J RESTANTS": "DAYS LEFT",
  "J'AI FAIT MA COURSE — RAPPORTER →": "I DID MY RUN — REPORT →",
  "Je participe": "I'm in",
  JOURS: "DAYS",
  "KG / PDC": "KG / BW",
  "L'intention est la clé.": "Intention is key.",
  "La communauté n'est pas disponible :": "The community isn't available:",
  "Le cololike n'est pas passé": "Your cololike didn't go through",
  "LE FIL EST ENCORE VIDE": "THE FEED IS STILL EMPTY",
  "LE TERRAIN.": "THE BASICS.",
  "Léo en a été informé.": "Léo has been informed.",
  "LES RETOURS": "THE FEEDBACK",
  "Les séances et les records des membres qui partagent apparaîtront ici.":
    "Sessions and records from members who share will appear here.",
  libre: "free",
  libres: "free",
  LOGGE: "LOG",
  "MA SÉANCE": "MY WORKOUT",
  "Ma trace": "My route",
  "Min 1 → 10 reps (0:22) · repos 0:38": "Min 1 → 10 reps (0:22) · rest 0:38",
  "Min 2 → 10 reps (0:25) · repos 0:35": "Min 2 → 10 reps (0:25) · rest 0:35",
  "Minimal. Échauffement.": "Minimal. Warm-up.",
  MOBILITÉ: "MOBILITY",
  "Mobilité / prévention 🔵": "Mobility / prevention 🔵",
  "Mobilité + force": "Mobility + strength",
  "MONTÉE (concentrique)": "LIFT (concentric)",
  Monter: "Move up",
  "Mouvement circulaire LENT qui emmène l'articulation dans toute son amplitude avec une ":
    "A SLOW circular movement that takes the joint through its full range with a ",
  "MOUVEMENT DE FORCE": "STRENGTH MOVEMENT",
  NIVEAU: "LEVEL",
  "Nom de la trace…": "Route name…",
  "Nom de ma séance (optionnel)": "My workout name (optional)",
  "Non connecté.": "Not logged in.",
  "NOTE POUR LE COACH": "NOTE FOR COACH",
  objectif: "goal",
  OBJECTIF: "GOAL",
  "Objectif atteint. Bravo à tous.": "Goal reached. Well done, everyone.",
  "OBJECTIF PRINCIPAL": "MAIN GOAL",
  "On commence par le terrain.": "Let's start with the basics.",
  "On démarre. »": "Let's go. »",
  PALIER: "MILESTONE",
  "PARCOURS ENREGISTRÉS": "SAVED ROUTES",
  "Partager mes séances avec les autres membres": "Share my sessions with other members",
  participant: "participant",
  Pas: "Steps",
  "Pas encore de carnet — il sera généré à la fin de ta première semaine.":
    "No logbook yet — it will be generated at the end of your first week.",
  "Pas invalide": "Invalid steps",
  "PAUSE EN BAS": "PAUSE AT BOTTOM",
  "PAUSE EN HAUT": "PAUSE AT TOP",
  "PDC / kg": "BW / kg",
  "Photo du parcours, vidéo… Ouvre la galerie — pas de caméra en direct.":
    "Route photo, video… Open the gallery — no live camera.",
  "Pioche tes exercices dans la bibliothèque et fixe tes cibles, puis lance ta séance.":
    "Pick your exercises from the library and set your targets, then start your workout.",
  "PLAN DE COURSE": "RACE PLAN",
  "PLANS DE COURSE.": "RACE PLANS.",
  "Plus tu es rapide, plus tu récupères.": "The faster you are, the more you recover.",
  Poids: "Weight",
  "POIDS · KG": "WEIGHT · KG",
  "Poids enregistré 💪": "Weight logged 💪",
  "Poids invalide": "Invalid weight",
  "Poids invalide (30–250 kg).": "Invalid weight (30–250 kg).",
  Point: "Point",
  POINTS: "POINTS",
  "Pour ": "For ",
  "Pour une fourchette de ": "For a ",
  "POUSSÉE (concentrique)": "PUSH (concentric)",
  "PRÉNOM · NOM": "FIRST NAME · LAST NAME",
  "Presque pas d'effort.": "Almost no effort.",
  "Pression sur les lombaires.": "Pressure on the lower back.",
  "PRÊT À DÉMARRER": "READY TO START",
  "PRÉVENTION / GAINAGE": "PREVENTION / CORE",
  "Prévention de blessure et stabilité. Contrôle total. Pas de fatigue excessive.":
    "Injury prevention and stability. Total control. No excessive fatigue.",
  "Prévention des blessures": "Injury prevention",
  "Prise de force": "Strength",
  "PRISE DE FORCE": "STRENGTH",
  "PROCHAINS PALIERS": "NEXT MILESTONES",
  "Profil altimétrique": "Elevation profile",
  "PROFIL ALTIMÉTRIQUE": "ELEVATION PROFILE",
  "Profil ColosmarTraining · Léo Colognesi": "ColosmarTraining Profile · Léo Colognesi",
  "Profil enregistré ✓": "Profile saved ✓",
  "PROGRAMME DE LA SÉANCE": "SESSION PROGRAM",
  PROGRESSE: "PROGRESS",
  "QU'APRÈS": "ONLY AFTER",
  "Qualité avant quantité": "Quality over quantity",
  "QUI ES-TU ?": "WHO ARE YOU?",
  "Quitter le défi": "Leave the challenge",
  "RAPPORTE TA COURSE": "REPORT YOUR RUN",
  RECORD: "RECORD",
  "Renseigne ton prénom et ton nom.": "Enter your first and last name.",
  RESSENTI: "FEELING",
  Retirer: "Remove",
  "Retirer mon cololike": "Remove my cololike",
  "Retour au tableau de bord": "Back to dashboard",
  "RETOURS DE LÉO": "FEEDBACK FROM LÉO",
  "RETOURS DU COACH": "COACH FEEDBACK",
  "Risque d'imbalance — réserve obligatoire": "Imbalance risk — reps in reserve required",
  "RPE 3-5. La technique prime.": "RPE 3-5. Technique comes first.",
  "RPE 3-5. Priorité à l'amplitude, pas à la charge.":
    "RPE 3-5. Prioritize range of motion, not load.",
  "RPE 6-7. Réduis les reps si la vitesse baisse.": "RPE 6-7. Cut the reps if speed drops.",
  "RPE 7-8 sur les premières séries, max 9 sur la dernière.":
    "RPE 7-8 on the early sets, max 9 on the last one.",
  "RPE 8-9. Dernière série 9-10.": "RPE 8-9. Last set 9-10.",
  "RPE CIBLE": "TARGET RPE",
  "RPE GLOBAL": "OVERALL RPE",
  "RPE moyen": "average RPE",
  "SANS récupération": "WITH NO REST",
  "Santé articulaire": "Joint health",
  séance: "session",
  "Séance course": "Run session",
  séances: "sessions",
  "Sélectionne ton niveau.": "Select your level.",
  "Sélectionne ton objectif.": "Select your goal.",
  "Semaine parfaite ! Tu as tenu chaque rendez-vous 🔥":
    "Perfect week! You showed up every time 🔥",
  "Semaine précédente": "Previous week",
  "Semaine suivante": "Next week",
  "Sensation, terrain, ressenti génou…": "Sensation, terrain, knee feeling…",
  "STATS DEPUIS TA MONTRE": "STATS FROM YOUR WATCH",
  "Supprimer la trace": "Delete route",
  "TAILLE · CM": "HEIGHT · CM",
  "Taille invalide (120–230 cm).": "Invalid height (120–230 cm).",
  "Télécharger le GPX": "Download the GPX",
  "TERMINÉ →": "DONE →",
  "TES INFOS · PHYSIQUE": "YOUR INFO · PHYSICAL",
  "TES RECORDS DE LA SEMAINE 🏆": "YOUR RECORDS THIS WEEK 🏆",
  "Tes records, ton volume, ton adhérence — en clair.":
    "Your PRs, your volume, your consistency — crystal clear.",
  "Tes séances apparaissent dans le fil": "Your sessions now appear in the feed",
  "Tes séances redeviennent privées": "Your sessions are private again",
  "toi :": "you:",
  "Ton activité du jour": "Your activity today",
  "TON COACH": "YOUR COACH",
  "Ton coach n'a pas encore laissé de retour sur tes dernières séances. Envoie-lui une vidéo depuis une séance pour lancer l'échange.":
    "Your coach hasn't left any feedback on your recent sessions yet. Send them a video from a session to start the conversation.",
  "Ton poids aujourd'hui": "Your weight today",
  "Ton point de départ.": "Your starting point.",
  "TON PROFIL": "YOUR PROFILE",
  "Ton profil est créé. Léo va te bâtir un programme sur mesure dans les prochaines 24h.":
    "Your profile is set. Léo will build you a custom program within the next 24h.",
  "Ton programme du jour, semaine par semaine.": "Your daily program, week by week.",
  TONNAGE: "TONNAGE",
  Tout: "All",
  "TOUT EST": "EVERYTHING IS",
  "Trace enregistrée": "Saved route",
  "Trace personnalisée": "Custom route",
  "Trace personnalisée · Vichy": "Custom route · Vichy",
  "Très belle semaine, tu es dans le rythme.": "Great week, you're in the groove.",
  "Très facile. Charge probablement légère.": "Very easy. Load probably too light.",
  "Tu enchaînes B1 et B2 ": "You do B1 and B2 ",
  "UN MOT DE TON COACH": "A WORD FROM YOUR COACH",
  "Une semaine pour reposer le corps. Reviens fort la suivante 💪":
    "A week to rest your body. Come back stronger the next one 💪",
  "Vise toujours le haut": "Always aim for the top",
  "VOIR LA SÉANCE →": "VIEW SESSION →",
  "Voir le code couleur": "See the color code",
  "VOIR LE MOUVEMENT": "WATCH THE MOVEMENT",
  "Voir le tempo": "See the tempo",
  "VOIR MA SEMAINE →": "SEE MY WEEK →",
  "VOIR MON PROGRAMME →": "VIEW MY PROGRAM →",
  "volume total": "total volume",
};

type I18nCtx = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  /** Traduit une chaîne française source vers la langue courante (fallback = FR). */
  t: (fr: string) => string;
};

const Ctx = createContext<I18nCtx | null>(null);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  // Toujours FR au premier rendu (serveur + hydratation) pour éviter tout mismatch.
  const [locale, setLocaleState] = useState<Locale>("fr");

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "en" || stored === "fr") {
        setLocaleState(stored);
        document.documentElement.lang = stored;
      }
    } catch {
      // localStorage indisponible : on reste en français
    }
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try {
      window.localStorage.setItem(STORAGE_KEY, l);
    } catch {
      // ignore
    }
    if (typeof document !== "undefined") document.documentElement.lang = l;
  }, []);

  const t = useCallback((fr: string) => (locale === "en" ? (EN[fr] ?? fr) : fr), [locale]);

  return <Ctx.Provider value={{ locale, setLocale, t }}>{children}</Ctx.Provider>;
}

/** Hook i18n. Fallback sûr (identité FR) si aucun provider — les consommateurs ne cassent pas. */
export function useI18n(): I18nCtx {
  const v = useContext(Ctx);
  if (!v) {
    return { locale: "fr", setLocale: () => {}, t: (fr: string) => fr };
  }
  return v;
}
