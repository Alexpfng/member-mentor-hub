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

  it("does not replace a program video when the library has no current video", () => {
    const result = enrichVideosFromLibrary(
      [{ name: "B-stance deadlift", youtube_url: "https://youtu.be/oldVideo123" }],
      [{ name: "B-stance deadlift", youtube_url: null }],
    );

    expect(result[0]?.youtube_url).toBe("https://youtu.be/oldVideo123");
  });
});
