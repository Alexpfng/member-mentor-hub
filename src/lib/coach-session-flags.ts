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
