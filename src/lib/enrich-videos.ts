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

/**
 * Synchronise la vidéo de l'exercice avec la version actuelle de la bibliothèque (match par nom).
 *
 * Les démos affichées côté membre viennent du JSONB du programme, figé à sa création.
 * Les structures de programme sont des instantanés : la bibliothèque reste la source
 * de vérité pour la vidéo afin qu'une correction du coach soit visible côté membre.
 */
export function enrichVideosFromLibrary(
  exos: ProgExercise[],
  libExercises: LibraryVideoEx[] | null | undefined,
): ProgExercise[] {
  if (!Array.isArray(exos) || exos.length === 0) return exos;
  const byName = new Map<string, LibraryVideoEx>();
  for (const libEx of libExercises ?? []) {
    const key = normExName(libEx.name);
    if (key && !byName.has(key)) byName.set(key, libEx);
  }
  if (byName.size === 0) return exos;
  return exos.map((ex) => {
    const match = byName.get(normExName(ex.name));
    if (!match) return ex;
    return {
      ...ex,
      youtube_url: match.youtube_url ?? null,
      youtube_id: match.youtube_id ?? null,
      image_url: match.image_url ?? null,
    };
  });
}
