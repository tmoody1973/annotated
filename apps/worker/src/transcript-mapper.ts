import type { SyncPrerecordedResponse } from "@deepgram/sdk";

/** A transcript word in the shape the Convex `transcripts` schema stores. */
export interface TranscriptWord {
  word: string;
  startMs: number;
  endMs: number;
  speaker?: string;
  confidence?: number;
}

const SECONDS_TO_MS = 1000;

/**
 * Maps a Deepgram sync prerecorded response to the Convex transcript word shape.
 *
 * Deepgram reports times in seconds and speakers as numbers; the schema wants
 * integer milliseconds and string speaker labels. Display prefers the
 * punctuated form when smart formatting produced one. Missing channels,
 * alternatives, or words yield an empty array rather than throwing.
 */
export function mapDeepgramResult(
  result: SyncPrerecordedResponse
): TranscriptWord[] {
  const words = result.results?.channels?.[0]?.alternatives?.[0]?.words ?? [];

  return words.map((word) => ({
    word: word.punctuated_word ?? word.word,
    startMs: Math.round(word.start * SECONDS_TO_MS),
    endMs: Math.round(word.end * SECONDS_TO_MS),
    ...(word.speaker !== undefined ? { speaker: String(word.speaker) } : {}),
    confidence: word.confidence,
  }));
}
