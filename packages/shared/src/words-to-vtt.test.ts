import { describe, expect, it } from "vitest";
import { wordsToVtt } from "./words-to-vtt";

const w = (word: string, startMs: number, endMs: number) => ({ word, startMs, endMs });

describe("wordsToVtt", () => {
  it("returns a bare header when there are no words", () => {
    expect(wordsToVtt([], 0)).toBe("WEBVTT\n");
  });

  it("emits clip-relative cue timings (subtracts clipStartMs, clamps to 0)", () => {
    const words = [w("hello", 60_000, 60_500), w("world", 60_500, 61_000)];
    const vtt = wordsToVtt(words, 60_000);
    expect(vtt.startsWith("WEBVTT\n")).toBe(true);
    expect(vtt).toContain("00:00:00.000 --> 00:00:01.000");
    expect(vtt).toContain("hello world");
  });

  it("formats hours/minutes/seconds/millis correctly", () => {
    const vtt = wordsToVtt([w("late", 3_725_500, 3_726_000)], 0);
    // 3,725,500ms = 1h 02m 05.500s
    expect(vtt).toContain("01:02:05.500 --> 01:02:06.000");
  });

  it("splits into multiple cues past the word cap", () => {
    const words = Array.from({ length: 9 }, (_, i) => w(`w${i}`, i * 400, i * 400 + 350));
    const vtt = wordsToVtt(words, 0);
    const cueCount = (vtt.match(/-->/g) ?? []).length;
    expect(cueCount).toBeGreaterThanOrEqual(2);
  });

  it("never emits negative timestamps for words before the clip start", () => {
    const vtt = wordsToVtt([w("early", 100, 600)], 1_000);
    // A dash followed by a digit would be a negative timestamp (the "-->" cue
    // arrow is fine — no digit follows it).
    expect(/-\d/.test(vtt)).toBe(false);
    expect(vtt).toContain("00:00:00.000");
  });
});
