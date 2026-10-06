import { describe, expect, it } from "bun:test";

import { defaultPublishStartDate } from "./publish-start-date";

describe("defaultPublishStartDate", () => {
  it("utilise le jour courant quand la semaine n'a pas encore de date", () => {
    expect(defaultPublishStartDate(null, "2026-09-28")).toBe("2026-09-28");
  });

  it("conserve la date deja publiee quand elle existe", () => {
    expect(defaultPublishStartDate("2026-11-09T00:00:00.000Z", "2026-09-28")).toBe(
      "2026-11-09",
    );
  });
});
