import { describe, expect, it } from "bun:test";

import { applyPlannedSessionToWeekPlan } from "./planning-local-state";

describe("applyPlannedSessionToWeekPlan", () => {
  it("adds the saved planned session immediately to the current planning state", () => {
    const state = { planned: [] };
    const row = {
      id: "plan-1",
      day_label: "LOWER 2",
      planned_date: "2026-08-08",
      week_number: 2,
    };

    expect(applyPlannedSessionToWeekPlan(state, row)).toEqual({ planned: [row] });
  });

  it("replaces an existing planned session instead of duplicating it", () => {
    const oldRow = {
      id: "plan-1",
      day_label: "LOWER 2",
      planned_date: null,
      week_number: 2,
    };
    const newRow = { ...oldRow, planned_date: "2026-08-08" };

    expect(applyPlannedSessionToWeekPlan({ planned: [oldRow] }, newRow)).toEqual({
      planned: [newRow],
    });
  });
});
