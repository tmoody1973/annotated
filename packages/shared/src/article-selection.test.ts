import { describe, expect, it } from "vitest";
import {
  selectArticleHighlight,
  countWords,
  MAX_QUOTE_WORDS,
} from "./article-selection.js";

const TEXT = "The quick brown fox jumps over the lazy dog.";
const wordsText = (count: number): string =>
  Array.from({ length: count }, (_, i) => `w${i}`).join(" ");

describe("selectArticleHighlight", () => {
  it("extracts the selected substring and its offsets", () => {
    const result = selectArticleHighlight(TEXT, 4, 19);
    expect(result.selectedText).toBe("quick brown fox");
    expect(result.textStart).toBe(4);
    expect(result.textEnd).toBe(19);
    expect(result.valid).toBe(true);
  });

  it("normalizes a backwards selection (a > b)", () => {
    const result = selectArticleHighlight(TEXT, 19, 4);
    expect(result.selectedText).toBe("quick brown fox");
    expect(result.textStart).toBe(4);
    expect(result.textEnd).toBe(19);
    expect(result.valid).toBe(true);
  });

  it("is invalid when the selection is empty", () => {
    const result = selectArticleHighlight(TEXT, 7, 7);
    expect(result.valid).toBe(false);
    expect(result.selectedText).toBe("");
  });

  it("is invalid when the selection is only whitespace", () => {
    const padded = "word   word";
    const result = selectArticleHighlight(padded, 4, 7);
    expect(result.valid).toBe(false);
  });

  it("clamps out-of-bounds offsets to the text length", () => {
    const result = selectArticleHighlight(TEXT, -10, 999);
    expect(result.textStart).toBe(0);
    expect(result.textEnd).toBe(TEXT.length);
    expect(result.selectedText).toBe(TEXT);
    expect(result.valid).toBe(true);
  });

  it("marks a within-limit selection as not clamped", () => {
    const result = selectArticleHighlight(TEXT, 4, 19);
    expect(result.clamped).toBe(false);
  });

  it("clamps a selection longer than the word ceiling at a word boundary", () => {
    const long = wordsText(150);
    const result = selectArticleHighlight(long, 0, long.length);
    expect(result.clamped).toBe(true);
    expect(countWords(result.selectedText)).toBe(MAX_QUOTE_WORDS);
    // Offsets stay consistent so the publish guard's length check passes.
    expect(result.selectedText.length).toBe(result.textEnd - result.textStart);
    // No partial trailing word — ends exactly at the 100th word.
    expect(result.selectedText.endsWith(`w${MAX_QUOTE_WORDS - 1}`)).toBe(true);
    expect(result.valid).toBe(true);
  });

  it("does not clamp a selection exactly at the ceiling", () => {
    const exact = wordsText(MAX_QUOTE_WORDS);
    const result = selectArticleHighlight(exact, 0, exact.length);
    expect(result.clamped).toBe(false);
    expect(countWords(result.selectedText)).toBe(MAX_QUOTE_WORDS);
  });
});

describe("countWords", () => {
  it("counts whitespace-delimited words", () => {
    expect(countWords("the quick brown fox")).toBe(4);
  });
  it("treats runs of whitespace as one separator", () => {
    expect(countWords("  a   b\n\tc  ")).toBe(3);
  });
  it("is 0 for empty or whitespace-only text", () => {
    expect(countWords("")).toBe(0);
    expect(countWords("   \n ")).toBe(0);
  });
});
