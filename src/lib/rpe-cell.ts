/**
 * Analyse une valeur brute de la « case RPE » (importée d'un Sheet ou saisie coach).
 *
 * Cas géré en plus du nombre pur : « nombre (commentaire) » — ex. `10 (10kg trop lourd)`,
 * `8,5 (dos rond)`. Le nombre part dans le badge RPE, le commentaire dans sa ligne dédiée.
 *
 * Prudence volontaire : on ne découpe QUE le motif exact `nombre (texte)` avec un nombre
 * dans une plage RPE plausible (0–10). Les consignes cardio qui commencent par un chiffre
 * sans parenthèses (`3 séries de 20'`, `45min à 70%`…) ne matchent pas → elles restent des
 * consignes et ne sont jamais transformées en RPE.
 */
export type ParsedRpeCell = {
  /** Valeur numérique du RPE (virgule décimale normalisée en point), ou null. */
  rpe: string | null;
  /** Commentaire extrait des parenthèses (ex. "10kg trop lourd"), ou null. */
  comment: string | null;
  /** Consigne texte libre (RPE non numérique, hors motif « nombre (…) »), ou null. */
  consigne: string | null;
  /** true si la case vaut « échec » / « echec ». */
  isFailure: boolean;
};

const EMPTY: ParsedRpeCell = { rpe: null, comment: null, consigne: null, isFailure: false };
const NUM_WITH_PAREN_RE = /^(\d+(?:[.,]\d+)?)\s*\((.+)\)$/;

/** Un nombre pur (éventuellement à virgule décimale) : "8", "9,5", "10.0". */
function pureNumber(str: string): string | null {
  const n = Number(str.replace(",", "."));
  if (Number.isNaN(n)) return null;
  return str.replace(",", ".");
}

export function parseRpeCell(raw: unknown): ParsedRpeCell {
  const str = String(raw ?? "").trim();
  if (!str) return EMPTY;

  if (/^(échec|echec)$/i.test(str)) {
    return { rpe: null, comment: null, consigne: null, isFailure: true };
  }

  const pure = pureNumber(str);
  if (pure != null) {
    return { rpe: pure, comment: null, consigne: null, isFailure: false };
  }

  // « nombre (commentaire) » → RPE + commentaire dédié, si le nombre est un RPE plausible.
  const m = NUM_WITH_PAREN_RE.exec(str);
  if (m) {
    const value = Number(m[1].replace(",", "."));
    if (value >= 0 && value <= 10) {
      return { rpe: m[1].replace(",", "."), comment: m[2].trim(), consigne: null, isFailure: false };
    }
  }

  // Sinon : texte libre (consigne cardio, etc.).
  return { rpe: null, comment: null, consigne: str, isFailure: false };
}
