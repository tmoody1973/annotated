import { describe, expect, it } from "vitest";
import { MAX_CLIP_MS, clipYoutubeBodySchema, evaluateClipSpan } from "./clip-schema.js";

describe("evaluateClipSpan", () => {
  it("accepts a normal span and reports its duration", () => {
    const result = evaluateClipSpan(0, 30_000);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.durationMs).toBe(30_000);
  });

  it("accepts a span exactly at the 90s cap", () => {
    expect(evaluateClipSpan(0, MAX_CLIP_MS).ok).toBe(true);
  });

  it("rejects a span longer than 90s", () => {
    expect(evaluateClipSpan(0, MAX_CLIP_MS + 1).ok).toBe(false);
  });

  it("rejects endMs equal to startMs", () => {
    expect(evaluateClipSpan(5_000, 5_000).ok).toBe(false);
  });

  it("rejects endMs before startMs", () => {
    expect(evaluateClipSpan(10_000, 5_000).ok).toBe(false);
  });
});

describe("clipYoutubeBodySchema", () => {
  it("accepts a valid body", () => {
    expect(
      clipYoutubeBodySchema.safeParse({ videoId: "dQw4w9WgXcQ", startMs: 0, endMs: 30_000 })
        .success
    ).toBe(true);
  });

  it("rejects a missing videoId", () => {
    expect(clipYoutubeBodySchema.safeParse({ startMs: 0, endMs: 30_000 }).success).toBe(false);
  });

  it("rejects a negative startMs", () => {
    expect(
      clipYoutubeBodySchema.safeParse({ videoId: "x", startMs: -1, endMs: 30_000 }).success
    ).toBe(false);
  });

  it("rejects a non-integer endMs", () => {
    expect(
      clipYoutubeBodySchema.safeParse({ videoId: "x", startMs: 0, endMs: 3.5 }).success
    ).toBe(false);
  });
});
