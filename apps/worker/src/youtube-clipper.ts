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
    // Fast path first, then the slow-but-reliable one. See buildYtDlpArgs:
    // yt-dlp's section cut fails on some videos depending where the span
    // starts, and re-encoding around the keyframes gets those through.
    let downloaded: string | undefined;
    let firstError: unknown;
    for (const forceKeyframes of [false, true]) {
      try {
        await execFileAsync(
          "yt-dlp",
          buildYtDlpArgs(videoId, startMs, endMs, join(workDir, "section.%(ext)s"), {
            forceKeyframes,
          }),
          { maxBuffer: BIG_BUFFER }
        );
      } catch (err) {
        firstError ??= err;
        continue;
      }
      downloaded = (await readdir(workDir)).find((f) => /\.(mp4|mkv|webm)$/i.test(f));
      if (downloaded) break;
      firstError ??= new Error("yt-dlp produced no output file");
    }
    if (!downloaded) {
      throw firstError ?? new Error("yt-dlp produced no output file");
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
