import { describe, it, expect } from "vitest";
import { sliceTranscriptToSpan } from "./youtube-vtt";

describe("sliceTranscriptToSpan", () => {
  const words = [
    { word: "a", startMs: 0, endMs: 1000 },
    { word: "b", startMs: 1000, endMs: 2000 },
    { word: "c", startMs: 2000, endMs: 3000 },
    { word: "d", startMs: 3000, endMs: 4000 },
  ];

  it("returns words overlapping the span (partial overlap included)", () => {
    expect(sliceTranscriptToSpan(words, 1500, 3000)).toEqual([
      { word: "b", startMs: 1000, endMs: 2000 },
      { word: "c", startMs: 2000, endMs: 3000 },
    ]);
  });

  it("returns [] when nothing overlaps", () => {
    expect(sliceTranscriptToSpan(words, 5000, 6000)).toEqual([]);
  });
});
