export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return "à l'instant";
  const s = Math.floor(ms / 1000);
  if (s < 60) return "à l'instant";
  const m = Math.floor(s / 60);
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `il y a ${d}j`;
  return new Date(iso).toLocaleDateString("fr-FR");
}

/**
 * Borne haute plausible pour UNE séance (minutes). Au-delà, la durée a été
 * mesurée en horloge murale sur une séance laissée ouverte (started_at vieux
 * de plusieurs heures/jours) → valeur sans signification.
 */
export const MAX_PLAUSIBLE_SESSION_MIN = 240; // 4 h

/**
 * Durée d'une séance à l'ÉCRITURE : minutes entre started_at et endedAt, bornée.
 * Renvoie null si pas de début connu ou si la durée est implausible — l'UI
 * affiche alors « — » / « Durée non enregistrée » au lieu de « 15401 min ».
 */
export function computeSessionDurationMin(
  startedAt: string | null | undefined,
  endedAt: Date = new Date(),
): number | null {
  if (!startedAt) return null;
  const ms = endedAt.getTime() - new Date(startedAt).getTime();
  if (!Number.isFinite(ms)) return null;
  const min = Math.round(ms / 60000);
  if (min <= 0 || min > MAX_PLAUSIBLE_SESSION_MIN) return null;
  return min;
}

/**
 * Garde-fou à l'AFFICHAGE : renvoie la durée si plausible, sinon null. Permet
 * à l'UI de dégrader proprement pour les lignes déjà en base AVANT que la
 * migration de nettoyage ne soit appliquée.
 */
export function sanitizeDurationMin(min: number | null | undefined): number | null {
  if (min == null || !Number.isFinite(min)) return null;
  if (min <= 0 || min > MAX_PLAUSIBLE_SESSION_MIN) return null;
  return min;
}
