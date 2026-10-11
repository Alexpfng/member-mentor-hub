import { describe, expect, it } from "bun:test";
import {
  buildTusVideoOptions,
  getResumableUploadEndpoint,
  isVideoFile,
  MAX_VIDEO_BYTES,
  videoUploadError,
} from "./video-upload";

describe("resumable video uploads", () => {
  it("uses Supabase's direct storage host for resumable transfers", () => {
    expect(getResumableUploadEndpoint("https://project-ref.supabase.co/")).toBe(
      "https://project-ref.storage.supabase.co/storage/v1/upload/resumable",
    );
  });

  it("configures resumable chunks, retries, and a path-specific resume fingerprint", async () => {
    const file = new File(["video"], "clip.mp4", { type: "video/mp4", lastModified: 42 });
    const options = buildTusVideoOptions({
      bucket: "session-media",
      path: "member/session/clip.mp4",
      file,
      projectUrl: "https://project-ref.supabase.co",
      accessToken: "token",
      onError: () => {},
      onSuccess: () => {},
    });

    expect(options.chunkSize).toBe(6 * 1024 * 1024);
    expect(options.retryDelays).toEqual([0, 3000, 5000, 10000, 20000]);
    expect(options.headers.authorization).toBe("Bearer token");
    expect(await options.fingerprint(file)).toContain("session-media:member/session/clip.mp4");
  });

  it("turns interrupted network errors into a clear retry message", () => {
    expect(videoUploadError(new Error("Load failed"))).toContain("réessayer");
  });

  it("explains storage file-size rejection", () => {
    expect(videoUploadError(new Error("Payload too large"))).toContain("limite de stockage");
  });

  it("matches the free-tier 50 MB limit in decimal bytes", () => {
    expect(MAX_VIDEO_BYTES).toBe(50_000_000);
  });

  it("recognizes iPhone video extensions even without a MIME type", () => {
    expect(isVideoFile(new File(["video"], "clip.MOV", { type: "" }))).toBe(true);
  });

  it("trusts an explicit image MIME type over a misleading filename", () => {
    expect(isVideoFile(new File(["image"], "photo.mov", { type: "image/jpeg" }))).toBe(false);
  });
});
