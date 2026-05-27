const MS_PER_SECOND = 1_000;

/** A YouTube video chapter, normalized to integer milliseconds. */
export interface Chapter {
  startMs: number;
  endMs: number;
  title: string;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toMs(seconds: unknown): number | null {
  if (typeof seconds !== "number" || !Number.isFinite(seconds)) return null;
  return Math.round(seconds * MS_PER_SECOND);
}

/**
 * Maps yt-dlp's `chapters` metadata (an array of `{start_time,end_time,title}`
 * in seconds) to typed Chapters in ms. Defensive at the trust boundary: the
 * `--print "%(chapters)j"` output may be the literal string "NA", null, or
 * malformed, so anything that isn't a well-formed entry is dropped and a video
 * with no chapters yields an empty array.
 */
export function parseYoutubeChapters(raw: unknown): Chapter[] {
  if (!Array.isArray(raw)) return [];

  const chapters: Chapter[] = [];
  for (const entry of raw) {
    if (!isObject(entry)) continue;

    const startMs = toMs(entry.start_time);
    const endMs = toMs(entry.end_time);
    const title = typeof entry.title === "string" ? entry.title.trim() : "";

    if (startMs === null || endMs === null || title.length === 0) continue;
    // A chapter with no positive duration can't seed a clip span; drop it so it
    // never renders as a tappable-but-unpublishable row.
    if (endMs <= startMs) continue;

    chapters.push({ startMs, endMs, title });
  }
  return chapters;
}
