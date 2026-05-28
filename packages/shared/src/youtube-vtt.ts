import type { TranscriptWord } from "./transcript-selection";

/**
 * Returns the transcript words overlapping [startMs, endMs] (partial overlaps
 * included). Used at render time to show only the words spoken within a clip's
 * span — the worker parses + stores the full word list (provider youtube-vtt).
 */
export function sliceTranscriptToSpan(
  words: TranscriptWord[],
  startMs: number,
  endMs: number
): TranscriptWord[] {
  return words.filter((word) => word.endMs > startMs && word.startMs < endMs);
}
