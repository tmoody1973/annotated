const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * Compact relative timestamp for clips, Tumblr/X-style: "now" under a minute,
 * then "5m" / "3h" / "2d" up to a week, then an absolute "May 10" (or
 * "Dec 31, 2024" across years). Future timestamps (clock skew) clamp to "now".
 * Uses UTC so output is deterministic regardless of the runtime timezone.
 */
export function formatRelativeTime(timestamp: number, now: number = Date.now()): string {
  const diff = now - timestamp;
  if (diff < MINUTE) return "now";
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h`;
  if (diff < WEEK) return `${Math.floor(diff / DAY)}d`;

  const date = new Date(timestamp);
  const label = `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}`;
  return date.getUTCFullYear() === new Date(now).getUTCFullYear()
    ? label
    : `${label}, ${date.getUTCFullYear()}`;
}
