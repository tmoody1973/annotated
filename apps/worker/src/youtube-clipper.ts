import { execFile } from "node:child_process";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import {
  buildFfmpegArgs,
  buildYtDlpArgs,
  leadingPadMs,
} from "./youtube-clipper-args.js";

const execFileAsync = promisify(execFile);
const BIG_BUFFER = 1024 * 1024 * 64;

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
    await execFileAsync(
      "yt-dlp",
      buildYtDlpArgs(videoId, startMs, endMs, join(workDir, "section.%(ext)s")),
      { maxBuffer: BIG_BUFFER }
    );

    const downloaded = (await readdir(workDir)).find((f) =>
      /\.(mp4|mkv|webm)$/i.test(f)
    );
    if (!downloaded) {
      throw new Error("yt-dlp produced no output file");
    }

    const output = join(workDir, "clip.mp4");
    await execFileAsync(
      "ffmpeg",
      buildFfmpegArgs(
        join(workDir, downloaded),
        output,
        leadingPadMs(startMs),
        endMs - startMs
      ),
      { maxBuffer: BIG_BUFFER }
    );

    return { filePath: output, cleanup };
  } catch (err) {
    await cleanup();
    throw err;
  }
}
