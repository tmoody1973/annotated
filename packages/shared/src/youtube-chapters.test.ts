import { describe, it, expect } from "vitest";
import { parseYoutubeChapters } from "./youtube-chapters";

describe("parseYoutubeChapters", () => {
  it("maps yt-dlp chapter objects to typed chapters in ms", () => {
    const raw = [
      { start_time: 0, end_time: 12.5, title: "Intro" },
      { start_time: 12.5, end_time: 90, title: "Main point" },
    ];
    expect(parseYoutubeChapters(raw)).toEqual([
      { startMs: 0, endMs: 12500, title: "Intro" },
      { startMs: 12500, endMs: 90000, title: "Main point" },
    ]);
  });

  it("returns [] for null, the yt-dlp 'NA' sentinel, undefined, and non-arrays", () => {
    expect(parseYoutubeChapters(null)).toEqual([]);
    expect(parseYoutubeChapters("NA")).toEqual([]);
    expect(parseYoutubeChapters(undefined)).toEqual([]);
    expect(parseYoutubeChapters({})).toEqual([]);
    expect(parseYoutubeChapters([])).toEqual([]);
  });

  it("drops entries missing a start time or a title", () => {
    const raw = [
      { end_time: 10, title: "No start" },
      { start_time: 5, end_time: 10 },
      { start_time: 5, end_time: 10, title: "" },
      { start_time: 0, end_time: 10, title: "Keep" },
    ];
    expect(parseYoutubeChapters(raw)).toEqual([
      { startMs: 0, endMs: 10000, title: "Keep" },
    ]);
  });

  it("drops entries with a missing or non-numeric end time", () => {
    const raw = [
      { start_time: 0, title: "No end" },
      { start_time: 0, end_time: "x", title: "Bad end" },
      { start_time: 0, end_time: 30, title: "Good" },
    ];
    expect(parseYoutubeChapters(raw)).toEqual([
      { startMs: 0, endMs: 30000, title: "Good" },
    ]);
  });

  it("drops zero-duration and reversed chapters (endMs must exceed startMs)", () => {
    const raw = [
      { start_time: 120, end_time: 120, title: "Zero length" },
      { start_time: 120, end_time: 60, title: "Reversed" },
      { start_time: 0, end_time: 30, title: "Good" },
    ];
    expect(parseYoutubeChapters(raw)).toEqual([
      { startMs: 0, endMs: 30000, title: "Good" },
    ]);
  });

  it("trims the title and rounds fractional seconds to integer ms", () => {
    const raw = [{ start_time: 1.2345, end_time: 2.6789, title: "  Spaced  " }];
    expect(parseYoutubeChapters(raw)).toEqual([
      { startMs: 1235, endMs: 2679, title: "Spaced" },
    ]);
  });
});
