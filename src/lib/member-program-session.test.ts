import { describe, expect, it } from "bun:test";
import { getProgramSessionDayNumber } from "./member-program-session";

describe("getProgramSessionDayNumber", () => {
  it("uses the session position rather than a possibly duplicated display number", () => {
    expect(getProgramSessionDayNumber(3)).toBe(4);
    expect(getProgramSessionDayNumber(4)).toBe(5);
  });
});
