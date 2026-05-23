import { execFile } from "node:child_process";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const CLIP_HEIGHT = 240;
const MAX_CLIP_SECONDS = 90;
const BIG_BUFFER = 1024 * 1024 * 64;

function toTimestamp(totalSeconds: number): string {
  const whole = Math.max(0, Math.floor(totalSeconds));
  const hh = Math.floor(whole / 3600);
  const mm = Math.floor((whole % 3600) / 60);
  const ss = whole % 60;
  return [hh, mm, ss].map((n) => String(n).padStart(2, "0")).join(":");
}

export interface ClipFile {
  filePath: string;
  cleanup: () => Promise<void>;
}

/**
 * Produces a ≤90s, 240p mp4 clip of a YouTube video span. yt-dlp downloads only
 * the requested section (fast, no full-video fetch); ffmpeg then enforces the
 * exact duration cap, scales to 240p, and re-encodes to a clean H.264/AAC mp4.
 * Work happens in an isolated temp dir the caller must `cleanup()`.
 */
export async function clipYoutubeVideo(
  videoId: string,
  startMs: number,
  endMs: number
): Promise<ClipFile> {
  const workDir = await mkdtemp(join(tmpdir(), "clip-"));
  const cleanup = (): Promise<void> =>
    rm(workDir, { recursive: true, force: true });

  try {
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    const startSec = startMs / 1000;
    const endSec = endMs / 1000;

    await execFileAsync(
      "yt-dlp",
      [
        "--no-playlist",
        "--quiet",
        "--no-warnings",
        "--force-keyframes-at-cuts",
        "--download-sections",
        `*${toTimestamp(startSec)}-${toTimestamp(endSec)}`,
        "-f",
        "bv*[height<=360]+ba/b[height<=360]/b",
        "--merge-output-format",
        "mp4",
        "-o",
        join(workDir, "section.%(ext)s"),
        url,
      ],
      { maxBuffer: BIG_BUFFER }
    );

    const downloaded = (await readdir(workDir)).find((f) =>
      /\.(mp4|mkv|webm)$/i.test(f)
    );
    if (!downloaded) {
      throw new Error("yt-dlp produced no output file");
    }

    const durationSec = Math.min(endSec - startSec, MAX_CLIP_SECONDS);
    const output = join(workDir, "clip.mp4");
    await execFileAsync(
      "ffmpeg",
      [
        "-y",
        "-i",
        join(workDir, downloaded),
        "-t",
        String(durationSec),
        "-vf",
        `scale=-2:${CLIP_HEIGHT}`,
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-c:a",
        "aac",
        "-movflags",
        "+faststart",
        output,
      ],
      { maxBuffer: BIG_BUFFER }
    );

    return { filePath: output, cleanup };
  } catch (err) {
    await cleanup();
    throw err;
  }
}
