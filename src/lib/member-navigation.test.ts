import { describe, expect, it } from "bun:test";
import {
  memberNavigationItems,
  memberNavigationActiveId,
  mobileMemberPrimaryItems,
  mobileMemberMoreItems,
} from "./member-navigation";

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

  it("keeps five mobile slots and leaves settings reachable in More", () => {
    expect(mobileMemberPrimaryItems.map((item) => item.id)).toEqual([
      "home",
      "prog",
      "plan",
      "nutrition",
    ]);
    expect(mobileMemberPrimaryItems.length + 1).toBe(5);
    expect(mobileMemberMoreItems.some((item) => item.id === "profile")).toBe(true);
    expect(mobileMemberMoreItems.some((item) => item.id === "msgs")).toBe(true);
    expect(mobileMemberMoreItems).toHaveLength(5);
  });
});
