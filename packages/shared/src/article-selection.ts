/** Fair-use excerpt ceiling: an article highlight is a quote, not a reprint. */
export const MAX_QUOTE_WORDS = 100;

/** A highlighted span of article text: the verbatim quote and its char offsets. */
export interface ArticleHighlight {
  selectedText: string;
  textStart: number;
  textEnd: number;
  valid: boolean;
  /** True when the selection was truncated to MAX_QUOTE_WORDS (fair-use ceiling). */
  clamped: boolean;
}

/** Counts whitespace-delimited words in a string. */
export function countWords(text: string): number {
  const matches = text.match(/\S+/g);
  return matches ? matches.length : 0;
}

/**
 * Truncates text to the end of its `maxWords`-th word (no partial trailing word,
 * no trailing whitespace), so char offsets stay exact. `clamped` is false when
 * the text is already within the limit.
 */
function clampToWordLimit(
  text: string,
  maxWords: number
): { text: string; clamped: boolean } {
  const matches = [...text.matchAll(/\S+/g)];
  const lastWord = matches[maxWords - 1];
  if (matches.length <= maxWords || !lastWord) return { text, clamped: false };
  const endIndex = (lastWord.index ?? 0) + lastWord[0].length;
  return { text: text.slice(0, endIndex), clamped: true };
}

/**
 * Derives an article highlight from two character offsets into the cleaned
 * article text. Offsets are normalized (a backwards drag works) and clamped to
 * the text bounds, and the quote is the verbatim substring — never machine
 * authored. A selection longer than MAX_QUOTE_WORDS is truncated at a word
 * boundary (fair-use ceiling) with `clamped: true` and `textEnd` adjusted to
 * match, so the UI can stop gracefully instead of erroring. `valid` is false
 * when the selection is empty or only whitespace, so the publish path can reject
 * it before writing an annotation.
 */
export function selectArticleHighlight(
  text: string,
  offsetA: number,
  offsetB: number
): ArticleHighlight {
  const clamp = (n: number): number => Math.max(0, Math.min(text.length, n));
  const textStart = Math.min(clamp(offsetA), clamp(offsetB));
  const rawEnd = Math.max(clamp(offsetA), clamp(offsetB));
  const { text: selectedText, clamped } = clampToWordLimit(
    text.slice(textStart, rawEnd),
    MAX_QUOTE_WORDS
  );

  return {
    selectedText,
    textStart,
    textEnd: textStart + selectedText.length,
    valid: selectedText.trim().length > 0,
    clamped,
  };
}
