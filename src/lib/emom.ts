/**
 * Lecture des paramètres d'un EMOM : combien de minutes, et combien de reps par
 * minute. Le coach écrit ça de dix façons différentes (dans le nom, dans le
 * champ Séries, dans le champ Reps, avec ou sans unité) — d'où ce parsing
 * dédié, isolé et testé : une erreur ici affiche un EMOM faux au coaché.
 *
 * Convention du builder pour un bloc EMOM : « Durée (min) » = champ Séries,
 * « Reps / min » = champ Reps.
 */

export type EmomParams = { durationMin: number; repsPerMin: number | null };

/** Durée par défaut quand rien d'exploitable n'est écrit nulle part. */
const DEFAULT_DURATION_MIN = 10;

/**
 * Un EMOM d'UNE minute n'existe pas : « Every Minute On the Minute » sur une
 * seule minute, c'est une série sèche. Quand on tombe là-dessus avec plusieurs
 * reps, c'est que la durée et les reps ont été saisies à l'envers (Séries = 1,
 * Reps = 10 pour « 10 minutes à 1 rep ») : on remet dans le bon sens plutôt
 * que d'afficher un EMOM absurde au coaché.
 */
function fixSwappedDurationAndReps(parsed: EmomParams): EmomParams {
  const { durationMin, repsPerMin } = parsed;
  if (durationMin === 1 && repsPerMin != null && repsPerMin >= 2) {
    return { durationMin: repsPerMin, repsPerMin: durationMin };
  }
  return parsed;
}

function parseTotalReps(reps: string | null | undefined): number | null {
  const raw = String(reps ?? "").toLowerCase();
  if (!/\b(en\s+tout|total|au\s+total)\b/.test(raw)) return null;
  const match = raw.match(/\d+/);
  if (!match) return null;
  const value = parseInt(match[0], 10);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function parseEmom(
  series: string | null,
  reps: string | null,
  name: string | null = null,
): EmomParams {
  // Normalise: apostrophe typographique → droit, minuscule.
  // Le nom est inclus pour les regex « emom… » (le coach écrit souvent la durée
  // dans le nom, ex. « … EMOM6' ») mais PAS pour les fallbacks durFromSeries /
  // repsFromSeries plus bas, qui restent liés au vrai champ Séries.
  const src = `${name ?? ""} ${series ?? ""} ${reps ?? ""}`.toLowerCase().replace(/[‘’ʼ]/g, "'");

  // Combined "EMOMreps×dur'" or "EMOMreps/dur'" → e.g. "EMOM3×15'" "EMOM3/10min"
  const combinedMatch = src.match(/emom\s*(\d+)\s*[x×/]\s*(\d+)\s*(?:'|min\b|m\b)/);
  if (combinedMatch) {
    return {
      durationMin: parseInt(combinedMatch[2], 10),
      repsPerMin: parseInt(combinedMatch[1], 10),
    };
  }

  // Duration-only: "EMOM15'" or "EMOM15min" or "EMOM15m"
  const durMatch = src.match(/emom\s*(\d+)\s*(?:'|min\b|m\b)/);
  if (durMatch) {
    const token = parseInt(durMatch[1], 10);
    const totalReps = parseTotalReps(reps);
    if (totalReps != null) {
      // Dans les Sheets du coach, « EMOM3' » peut signifier 3 reps/min et le
      // champ Reps porte alors le total (« 30 en tout »). Si le nombre est petit,
      // on le traite comme une fréquence ; sinon comme une durée explicite.
      if (token <= 6 && totalReps % token === 0) {
        return { durationMin: totalReps / token, repsPerMin: token };
      }
      return {
        durationMin: token,
        repsPerMin: Math.max(1, Math.round(totalReps / token)),
      };
    }
    // Reps may come from separate reps field
    const repsVal = reps?.match(/^(\d+)$/)?.[1] ?? reps?.match(/emom\s*(\d+)\s*reps?/i)?.[1];
    return fixSwappedDurationAndReps({
      durationMin: token,
      repsPerMin: repsVal ? parseInt(repsVal, 10) : null,
    });
  }

  // Type EMOM explicite (sélecteur builder) : durée = champ Séries (nb de minutes),
  // reps/min = champ Reps — y compris alterné « 3/4 » (paires/impaires).
  const repsAlt = reps?.match(/^\s*(\d+)\s*\/\s*\d+\s*$/)?.[1];
  const repsFromReps =
    reps?.match(/^(\d+)$/)?.[1] ?? repsAlt ?? reps?.match(/emom\s*(\d+)\s*reps?/i)?.[1];
  const repsFromSeries = series?.match(/emom\s*(\d+)/i)?.[1];
  // Le champ Reps, quand il est renseigné, fait foi : un « EMOM 10 » écrit dans
  // Séries désigne la durée, pas les reps — le lire en priorité écrasait la
  // valeur explicite du coach (10 reps/min au lieu de 1).
  const repsPerMin = repsFromReps
    ? parseInt(repsFromReps, 10)
    : repsFromSeries
      ? parseInt(repsFromSeries, 10)
      : null;

  // Durée : « 10 », « 10min », mais aussi « EMOM 10 » (sans unité) — sinon on
  // retombait sur la durée par défaut en ignorant ce que le coach a écrit.
  const durFromSeries =
    series?.match(/^\s*(\d+)\s*(?:'|min|m)?\s*$/i)?.[1] ??
    (repsFromReps ? series?.match(/^\s*emom\s*(\d+)\s*(?:'|min|m)?\s*$/i)?.[1] : undefined);

  return fixSwappedDurationAndReps({
    durationMin: durFromSeries ? parseInt(durFromSeries, 10) : DEFAULT_DURATION_MIN,
    repsPerMin,
  });
}

/**
 * Reps alternées d'une minute à l'autre, notées « paires/impaires » — ex. « 1/2 »
 * = 1 rep les minutes paires, 2 reps les minutes impaires. C'est la notation déjà
 * annoncée au coaché sur l'écran EMOM.
 *
 * Renvoie le cycle à jouer minute par minute, dans l'ordre réel : la 1re minute
 * est IMPAIRE, donc elle prend la seconde valeur. `null` si ce n'est pas une
 * notation alternée.
 */
export function alternatingRepsCycle(reps: string | null | undefined): number[] | null {
  const match = String(reps ?? "")
    .trim()
    .match(/^(\d+)\s*\/\s*(\d+)$/);
  if (!match) return null;
  const even = parseInt(match[1], 10);
  const odd = parseInt(match[2], 10);
  if (!Number.isFinite(even) || !Number.isFinite(odd)) return null;
  // minute 1 (impaire) → odd, minute 2 (paire) → even, puis on boucle.
  return [odd, even];
}
