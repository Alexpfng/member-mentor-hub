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
