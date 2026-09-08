import { describe, expect, it } from "bun:test";

import {
  buildCoachForcedCompletionNote,
  cleanCoachForcedCompletionNote,
  countCoachNotifications,
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
