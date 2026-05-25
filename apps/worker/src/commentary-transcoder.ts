import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type { ClipFile } from "./audio-clipper.js";

const execFileAsync = promisify(execFile);
const BIG_BUFFER = 1024 * 1024 * 64;

/**
 * Transcodes a recorded voice-commentary blob (webm/opus from the extension's
 * MediaRecorder) to mp3 for universal landing-page playback — Safari can't play
 * webm/opus in an <audio>. Work happens in a temp dir the caller must
 * `cleanup()`; on any failure the dir is removed before rethrowing.
 */
export async function transcodeToMp3(audioBytes: Buffer): Promise<ClipFile> {
  const workDir = await mkdtemp(join(tmpdir(), "commentary-"));
  const cleanup = (): Promise<void> => rm(workDir, { recursive: true, force: true });

  try {
    const input = join(workDir, "input");
    const output = join(workDir, "commentary.mp3");
    await writeFile(input, audioBytes);

    await execFileAsync(
      "ffmpeg",
      ["-y", "-i", input, "-vn", "-c:a", "libmp3lame", "-q:a", "4", output],
      { maxBuffer: BIG_BUFFER }
    );

    return { filePath: output, cleanup };
  } catch (err) {
    await cleanup();
    throw err;
  }
}
