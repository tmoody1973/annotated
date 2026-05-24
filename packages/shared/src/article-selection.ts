/** A highlighted span of article text: the verbatim quote and its char offsets. */
export interface ArticleHighlight {
  selectedText: string;
  textStart: number;
  textEnd: number;
  valid: boolean;
}

/**
 * Derives an article highlight from two character offsets into the cleaned
 * article text. Offsets are normalized (a backwards drag works) and clamped to
 * the text bounds, and the quote is the verbatim substring — never machine
 * authored. `valid` is false when the selection is empty or only whitespace, so
 * the publish path can reject it before writing an annotation.
 */
export function selectArticleHighlight(
  text: string,
  offsetA: number,
  offsetB: number
): ArticleHighlight {
  const clamp = (n: number): number => Math.max(0, Math.min(text.length, n));
  const textStart = Math.min(clamp(offsetA), clamp(offsetB));
  const textEnd = Math.max(clamp(offsetA), clamp(offsetB));
  const selectedText = text.slice(textStart, textEnd);

  return {
    selectedText,
    textStart,
    textEnd,
    valid: selectedText.trim().length > 0,
  };
}
