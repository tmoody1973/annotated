/**
 * Formats a millisecond offset as a clip timestamp: `m:ss` under an hour
 * (e.g. 90000 → "1:30"), `h:mm:ss` at or past an hour (e.g. 3723000 → "1:02:03")
 * so the value round-trips through `clockToMs` for long sources like podcasts.
 */
export function formatClipTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const ss = String(seconds).padStart(2, "0");
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${ss}`;
  }
  return `${minutes}:${ss}`;
}
