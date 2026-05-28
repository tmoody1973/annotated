import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const BIG_BUFFER = 1024 * 1024 * 8;
// A chapters lookup is metadata-only and normally returns in a few seconds. When
// YouTube rate-limits/bot-challenges the request, yt-dlp can hang indefinitely;
// cap it so the request fails fast and the UI degrades to "no chapters" instead
// of leaving the panel waiting.
const CHAPTERS_TIMEOUT_MS = 20_000;

/**
 * Reads a YouTube video's chapter metadata via yt-dlp WITHOUT downloading the
 * video — `--skip-download` plus `--print "%(chapters)j"` makes this a cheap
 * metadata-only fetch. Returns the parsed JSON value (an array, the literal
 * "NA", or null); the caller normalizes it via parseYoutubeChapters.
 */
export async function fetchChaptersRaw(videoId: string): Promise<unknown> {
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  const { stdout } = await execFileAsync(
    "yt-dlp",
    [
      "--no-playlist",
      "--skip-download",
      "--no-warnings",
      "--quiet",
      "--print",
      "%(chapters)j",
      url,
    ],
    { maxBuffer: BIG_BUFFER, timeout: CHAPTERS_TIMEOUT_MS }
  );

  const trimmed = stdout.trim();
  if (trimmed.length === 0 || trimmed === "NA") return null;

  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}
