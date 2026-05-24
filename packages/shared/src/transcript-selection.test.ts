import { describe, expect, it } from "vitest";
import { selectClipSpan, type TranscriptWord } from "./transcript-selection.js";

const words: TranscriptWord[] = [
  { word: "The", startMs: 1000, endMs: 1200 },
  { word: "quick", startMs: 1200, endMs: 1600 },
  { word: "brown", startMs: 1600, endMs: 2000 },
  { word: "fox", startMs: 2000, endMs: 2400 },
  { word: "jumps", startMs: 2400, endMs: 2800 },
];

describe("selectClipSpan", () => {
  it("uses the first selected word's start and the last word's end", () => {
    const span = selectClipSpan(words, 1, 3);
    expect(span.clipStartMs).toBe(1200);
    expect(span.clipEndMs).toBe(2400);
  });

  it("auto-fills the verbatim quote from the selected words", () => {
    expect(selectClipSpan(words, 1, 3).quote).toBe("quick brown fox");
  });

  it("normalizes a reversed selection (end before start)", () => {
    const span = selectClipSpan(words, 3, 1);
    expect(span.clipStartMs).toBe(1200);
    expect(span.clipEndMs).toBe(2400);
    expect(span.quote).toBe("quick brown fox");
  });

  it("supports a single-word selection", () => {
    const span = selectClipSpan(words, 2, 2);
    expect(span.clipStartMs).toBe(1600);
    expect(span.clipEndMs).toBe(2000);
    expect(span.quote).toBe("brown");
  });

  it("flags a selection within the 90s cap", () => {
    expect(selectClipSpan(words, 0, 4).withinCap).toBe(true);
  });

  it("returns a safe empty selection for an empty transcript", () => {
    const span = selectClipSpan([], 0, 0);
    expect(span.quote).toBe("");
    expect(span.withinCap).toBe(false);
    expect(span.clipStartMs).toBe(0);
    expect(span.clipEndMs).toBe(0);
  });

  it("clamps out-of-range indices to the available words", () => {
    const span = selectClipSpan(words, 0, 99);
    expect(span.clipStartMs).toBe(1000);
    expect(span.clipEndMs).toBe(2800);
  });

  it("flags a selection that exceeds the 90s cap", () => {
    const long: TranscriptWord[] = [
      { word: "a", startMs: 0, endMs: 100 },
      { word: "b", startMs: 95_000, endMs: 95_500 },
    ];
    const span = selectClipSpan(long, 0, 1);
    expect(span.withinCap).toBe(false);
  });
});
