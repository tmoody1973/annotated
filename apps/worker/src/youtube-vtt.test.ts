import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseVttToWords } from "./youtube-vtt.js";

const realAutoVtt = readFileSync(
  new URL("./__fixtures__/youtube-auto-sample.vtt", import.meta.url),
  "utf8"
);

describe("parseVttToWords — real YouTube auto-sub VTT", () => {
  const words = parseVttToWords(realAutoVtt);

  it("extracts one entry per word from the inline timestamps (no rolling dupes)", () => {
    expect(words).toHaveLength(32);
  });

  it("times the leading word at the cue start and each tagged word at its stamp", () => {
    expect(words[0]).toEqual({ word: "this", startMs: 320, endMs: 640 });
    expect(words[5]).toEqual({ word: "course", startMs: 2320, endMs: 2710 });
    expect(words[6]).toEqual({ word: "you", startMs: 2720, endMs: 2879 });
  });

  it("strips all inline tags and never emits empty words", () => {
    for (const w of words) {
      expect(w.word).not.toMatch(/[<>]/);
      expect(w.word.trim().length).toBeGreaterThan(0);
    }
  });

  it("emits words in non-decreasing start order", () => {
    const starts = words.map((w) => w.startMs);
    expect(starts).toEqual([...starts].sort((a, b) => a - b));
  });

  it("skips the plain carry-over and 10ms transition cues", () => {
    const joined = words.map((w) => w.word).join(" ");
    expect(joined.startsWith("this is the beginners JavaScript course you are")).toBe(true);
  });
});

describe("parseVttToWords — manual (cue-level) subs", () => {
  const manual = `WEBVTT

00:00:01.000 --> 00:00:03.000
Hello world

00:00:03.000 --> 00:00:05.000
Hello world

00:00:05.000 --> 00:00:07.000
Second &amp; line
`;

  it("emits one entry per cue, decodes entities, and dedups consecutive repeats", () => {
    expect(parseVttToWords(manual)).toEqual([
      { word: "Hello world", startMs: 1000, endMs: 3000 },
      { word: "Second & line", startMs: 5000, endMs: 7000 },
    ]);
  });

  it("returns [] for empty or non-VTT input", () => {
    expect(parseVttToWords("")).toEqual([]);
    expect(parseVttToWords("not a vtt file")).toEqual([]);
  });
});
