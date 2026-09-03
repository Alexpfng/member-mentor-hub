import { readFileSync } from "node:fs";
import { describe, expect, it } from "bun:test";

const liveSessionSource = readFileSync("src/components/cst/LiveSession.tsx", "utf8");
const tokensCss = readFileSync("src/tokens.css", "utf8");

describe("LiveSession expert RPE picker theme support", () => {
  it("uses explicit classes for both expert RPE popovers and comment fields", () => {
    expect(liveSessionSource.match(/className="cst-expert-rpe-picker"/g)).toHaveLength(2);
    expect(liveSessionSource.match(/className="cst-expert-rpe-comment"/g)).toHaveLength(2);
    expect(liveSessionSource.match(/className="cst-expert-rpe-clear/g)).toHaveLength(2);
  });

  it("keeps expert RPE comment text readable in light mode", () => {
    expect(tokensCss).toContain("html.theme-light .cst-expert-rpe-picker");
    expect(tokensCss).toContain("html.theme-light .cst-expert-rpe-comment");
    expect(tokensCss).toContain("html.theme-light .cst-expert-rpe-comment::placeholder");
  });
});
