import { describe, expect, it } from "bun:test";

import {
  buildCoachForcedCompletionNote,
  buildCoachForcedCompletionConfirmText,
  cleanCoachForcedCompletionNote,
  countCoachNotifications,
  getFollowupSessionsAccessCopy,
  getHistorySessionAccessCopy,
  isCoachForcedIncompleteSession,
} from "./coach-session-flags";

describe("coach forced completion flags", () => {
  it("adds a stable marker without deleting the member note", () => {
    const note = buildCoachForcedCompletionNote("Tendon douloureux, j'ai arrêté avant.", {
      coachName: "Léo",
    });

    expect(note).toContain("Tendon douloureux");
    expect(note).toContain("Séance clôturée par le coach");
    expect(isCoachForcedIncompleteSession(note)).toBe(true);
  });

  it("does not duplicate the marker when the action is retried", () => {
    const first = buildCoachForcedCompletionNote(null, { coachName: "Léo" });
    const second = buildCoachForcedCompletionNote(first, { coachName: "Léo" });

    expect(second).toBe(first);
  });

  it("keeps the coach-facing text readable", () => {
    const note = buildCoachForcedCompletionNote("Stop tendon.", { coachName: "Léo" });

    expect(cleanCoachForcedCompletionNote(note)).not.toContain("[coach_forced_completion]");
    expect(cleanCoachForcedCompletionNote(note)).toContain("Séance clôturée par le coach");
  });

  it("builds a clear native confirmation text before forcing a session closed", () => {
    expect(
      buildCoachForcedCompletionConfirmText({
        memberName: "Teddy Morin",
        sessionLabel: "Upper body focus push",
      }),
    ).toBe(
      "Forcer la clôture de la séance « Upper body focus push » de Teddy Morin ?\n\nElle passera en retours comme séance incomplète, avec une alerte visible pour Léo.",
    );
  });
});

describe("countCoachNotifications", () => {
  it("includes forced incomplete sessions in the coach bell count", () => {
    expect(
      countCoachNotifications({
        unresolvedPain: 2,
        unreadMessages: 1,
        unreviewedVideos: 3,
        forcedIncompleteSessions: 4,
      }),
    ).toBe(10);
  });
});

describe("getFollowupSessionsAccessCopy", () => {
  it("keeps the coach follow-up session access explicit when sessions exist", () => {
    expect(getFollowupSessionsAccessCopy(3)).toEqual({
      title: "ACCÈS AUX SÉANCES",
      subtitle: "3 séances disponibles depuis le suivi",
      empty: false,
    });
  });

  it("keeps an empty state visible from the follow-up tab", () => {
    expect(getFollowupSessionsAccessCopy(0)).toEqual({
      title: "ACCÈS AUX SÉANCES",
      subtitle: "Aucune séance terminée sur les 30 derniers jours",
      empty: true,
    });
  });
});

describe("getHistorySessionAccessCopy", () => {
  it("keeps the coach history session access explicit", () => {
    expect(getHistorySessionAccessCopy()).toEqual({
      cta: "VOIR LA SÉANCE →",
      ariaLabel: "Ouvrir le détail de la séance",
    });
  });
});
