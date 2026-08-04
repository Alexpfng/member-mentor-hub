export type ExerciseFeedback = {
  rpe: number | null;
  pain: boolean;
  tooHard: boolean;
  tooEasy: boolean;
  failure: boolean;
};

export function normalizeExerciseFeedbackKey(name: string | null | undefined) {
  return (name ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’`]/g, "'")
    .replace(/[‐‑–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Mots qui ne portent pas l'identité de l'exercice. */
const STOP_WORDS = new Set([
  "a",
  "au",
  "aux",
  "avec",
  "d",
  "dans",
  "de",
  "des",
  "du",
  "en",
  "et",
  "l",
  "la",
  "le",
  "les",
  "par",
  "pour",
  "sur",
  "un",
  "une",
]);

/** Un match sous ce score n'est plus le même mouvement. */
const MATCH_THRESHOLD = 0.6;
/** Deux candidats à moins de ça l'un de l'autre : trop ambigu pour trancher. */
const AMBIGUITY_MARGIN = 0.05;

/**
 * Découpe un nom en mots porteurs de sens. Le « s » final saute pour que
 * « haltères » et « haltère » soient le même mot, et les nombres sont écartés :
 * « ladder 2/3/4 » ne doit pas se rapprocher d'un autre exo à cause du « 3 ».
 */
function meaningfulTokens(name: string | null | undefined): string[] {
  return normalizeExerciseFeedbackKey(name)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token) && !/^\d+$/.test(token))
    .map((token) => (token.endsWith("s") ? token.slice(0, -1) : token));
}

/**
 * Part des mots du nom le plus court que l'on retrouve dans l'autre.
 * Volontairement asymétrique : « Dips lestées » doit matcher « Dips lestées en
 * lourd », un coach précisant souvent la variante d'une semaine à l'autre.
 */
function similarity(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setB = new Set(b);
  const shared = a.filter((token) => setB.has(token)).length;
  // Un seul mot commun ne prouve rien (« landmine press » vs « landmine row »).
  if (shared < 2) return 0;
  return shared / Math.min(a.length, b.length);
}

export type FeedbackMatch = {
  /** Clé normalisée retrouvée dans le retour du membre. */
  key: string;
  feedback: ExerciseFeedback;
  /** Faux quand les noms diffèrent : l'UI doit alors afficher `key`. */
  exact: boolean;
};

/**
 * Retrouve le retour du membre pour un exercice.
 * Le nom est la seule clé disponible entre deux semaines, et les coachs
 * renomment leurs exercices en permanence (« Dips lestées » → « Dips lestées en
 * lourd ») : un rapprochement strict perdait la quasi-totalité des retours.
 */
export function findExerciseFeedback(
  feedback: Record<string, ExerciseFeedback>,
  exerciseName: string | null | undefined,
): FeedbackMatch | null {
  const key = normalizeExerciseFeedbackKey(exerciseName);
  if (!key) return null;

  const exact = feedback[key];
  if (exact) return { key, feedback: exact, exact: true };

  const target = meaningfulTokens(exerciseName);
  if (target.length === 0) return null;

  let best: { key: string; score: number } | null = null;
  let runnerUpScore = 0;
  for (const candidateKey of Object.keys(feedback)) {
    const score = similarity(target, meaningfulTokens(candidateKey));
    if (best == null || score > best.score) {
      runnerUpScore = best?.score ?? 0;
      best = { key: candidateKey, score };
    } else if (score > runnerUpScore) {
      runnerUpScore = score;
    }
  }

  if (!best || best.score < MATCH_THRESHOLD) return null;
  // Deux variantes aussi proches l'une que l'autre : on préfère ne rien
  // afficher plutôt que d'attribuer le retour au mauvais exercice.
  if (best.score - runnerUpScore < AMBIGUITY_MARGIN) return null;

  return { key: best.key, feedback: feedback[best.key], exact: false };
}

export function getExerciseFeedback(
  feedback: Record<string, ExerciseFeedback>,
  exerciseName: string | null | undefined,
) {
  return findExerciseFeedback(feedback, exerciseName)?.feedback;
}
