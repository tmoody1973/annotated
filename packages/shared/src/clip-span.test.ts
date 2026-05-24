import { describe, expect, it } from "vitest";
import { clockToMs, evaluateClipSpan, MAX_CLIP_MS } from "./clip-span.js";

describe("clockToMs", () => {
  it("parses m:ss into milliseconds", () => {
    expect(clockToMs("1:30")).toBe(90_000);
  });

  it("parses a small m:ss with zero-padded seconds", () => {
    expect(clockToMs("0:05")).toBe(5_000);
  });

  it("parses h:mm:ss for videos over an hour", () => {
    expect(clockToMs("1:02:03")).toBe(3_723_000);
  });

  it("returns null for an empty string", () => {
    expect(clockToMs("")).toBeNull();
  });

  it("returns null for non-numeric input", () => {
    expect(clockToMs("9x")).toBeNull();
  });

  it("returns null when seconds exceed 59", () => {
    expect(clockToMs("1:75")).toBeNull();
  });

  it("returns null for a bare number with no colon", () => {
    expect(clockToMs("90")).toBeNull();
  });

  it("tolerates surrounding and internal whitespace", () => {
    expect(clockToMs("  1:30 ")).toBe(90_000);
  });
});

describe("evaluateClipSpan", () => {
  it("accepts a valid span and returns its duration", () => {
    expect(evaluateClipSpan(1_000, 4_000)).toEqual({
      ok: true,
      durationMs: 3_000,
    });
  });

  it("accepts a span exactly at the 90s cap", () => {
    expect(evaluateClipSpan(0, MAX_CLIP_MS)).toEqual({
      ok: true,
      durationMs: MAX_CLIP_MS,
    });
  });

  it("rejects when end equals start", () => {
    expect(evaluateClipSpan(5_000, 5_000).ok).toBe(false);
  });

  it("rejects when end is before start", () => {
    expect(evaluateClipSpan(10_000, 5_000).ok).toBe(false);
  });

  it("rejects a span longer than the 90s cap", () => {
    expect(evaluateClipSpan(0, MAX_CLIP_MS + 1).ok).toBe(false);
  });
});
