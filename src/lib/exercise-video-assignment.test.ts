import { describe, expect, it } from "bun:test";
import {
  exerciseVideoForRename,
  exerciseVideoForReplacement,
  videoForLibrarySave,
} from "./exercise-video-assignment";

describe("exercise video assignment", () => {
  it("drops the previous exercise video when the coach changes its name", () => {
    expect(
      exerciseVideoForRename(
        {
          name: "Fente bulgare",
          youtube_url: "https://youtu.be/oldVideo123",
          youtube_id: "oldVideo123",
          youtube_alt_url: "https://youtu.be/oldAlt12345",
          image_url: "old-image.jpg",
        },
        "Pat step up",
      ),
    ).toEqual({ youtube_url: null, youtube_id: null, youtube_alt_url: null, image_url: null });
  });

  it("uses the selected exercise video when replacing an exercise", () => {
    expect(
      exerciseVideoForReplacement(
        { youtube_url: "https://youtu.be/oldVideo123", youtube_id: "oldVideo123" },
        {
          youtube_url: "https://youtu.be/newVideo123",
          youtube_id: "newVideo123",
          image_url: "new-image.jpg",
        },
      ),
    ).toEqual({
      youtube_url: "https://youtu.be/newVideo123",
      youtube_id: "newVideo123",
      youtube_alt_url: null,
      image_url: "new-image.jpg",
    });
  });

  it("does not overwrite a library video's URL with an empty renamed exercise", () => {
    expect(videoForLibrarySave(null, "https://youtu.be/correct123")).toBe(
      "https://youtu.be/correct123",
    );
  });
});
