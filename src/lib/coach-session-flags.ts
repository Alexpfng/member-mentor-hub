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
