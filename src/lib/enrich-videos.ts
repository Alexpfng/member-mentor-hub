import type { ProgExercise } from "@/components/cst/ProgramBlocks";

export type LibraryVideoEx = {
  name?: string | null;
  youtube_url?: string | null;
  youtube_id?: string | null;
  image_url?: string | null;
};

/** Clé de rapprochement exercice ↔ bibliothèque : nom normalisé (casse/espaces/accents). */
export function normExName(name: unknown): string {
  return String(name ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Vrai si l'exercice n'a aucune démo vidéo. */
function hasNoVideo(ex: ProgExercise): boolean {
  return !ex.youtube_id && !ex.youtube_url && !ex.youtube_alt_url;
}

/**
 * Complète les exercices SANS vidéo avec la démo de la bibliothèque (match par nom).
 *
 * Les démos affichées côté membre viennent du JSONB du programme, figé à sa création.
 * Une vidéo ajoutée manuellement à la bibliothèque APRÈS coup n'y figure pas : on la
 * récupère ici. N'écrase jamais une vidéo déjà présente dans le programme.
 */
export function enrichVideosFromLibrary(
  exos: ProgExercise[],
  libExercises: LibraryVideoEx[] | null | undefined,
): ProgExercise[] {
  if (!Array.isArray(exos) || !exos.some(hasNoVideo)) return exos;
  const byName = new Map<string, LibraryVideoEx>();
  for (const libEx of libExercises ?? []) {
    const key = normExName(libEx.name);
    if (key && !byName.has(key)) byName.set(key, libEx);
  }
  if (byName.size === 0) return exos;
  return exos.map((ex) => {
    if (!hasNoVideo(ex)) return ex;
    const match = byName.get(normExName(ex.name));
    if (!match || (!match.youtube_url && !match.youtube_id)) return ex;
    return {
      ...ex,
      youtube_url: match.youtube_url ?? ex.youtube_url ?? null,
      youtube_id: match.youtube_id ?? ex.youtube_id ?? null,
      image_url: ex.image_url ?? match.image_url ?? null,
    };
  });
}
