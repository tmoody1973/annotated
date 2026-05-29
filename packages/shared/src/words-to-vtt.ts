export interface CaptionWord {
  word: string;
  startMs: number;
  endMs: number;
}

const MAX_WORDS_PER_CUE = 7;
const MAX_CUE_MS = 4_000;

/** Formats a millisecond offset as a WebVTT timestamp: HH:MM:SS.mmm. */
function formatVttTime(ms: number): string {
  const clamped = Math.max(0, Math.round(ms));
  const hours = Math.floor(clamped / 3_600_000);
  const minutes = Math.floor((clamped % 3_600_000) / 60_000);
  const seconds = Math.floor((clamped % 60_000) / 1_000);
  const millis = clamped % 1_000;
  const pad = (n: number, width = 2) => String(n).padStart(width, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}.${pad(millis, 3)}`;
}

/**
 * Builds a WebVTT captions track for a clip from its (already clip-windowed)
 * transcript words. Timings are made relative to the clip start (so they line up
 * with a clip that plays from 0) and clamped to non-negative. Words are grouped
 * into short cues (by a word cap and a max duration) for readable on-screen
 * captions. Returns just the `WEBVTT` header when there are no words.
 */
interface Cue {
  words: string[];
  startMs: number;
  endMs: number;
}

export function wordsToVtt(words: CaptionWord[], clipStartMs: number): string {
  const cues: Cue[] = [];
  let current: Cue | null = null;

  for (const word of words) {
    const tooLong = current !== null && word.endMs - current.startMs > MAX_CUE_MS;
    const full = current !== null && current.words.length >= MAX_WORDS_PER_CUE;
    if (current === null || tooLong || full) {
      if (current !== null) cues.push(current);
      current = { words: [word.word], startMs: word.startMs, endMs: word.endMs };
    } else {
      current.words.push(word.word);
      current.endMs = word.endMs;
    }
  }
  if (current !== null) cues.push(current);

  if (cues.length === 0) return "WEBVTT\n";

  const blocks = cues.map((cue) => {
    const start = formatVttTime(cue.startMs - clipStartMs);
    const end = formatVttTime(cue.endMs - clipStartMs);
    return `${start} --> ${end}\n${cue.words.join(" ")}`;
  });
  return `WEBVTT\n\n${blocks.join("\n\n")}\n`;
}
