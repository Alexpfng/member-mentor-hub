import { describe, expect, it } from "bun:test";
import { memberNavigationItems, memberNavigationActiveId } from "./member-navigation";

describe("member navigation", () => {
  it("offers a route back to the member home and to nutrition", () => {
    expect(memberNavigationItems.some((item) => item.path === "/membre")).toBe(true);
    expect(memberNavigationItems.some((item) => item.path === "/membre/nutrition")).toBe(true);
  });

  it("marks nested pages as active without confusing the home route", () => {
    expect(memberNavigationActiveId("/membre/nutrition")).toBe("nutrition");
    expect(memberNavigationActiveId("/membre/nutrition/historique")).toBe("nutrition");
    expect(memberNavigationActiveId("/membre")).toBe("home");
  });
});
