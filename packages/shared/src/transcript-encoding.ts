import type { TranscriptWord } from "./transcript-selection";

/**
 * How a transcript is packed into the single `wordsJson` string on a transcript
 * row.
 *
 * The obvious encoding — one object per word — does not fit. A 99-minute
 * podcast is 17,637 words, and repeating the keys `word`, `startMs`, `endMs`,
 * `speaker` and `confidence` on every one of them costs about 1.5MB against
 * Convex's 1MB document limit. Measured, not guessed: any episode longer than
 * roughly 70 minutes failed to store.
 *
 * So words are stored as columns rather than objects: one list of words, one
 * list of start times. The key names appear once instead of 17,637 times, which
 * takes the same episode to ~480KB. End times are stored as durations because a
 * two-digit delta compresses better than a six-digit absolute.
 *
 * `confidence` is dropped on the way in. Nothing in the product reads it.
 */
interface ColumnarTranscript {
  /** Format marker. Absent (a bare array) means the pre-columnar format. */
  v: 2;
  /** words */
  w: string[];
  /** start times, ms */
  s: number[];
  /** durations, ms — `endMs` is `s[i] + d[i]` */
  d: number[];
  /** speaker labels, `null` where the word had none */
  p: (string | null)[];
}

/** Packs transcript words into the string stored on the transcript row. */
export function encodeWords(words: TranscriptWord[]): string {
  const packed: ColumnarTranscript = {
    v: 2,
    w: words.map((word) => word.word),
    s: words.map((word) => word.startMs),
    d: words.map((word) => word.endMs - word.startMs),
    p: words.map((word) => word.speaker ?? null),
  };
  return JSON.stringify(packed);
}

function isColumnar(value: unknown): value is ColumnarTranscript {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<ColumnarTranscript>;
  return (
    candidate.v === 2 &&
    Array.isArray(candidate.w) &&
    Array.isArray(candidate.s) &&
    Array.isArray(candidate.d) &&
    Array.isArray(candidate.p)
  );
}

/** One word from the pre-columnar format, which is still in production data. */
interface LegacyWord {
  word?: unknown;
  startMs?: unknown;
  endMs?: unknown;
  speaker?: unknown;
}

function fromLegacy(rows: unknown[]): TranscriptWord[] {
  const words: TranscriptWord[] = [];
  for (const row of rows) {
    if (typeof row !== "object" || row === null) continue;
    const { word, startMs, endMs, speaker } = row as LegacyWord;
    if (typeof word !== "string") continue;
    if (typeof startMs !== "number" || typeof endMs !== "number") continue;
    words.push({
      word,
      startMs,
      endMs,
      // `confidence` is deliberately not carried over.
      ...(typeof speaker === "string" ? { speaker } : {}),
    });
  }
  return words;
}

/**
 * Unpacks a stored transcript, in either format.
 *
 * Reads the columnar format written today and the array-of-objects format
 * already sitting in production, so no transcript ever needs migrating. Bad or
 * missing data yields an empty transcript rather than an exception — a landing
 * page should lose its transcript accordion, not fail to render.
 */
export function decodeWords(wordsJson: string): TranscriptWord[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(wordsJson);
  } catch {
    return [];
  }

  if (Array.isArray(parsed)) return fromLegacy(parsed);
  if (!isColumnar(parsed)) return [];

  const { w, s, d, p } = parsed;
  const words: TranscriptWord[] = [];
  for (let index = 0; index < w.length; index += 1) {
    const word = w[index];
    const startMs = s[index];
    const durationMs = d[index];
    const speaker = p[index];
    if (typeof word !== "string") continue;
    if (typeof startMs !== "number" || typeof durationMs !== "number") continue;
    words.push({
      word,
      startMs,
      endMs: startMs + durationMs,
      ...(typeof speaker === "string" ? { speaker } : {}),
    });
  }
  return words;
}
