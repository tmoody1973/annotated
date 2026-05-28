import { execFile } from "node:child_process";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const BIG_BUFFER = 1024 * 1024 * 8;
// Captions are metadata-only; cap the call so a throttled/challenged yt-dlp
// fails fast and the transcript degrades to "absent" instead of hanging.
const SUBS_TIMEOUT_MS = 25_000;

/**
 * Fetches a YouTube video's English captions as raw WebVTT via yt-dlp, WITHOUT
 * downloading the video (`--skip-download`). Prefers manual subs, falls back to
 * auto-generated. Returns the raw VTT text, or null when the video has no
 * English captions. Throws only on an actual yt-dlp failure. The temp dir is
 * always cleaned up.
 */
export async function fetchYoutubeSubsVtt(videoId: string): Promise<string | null> {
  const workDir = await mkdtemp(join(tmpdir(), "subs-"));
  try {
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    await execFileAsync(
      "yt-dlp",
      [
        "--no-playlist",
        "--skip-download",
        "--no-warnings",
        "--quiet",
        "--write-subs",
        "--write-auto-subs",
        "--sub-langs",
        "en.*,en",
        "--sub-format",
        "vtt",
        "-o",
        join(workDir, "subs"),
        url,
      ],
      { maxBuffer: BIG_BUFFER, timeout: SUBS_TIMEOUT_MS }
    );

    const vttFiles = (await readdir(workDir)).filter((f) => /\.vtt$/i.test(f));
    if (vttFiles.length === 0) return null; // no English captions for this video

    // readdir order is filesystem-dependent and multiple tracks (en, en-US, auto)
    // may land — prefer the base English track deterministically.
    const chosen = vttFiles.find((f) => /\.en\.vtt$/i.test(f)) ?? vttFiles.sort()[0]!;
    return await readFile(join(workDir, chosen), "utf8");
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}
