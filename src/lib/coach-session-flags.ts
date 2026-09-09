export const COACH_FORCED_COMPLETION_MARKER = "[coach_forced_completion]";

export function isCoachForcedIncompleteSession(note: string | null | undefined): boolean {
  return String(note ?? "").includes(COACH_FORCED_COMPLETION_MARKER);
}

export function cleanCoachForcedCompletionNote(note: string | null | undefined): string {
  return String(note ?? "")
    .replaceAll(COACH_FORCED_COMPLETION_MARKER, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function buildCoachForcedCompletionNote(
  existingNote: string | null | undefined,
  options: { coachName?: string | null } = {},
): string {
  const current = String(existingNote ?? "").trim();
  if (isCoachForcedIncompleteSession(current)) return current;

  const coachName = options.coachName?.trim() || "le coach";
  const forcedNote = `${COACH_FORCED_COMPLETION_MARKER} Séance clôturée par le coach (${coachName}) car elle était restée en cours. À vérifier : le membre n'a pas appuyé lui-même sur Terminer.`;

  return current ? `${current}\n\n${forcedNote}` : forcedNote;
}

export function buildCoachForcedCompletionConfirmText(input: {
  memberName?: string | null;
  sessionLabel?: string | null;
}): string {
  const sessionLabel = input.sessionLabel?.trim() || "cette séance";
  const memberName = input.memberName?.trim() || "ce coaché";

  return `Forcer la clôture de la séance « ${sessionLabel} » de ${memberName} ?\n\nElle passera en retours comme séance incomplète, avec une alerte visible pour Léo.`;
}

export function getFollowupSessionsAccessCopy(count: number): {
  title: string;
  subtitle: string;
  empty: boolean;
} {
  const safeCount = Math.max(0, Math.floor(count));
  if (safeCount === 0) {
    return {
      title: "ACCÈS AUX SÉANCES",
      subtitle: "Aucune séance accessible sur les 30 derniers jours",
      empty: true,
    };
  }

  return {
    title: "ACCÈS AUX SÉANCES",
    subtitle: `${safeCount} séance${safeCount > 1 ? "s" : ""} accessible${safeCount > 1 ? "s" : ""} depuis le suivi`,
    empty: false,
  };
}

export function getFollowupAccessibleSessions<T extends { status?: string | null }>(
  sessions: T[],
  limit = 8,
): T[] {
  return sessions
    .filter((session) => session.status === "completed" || session.status === "in_progress")
    .slice(0, Math.max(0, limit));
}

export function getHistorySessionAccessCopy(): { cta: string; ariaLabel: string } {
  return {
    cta: "VOIR LA SÉANCE →",
    ariaLabel: "Ouvrir le détail de la séance",
  };
}

export function countCoachNotifications(input: {
  unresolvedPain?: number | null;
  unreadMessages?: number | null;
  unreviewedVideos?: number | null;
  forcedIncompleteSessions?: number | null;
}): number {
  return (
    (input.unresolvedPain ?? 0) +
    (input.unreadMessages ?? 0) +
    (input.unreviewedVideos ?? 0) +
    (input.forcedIncompleteSessions ?? 0)
  );
}

type PainLike = {
  exercise_name?: string | null;
  zone?: string | null;
  intensity?: number | null;
  comment?: string | null;
  created_at?: string | null;
  resolved_at?: string | null;
};

export type ProgramPainAlert = {
  exerciseName: string;
  zone: string | null;
  maxIntensity: number;
  reportCount: number;
  latestComment: string | null;
  latestAt: string | null;
  locations: string[];
};

type ProgramExerciseLocation = {
  exerciseName: string;
  location: string;
};

function normalizeExerciseName(value: string | null | undefined): string {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase("fr-FR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function collectExercisesFromValue(
  value: unknown,
  location: string,
  output: ProgramExerciseLocation[],
): void {
  if (Array.isArray(value)) {
    value.forEach((entry) => collectExercisesFromValue(entry, location, output));
    return;
  }

  const row = asRecord(value);
  if (!row) return;
  const rawName = row.name ?? row.exercise_name ?? row.exerciseName ?? row.title;
  if (typeof rawName === "string" && rawName.trim()) {
    output.push({ exerciseName: rawName.trim(), location });
  }

  for (const key of ["exercises", "items", "blocks", "children", "stations"]) {
    if (key in row) collectExercisesFromValue(row[key], location, output);
  }
}

export function listProgramExerciseLocations(programStructure: unknown): ProgramExerciseLocation[] {
  const structure = asRecord(programStructure);
  const weeks = Array.isArray(structure?.weeks) ? structure.weeks : [];
  const output: ProgramExerciseLocation[] = [];

  weeks.forEach((week, weekIndex) => {
    const weekRow = asRecord(week);
    const days = Array.isArray(weekRow?.days) ? weekRow.days : [];
    days.forEach((day, dayIndex) => {
      const dayRow = asRecord(day);
      const label = typeof dayRow?.label === "string" && dayRow.label.trim() ? dayRow.label : "";
      const location = [`S${weekIndex + 1}`, `J${dayIndex + 1}${label ? ` ${label}` : ""}`].join(
        " · ",
      );
      collectExercisesFromValue(day, location, output);
    });
  });

  return output;
}

export function findPainExercisesInProgram(input: {
  pains: PainLike[];
  programStructure: unknown;
}): ProgramPainAlert[] {
  const locationsByExercise = new Map<string, { exerciseName: string; locations: Set<string> }>();
  for (const item of listProgramExerciseLocations(input.programStructure)) {
    const key = normalizeExerciseName(item.exerciseName);
    if (!key) continue;
    const current = locationsByExercise.get(key) ?? {
      exerciseName: item.exerciseName,
      locations: new Set<string>(),
    };
    current.locations.add(item.location);
    locationsByExercise.set(key, current);
  }

  const byPainExercise = new Map<string, ProgramPainAlert>();
  for (const pain of input.pains) {
    const key = normalizeExerciseName(pain.exercise_name);
    if (!key) continue;
    const match = locationsByExercise.get(key);
    if (!match) continue;

    const current = byPainExercise.get(key) ?? {
      exerciseName: match.exerciseName,
      zone: pain.zone ?? null,
      maxIntensity: 0,
      reportCount: 0,
      latestComment: null,
      latestAt: null,
      locations: Array.from(match.locations),
    };
    current.reportCount += 1;
    current.maxIntensity = Math.max(current.maxIntensity, Number(pain.intensity ?? 0));
    if (!current.latestAt || String(pain.created_at ?? "") > current.latestAt) {
      current.zone = pain.zone ?? current.zone;
      current.latestComment = pain.comment?.trim() || null;
      current.latestAt = pain.created_at ?? null;
    }
    byPainExercise.set(key, current);
  }

  return Array.from(byPainExercise.values()).sort(
    (a, b) => b.maxIntensity - a.maxIntensity || b.reportCount - a.reportCount,
  );
}

export function buildAthleteCoachSummary(input: {
  adherence: number | null;
  avgRpe: number | null;
  openPainsCount: number;
  freeSessions30: number;
  watchList: Array<{ name: string; tooHard: number; couldNot: number; highRpe: number; total: number }>;
  painProgramAlerts: Array<{ exerciseName: string; locations: string[] }>;
}): {
  tone: string;
  strengths: string[];
  watchPoints: string[];
  coachMoves: string[];
} {
  const strengths: string[] = [];
  const watchPoints: string[] = [];
  const coachMoves: string[] = [];

  if (input.adherence != null && input.adherence >= 80) {
    strengths.push("Bonne régularité sur 30 jours");
  } else if (input.adherence != null && input.adherence < 60) {
    watchPoints.push("Adhérence basse sur les 30 derniers jours");
  }

  if (input.avgRpe != null && input.avgRpe >= 8.5) {
    watchPoints.push("Charge ressentie élevée");
    coachMoves.push("Prévoir une semaine plus contrôlée ou une consigne RPE plus basse");
  } else if (input.avgRpe != null && input.avgRpe <= 7) {
    strengths.push("Charge ressentie maîtrisée");
  }

  if (input.freeSessions30 > 0) strengths.push("Ajoute du travail libre en autonomie");

  if (input.openPainsCount > 0) {
    watchPoints.push(
      `${input.openPainsCount} douleur${input.openPainsCount > 1 ? "s ouvertes" : " ouverte"} à traiter`,
    );
    coachMoves.push("Remplacer ou alléger les exos douloureux avant la prochaine séance");
  }

  const firstPainInProgram = input.painProgramAlerts[0];
  if (firstPainInProgram) {
    watchPoints.push(`${firstPainInProgram.exerciseName} est encore présent dans le programme actif`);
  }

  const firstWatch = input.watchList[0];
  if (firstWatch) {
    watchPoints.push(`${firstWatch.name} revient dans les exos à surveiller`);
  }

  if (input.adherence != null && input.adherence < 60) {
    coachMoves.push("Redonner une cible courte et facile à valider cette semaine");
  } else {
    coachMoves.push("Garder un objectif simple et valorisant sur la prochaine semaine");
  }

  return {
    tone: input.openPainsCount > 0 || input.painProgramAlerts.length > 0 ? "À protéger" : "À pousser",
    strengths: strengths.length ? strengths.slice(0, 3) : ["Profil encore à construire avec les prochains retours"],
    watchPoints: watchPoints.length ? watchPoints.slice(0, 4) : ["Rien d'urgent dans les retours récents"],
    coachMoves: coachMoves.slice(0, 3),
  };
}
