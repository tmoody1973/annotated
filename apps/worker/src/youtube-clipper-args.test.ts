import { describe, expect, it } from "vitest";
import { buildFfmpegArgs, buildYtDlpArgs, PAD_MS } from "./youtube-clipper-args.js";

describe("buildYtDlpArgs", () => {
  it("does not force keyframes at cuts", () => {
    const args = buildYtDlpArgs("abc123", 60_000, 90_000, "/tmp/x/section.%(ext)s");
    expect(args).not.toContain("--force-keyframes-at-cuts");
  });

  it("downloads a padded section so ffmpeg can trim to the exact start", () => {
    const args = buildYtDlpArgs("abc123", 60_000, 90_000, "/tmp/x/section.%(ext)s");
    const section = args[args.indexOf("--download-sections") + 1];
    // 60s - 3s pad = 57s = 00:00:57.000 ; end 90s + 3s = 93s = 00:01:33.000
    expect(section).toBe("*00:00:57.000-00:01:33.000");
  });

  it("clamps the leading pad at the start of the video", () => {
    const args = buildYtDlpArgs("abc123", 1_000, 30_000, "/tmp/x/section.%(ext)s");
    const section = args[args.indexOf("--download-sections") + 1];
    expect(section).toBe("*00:00:00.000-00:00:33.000");
  });

  it("keeps the 360p format cap and mp4 merge", () => {
    const args = buildYtDlpArgs("abc123", 0, 30_000, "/tmp/x/section.%(ext)s");
    expect(args).toContain("bv*[height<=360]+ba/b[height<=360]/b");
    expect(args).toContain("--merge-output-format");
  });
});

describe("buildFfmpegArgs", () => {
  it("seeks by the actual pad that was applied, not the nominal pad", () => {
    // startMs 1_000 < PAD_MS, so only 1s of pad exists in the downloaded file
    const args = buildFfmpegArgs("/tmp/in.mp4", "/tmp/out.mp4", 1_000, 29_000);
    expect(args[args.indexOf("-ss") + 1]).toBe("1.000");
  });

  it("puts -ss before -i so the seek is fast", () => {
    const args = buildFfmpegArgs("/tmp/in.mp4", "/tmp/out.mp4", PAD_MS, 30_000);
    expect(args.indexOf("-ss")).toBeLessThan(args.indexOf("-i"));
  });

  it("caps duration at the 90s clip limit", () => {
    const args = buildFfmpegArgs("/tmp/in.mp4", "/tmp/out.mp4", PAD_MS, 120_000);
    expect(args[args.indexOf("-t") + 1]).toBe("90.000");
  });

  it("keeps the 240p downscale and faststart", () => {
    const args = buildFfmpegArgs("/tmp/in.mp4", "/tmp/out.mp4", PAD_MS, 30_000);
    expect(args).toContain("scale=-2:240");
    expect(args).toContain("+faststart");
  });
});

describe("the keyframe fallback", () => {
  it("omits --force-keyframes-at-cuts on the fast path", () => {
    const args = buildYtDlpArgs("abc", 120_000, 180_000, "/tmp/s.%(ext)s");
    expect(args).not.toContain("--force-keyframes-at-cuts");
  });

  it("adds it only when the fast path is being retried", () => {
    const args = buildYtDlpArgs("abc", 120_000, 180_000, "/tmp/s.%(ext)s", {
      forceKeyframes: true,
    });
    expect(args).toContain("--force-keyframes-at-cuts");
  });

  it("changes nothing else about the command", () => {
    const fast = buildYtDlpArgs("abc", 120_000, 180_000, "/tmp/s.%(ext)s");
    const slow = buildYtDlpArgs("abc", 120_000, 180_000, "/tmp/s.%(ext)s", {
      forceKeyframes: true,
    });
    expect(slow.filter((a) => a !== "--force-keyframes-at-cuts")).toEqual(fast);
  });
});
