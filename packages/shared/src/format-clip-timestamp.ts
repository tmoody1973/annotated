/** Formats a millisecond offset as a clip timestamp like `m:ss` (e.g. 90000 → "1:30"). */
export function formatClipTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
