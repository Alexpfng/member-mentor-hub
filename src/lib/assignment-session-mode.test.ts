import { describe, expect, it } from "bun:test";

import { preserveAssignmentSessionMode } from "./assignment-session-mode";

describe("preserveAssignmentSessionMode", () => {
  it("keeps expert mode when replacing an active assignment", () => {
    expect(preserveAssignmentSessionMode("expert")).toBe("expert");
  });

  it("falls back to debutant only when no valid previous mode exists", () => {
    expect(preserveAssignmentSessionMode("debutant")).toBe("debutant");
    expect(preserveAssignmentSessionMode(null)).toBe("debutant");
    expect(preserveAssignmentSessionMode("amateur")).toBe("debutant");
  });
});
