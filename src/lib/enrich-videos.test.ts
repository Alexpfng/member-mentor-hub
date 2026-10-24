import { describe, expect, it } from "bun:test";
import { enrichVideosFromLibrary } from "./enrich-videos";

describe("enrichVideosFromLibrary", () => {
  it("uses the current library video when a program snapshot has an older one", () => {
    const result = enrichVideosFromLibrary(
      [{ name: "B-stance deadlift", youtube_url: "https://youtu.be/oldVideo123" }],
      [
        {
          name: "B-stance deadlift",
          youtube_url: "https://youtu.be/newVideo123",
          youtube_id: "newVideo123",
        },
      ],
    );

    expect(result[0]?.youtube_url).toBe("https://youtu.be/newVideo123");
    expect(result[0]?.youtube_id).toBe("newVideo123");
  });

  it("clears a stale program video when the matching library exercise has no video", () => {
    const result = enrichVideosFromLibrary(
      [{ name: "B-stance deadlift", youtube_url: "https://youtu.be/oldVideo123" }],
      [{ name: "B-stance deadlift", youtube_url: null }],
    );

    expect(result[0]?.youtube_url).toBeNull();
    expect(result[0]?.youtube_id).toBeNull();
  });
});
