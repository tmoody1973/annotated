import { describe, expect, it } from "vitest";
import type { SyncPrerecordedResponse } from "@deepgram/sdk";
import { mapDeepgramResult } from "./transcript-mapper.js";

/**
 * Builds a minimal Deepgram sync response carrying just the words we care about,
 * so each test states only the word shapes under test.
 */
function responseWithWords(
  words: Array<Record<string, unknown>>
): SyncPrerecordedResponse {
  return {
    results: { channels: [{ alternatives: [{ words }] }] },
  } as unknown as SyncPrerecordedResponse;
}

describe("mapDeepgramResult", () => {
  it("converts second timestamps to integer milliseconds", () => {
    const words = mapDeepgramResult(
      responseWithWords([
        { word: "hello", start: 1.2, end: 1.74, confidence: 0.99 },
      ])
    );
    expect(words[0]?.startMs).toBe(1200);
    expect(words[0]?.endMs).toBe(1740);
  });

  it("rounds fractional milliseconds to the nearest integer", () => {
    const words = mapDeepgramResult(
      responseWithWords([
        { word: "x", start: 0.0001, end: 0.0006, confidence: 0.5 },
      ])
    );
    expect(words[0]?.startMs).toBe(0);
    expect(words[0]?.endMs).toBe(1);
  });

  it("prefers the punctuated word for readable display", () => {
    const words = mapDeepgramResult(
      responseWithWords([
        { word: "hello", punctuated_word: "Hello,", start: 0, end: 0.5, confidence: 0.9 },
      ])
    );
    expect(words[0]?.word).toBe("Hello,");
  });

  it("falls back to the raw word when no punctuated form exists", () => {
    const words = mapDeepgramResult(
      responseWithWords([{ word: "hello", start: 0, end: 0.5, confidence: 0.9 }])
    );
    expect(words[0]?.word).toBe("hello");
  });

  it("maps the diarized speaker number to a string", () => {
    const words = mapDeepgramResult(
      responseWithWords([
        { word: "hi", start: 0, end: 0.3, confidence: 0.9, speaker: 0 },
        { word: "there", start: 0.3, end: 0.6, confidence: 0.9, speaker: 1 },
      ])
    );
    expect(words[0]?.speaker).toBe("0");
    expect(words[1]?.speaker).toBe("1");
  });

  it("omits speaker when diarization is absent", () => {
    const words = mapDeepgramResult(
      responseWithWords([{ word: "hi", start: 0, end: 0.3, confidence: 0.9 }])
    );
    expect(words[0]?.speaker).toBeUndefined();
  });

  it("carries per-word confidence through", () => {
    const words = mapDeepgramResult(
      responseWithWords([{ word: "hi", start: 0, end: 0.3, confidence: 0.42 }])
    );
    expect(words[0]?.confidence).toBe(0.42);
  });

  it("returns an empty array when the response has no words", () => {
    expect(mapDeepgramResult(responseWithWords([]))).toEqual([]);
  });

  it("returns an empty array when channels or alternatives are missing", () => {
    const empty = { results: { channels: [] } } as unknown as SyncPrerecordedResponse;
    expect(mapDeepgramResult(empty)).toEqual([]);
  });
});
