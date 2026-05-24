import { describe, expect, it } from "vitest";
import { selectArticleHighlight } from "./article-selection.js";

const TEXT = "The quick brown fox jumps over the lazy dog.";

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
});
