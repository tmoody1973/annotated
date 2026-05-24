/** SPEC: clips are capped at 90 seconds. */
export const MAX_CLIP_MS = 90_000;

const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const MS_PER_SECOND = 1_000;

function isWholeNumber(part: string): boolean {
  return /^\d+$/.test(part);
}

/**
 * Parses a `m:ss` or `h:mm:ss` clock string into milliseconds, returning null
 * for anything malformed. Sexagesimal parts (minutes, seconds) must be 0–59;
 * a bare number with no colon is rejected so the input stays unambiguous.
 */
export function clockToMs(clock: string): number | null {
  const parts = clock.split(":").map((part) => part.trim());
  if (parts.length < 2 || parts.length > 3) return null;
  if (!parts.every(isWholeNumber)) return null;

  const numbers = parts.map(Number);
  const seconds = numbers[numbers.length - 1];
  const minutes = numbers[numbers.length - 2];
  const hours = numbers.length === 3 ? numbers[0] : 0;

  if (seconds >= SECONDS_PER_MINUTE) return null;
  if (minutes >= MINUTES_PER_HOUR) return null;

  const totalSeconds =
    hours * MINUTES_PER_HOUR * SECONDS_PER_MINUTE +
    minutes * SECONDS_PER_MINUTE +
    seconds;
  return totalSeconds * MS_PER_SECOND;
}

export type ClipSpanResult =
  | { ok: true; durationMs: number }
  | { ok: false; error: string };

/**
 * Validates a clip span against the SPEC 90s cap and ordering. Pure — callers
 * use it to gate publishing before any download work begins. Mirrors the
 * worker's server-side check so client and server agree on what is valid.
 */
export function evaluateClipSpan(startMs: number, endMs: number): ClipSpanResult {
  if (endMs <= startMs) {
    return { ok: false, error: "End must be after start" };
  }
  const durationMs = endMs - startMs;
  if (durationMs > MAX_CLIP_MS) {
    return { ok: false, error: `Clip exceeds the ${MAX_CLIP_MS / 1000}s limit` };
  }
  return { ok: true, durationMs };
}
