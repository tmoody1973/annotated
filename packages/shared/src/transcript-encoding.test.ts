import { describe, expect, test } from "vitest";
import { encodeWords, decodeWords } from "./transcript-encoding";
import type { TranscriptWord } from "./transcript-selection";

const words: TranscriptWord[] = [
  { word: "Hello", startMs: 0, endMs: 400, speaker: "0" },
  { word: "there,", startMs: 400, endMs: 900, speaker: "0" },
  { word: "Jason.", startMs: 1200, endMs: 1750, speaker: "1" },
];

describe("encodeWords / decodeWords", () => {
  test("survives a round trip unchanged", () => {
    expect(decodeWords(encodeWords(words))).toEqual(words);
  });

  test("keeps speakers, because badges read them", () => {
    expect(decodeWords(encodeWords(words)).map((w) => w.speaker)).toEqual([
      "0",
      "0",
      "1",
    ]);
  });

  test("omits speaker entirely when the source had none", () => {
    const plain: TranscriptWord[] = [{ word: "Hi", startMs: 0, endMs: 100 }];
    const [only] = decodeWords(encodeWords(plain));
    expect(only).toEqual({ word: "Hi", startMs: 0, endMs: 100 });
    expect("speaker" in only).toBe(false);
  });

  test("handles an empty transcript", () => {
    expect(decodeWords(encodeWords([]))).toEqual([]);
  });

  // The reason this function exists: repeating five key names per word blew a
  // 99-minute episode past Convex's 1MB document limit. Columns beat objects.
  test("is dramatically smaller than one object per word", () => {
    const many: TranscriptWord[] = Array.from({ length: 5_000 }, (_, i) => ({
      word: "word",
      startMs: i * 300,
      endMs: i * 300 + 250,
      speaker: "0",
    }));
    const columnar = encodeWords(many).length;
    const perObject = JSON.stringify(many).length;
    expect(columnar).toBeLessThan(perObject * 0.6);
  });
});

describe("decodeWords back-compatibility", () => {
  // Transcripts already stored in production are a plain array of objects.
  // They must keep working forever — there is no migration.
  test("reads the legacy array-of-objects format", () => {
    const legacy = JSON.stringify([
      { word: "Old", startMs: 0, endMs: 500, speaker: "2", confidence: 0.98 },
    ]);
    expect(decodeWords(legacy)).toEqual([
      { word: "Old", startMs: 0, endMs: 500, speaker: "2" },
    ]);
  });

  test("drops the legacy confidence field, which nothing renders", () => {
    const legacy = JSON.stringify([
      { word: "Old", startMs: 0, endMs: 500, confidence: 0.4 },
    ]);
    expect("confidence" in decodeWords(legacy)[0]).toBe(false);
  });

  test("returns an empty list for unusable input rather than throwing", () => {
    // A transcript row is not worth crashing a landing page over.
    expect(decodeWords("")).toEqual([]);
    expect(decodeWords("not json")).toEqual([]);
    expect(decodeWords("null")).toEqual([]);
    expect(decodeWords('{"v":2}')).toEqual([]);
  });
});
