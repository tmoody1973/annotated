import { MAX_CLIP_MS } from "./clip-span";

/** A transcript word with millisecond boundaries (from Deepgram or VTT). */
export interface TranscriptWord {
  word: string;
  startMs: number;
  endMs: number;
  speaker?: string;
}

/** The clip span + auto-filled quote derived from a transcript word selection. */
export interface TranscriptSelection {
  clipStartMs: number;
  clipEndMs: number;
  durationMs: number;
  quote: string;
  withinCap: boolean;
}

/**
 * Derives a clip span and verbatim quote from a range of selected transcript
 * words. The span runs from the first selected word's start to the last word's
 * end; the quote is those words joined — never machine-authored. Indices are
 * normalized so a backwards drag works. `withinCap` reflects the SPEC 90s limit.
 */
export function selectClipSpan(
  words: TranscriptWord[],
  indexA: number,
  indexB: number
): TranscriptSelection {
  if (words.length === 0) {
    return { clipStartMs: 0, clipEndMs: 0, durationMs: 0, quote: "", withinCap: false };
  }
  const clamp = (i: number): number => Math.max(0, Math.min(words.length - 1, i));
  const start = Math.min(clamp(indexA), clamp(indexB));
  const end = Math.max(clamp(indexA), clamp(indexB));
  const selected = words.slice(start, end + 1);

  const clipStartMs = selected[0].startMs;
  const clipEndMs = selected[selected.length - 1].endMs;
  const durationMs = clipEndMs - clipStartMs;

  return {
    clipStartMs,
    clipEndMs,
    durationMs,
    quote: selected.map((w) => w.word).join(" "),
    withinCap: durationMs <= MAX_CLIP_MS,
  };
}
