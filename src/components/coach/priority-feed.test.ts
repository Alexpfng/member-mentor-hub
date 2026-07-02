import { describe, expect, it } from "bun:test";

import { hideMessageFromPriorityItems, hideSessionFromPriorityItems } from "./priority-feed";

describe("hideSessionFromPriorityItems", () => {
  it("removes only the targeted session from a grouped priority card", () => {
    const items = [
      {
        type: "member_group" as const,
        id: "mg-1",
        memberId: "m1",
        memberName: "Teddy Morin",
        maxRpe: 9,
        createdAt: "2026-07-02T19:00:00.000Z",
        priority: 80,
        sessions: [
          { sessionId: "s1", createdAt: "2026-07-02T19:00:00.000Z", exercises: [{ name: "A", rpe: 9 }], maxRpe: 9, label: "Séance 1" },
          { sessionId: "s2", createdAt: "2026-07-01T19:00:00.000Z", exercises: [{ name: "B", rpe: 8 }], maxRpe: 8, label: "Séance 2" },
        ],
      },
    ];

    expect(hideSessionFromPriorityItems(items, "s1")).toEqual([
      {
        type: "member_group",
        id: "mg-1",
        memberId: "m1",
        memberName: "Teddy Morin",
        maxRpe: 9,
        createdAt: "2026-07-02T19:00:00.000Z",
        priority: 80,
        sessions: [
          { sessionId: "s2", createdAt: "2026-07-01T19:00:00.000Z", exercises: [{ name: "B", rpe: 8 }], maxRpe: 8, label: "Séance 2" },
        ],
      },
    ]);
  });

  it("removes the whole grouped card when its last session is hidden", () => {
    const items = [
      {
        type: "member_group" as const,
        id: "mg-1",
        memberId: "m1",
        memberName: "Teddy Morin",
        maxRpe: 9,
        createdAt: "2026-07-02T19:00:00.000Z",
        priority: 80,
        sessions: [
          { sessionId: "s1", createdAt: "2026-07-02T19:00:00.000Z", exercises: [{ name: "A", rpe: 9 }], maxRpe: 9, label: "Séance 1" },
        ],
      },
    ];

    expect(hideSessionFromPriorityItems(items, "s1")).toEqual([]);
  });

  it("removes only the targeted message card", () => {
    const items = [
      { type: "message", id: "m1", memberId: "a" },
      { type: "message", id: "m2", memberId: "b" },
    ];

    expect(hideMessageFromPriorityItems(items, "m1")).toEqual([
      { type: "message", id: "m2", memberId: "b" },
    ]);
  });
});
