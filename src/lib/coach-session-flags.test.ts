import { describe, expect, it } from "bun:test";

import {
  buildEffectivePainProgramStructure,
  buildAthleteCoachSummary,
  buildCoachForcedCompletionNote,
  buildCoachForcedCompletionConfirmText,
  cleanCoachForcedCompletionNote,
  countCoachNotifications,
  findPainExercisesInProgram,
  getFollowupAccessibleSessions,
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
      subtitle: "3 séances accessibles depuis le suivi",
      empty: false,
    });
  });

  it("keeps an empty state visible from the follow-up tab", () => {
    expect(getFollowupSessionsAccessCopy(0)).toEqual({
      title: "ACCÈS AUX SÉANCES",
      subtitle: "Aucune séance accessible sur les 30 derniers jours",
      empty: true,
    });
  });
});

describe("getFollowupAccessibleSessions", () => {
  it("keeps in-progress sessions accessible from the coach follow-up tab", () => {
    const sessions = [
      { id: "scheduled", status: "scheduled" },
      { id: "in-progress", status: "in_progress" },
      { id: "completed", status: "completed" },
      { id: "rest", status: "rest" },
    ];

    expect(getFollowupAccessibleSessions(sessions).map((session) => session.id)).toEqual([
      "in-progress",
      "completed",
    ]);
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

describe("buildEffectivePainProgramStructure", () => {
  it("includes adapted assignment weeks before looking for painful exercises", () => {
    const structure = buildEffectivePainProgramStructure({
      programStructure: {
        weeks: [
          {
            days: [
              {
                label: "Lower",
                exercises: [{ name: "Squat" }],
              },
            ],
          },
        ],
      },
      adaptedWeeks: [
        {
          week_number: 1,
          structure: {
            days: [
              {
                label: "Lower adapté",
                exercises: [{ name: "Fentes bulgares" }],
              },
            ],
          },
        },
      ],
    });

    expect(
      findPainExercisesInProgram({
        pains: [
          {
            exercise_name: "Fentes bulgares",
            zone: "Tendon d'Achille",
            intensity: 4,
          },
        ],
        programStructure: structure,
      }).map((alert) => alert.locations),
    ).toEqual([["S1 · J1 Lower adapté"]]);
  });
});

describe("findPainExercisesInProgram", () => {
  it("shows where painful exercises still exist in the active program", () => {
    const result = findPainExercisesInProgram({
      pains: [
        {
          exercise_name: "Fentes bulgares",
          zone: "Tendon d'Achille",
          intensity: 4,
          comment: "impossible",
          created_at: "2026-09-01T08:00:00Z",
          resolved_at: null,
        },
      ],
      programStructure: {
        weeks: [
          {
            days: [
              {
                label: "Lower",
                exercises: [{ name: "Fentes bulgares" }, { name: "Rowing" }],
              },
            ],
          },
        ],
      },
    });

    expect(result).toEqual([
      {
        exerciseName: "Fentes bulgares",
        zone: "Tendon d'Achille",
        maxIntensity: 4,
        reportCount: 1,
        latestComment: "impossible",
        latestAt: "2026-09-01T08:00:00Z",
        locations: ["S1 · J1 Lower"],
      },
    ]);
  });
});

describe("buildAthleteCoachSummary", () => {
  it("turns follow-up metrics into a compact coach profile", () => {
    expect(
      buildAthleteCoachSummary({
        adherence: 82,
        avgRpe: 6.4,
        openPainsCount: 1,
        freeSessions30: 2,
        watchList: [{ name: "Squat", tooHard: 2, couldNot: 0, highRpe: 0, total: 3 }],
        painProgramAlerts: [{ exerciseName: "Fentes bulgares", locations: ["S1 · J1"] }],
      }),
    ).toEqual({
      tone: "À protéger",
      strengths: [
        "Bonne régularité sur 30 jours",
        "Charge ressentie maîtrisée",
        "Ajoute du travail libre en autonomie",
      ],
      watchPoints: [
        "1 douleur ouverte à traiter",
        "Fentes bulgares est encore présent dans le programme actif",
        "Squat revient dans les exos à surveiller",
      ],
      coachMoves: [
        "Remplacer ou alléger les exos douloureux avant la prochaine séance",
        "Garder un objectif simple et valorisant sur la prochaine semaine",
      ],
    });
  });
});
