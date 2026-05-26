import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type { ClipFile } from "./audio-clipper.js";

const execFileAsync = promisify(execFile);
const BIG_BUFFER = 1024 * 1024 * 64;

/**
 * Audio filter chain that makes a take "sound like a podcast, not a voicemail"
 * (gap §7): trim leading then trailing near-silence (the reverse trick — trim
 * the front, reverse, trim the new front which was the tail, reverse back),
 * then normalize to EBU R128 podcast loudness (~-16 LUFS) so every clip plays
 * back at a consistent, produced level.
 */
const SILENCE_TRIM =
  "silenceremove=start_periods=1:start_silence=0.1:start_threshold=-50dB:detection=peak";
export const COMMENTARY_FILTER_CHAIN = [
  SILENCE_TRIM,
  "areverse",
  SILENCE_TRIM,
  "areverse",
  "loudnorm=I=-16:TP=-1.5:LRA=11",
].join(",");

/**
 * Transcodes a recorded voice-commentary blob (webm/opus from the extension's
 * MediaRecorder) to mp3 for universal landing-page playback — Safari can't play
 * webm/opus in an <audio>. Applies the silence-trim + loudness-normalize filter
 * chain so output is clean and consistently loud. Work happens in a temp dir the
 * caller must `cleanup()`; on any failure the dir is removed before rethrowing.
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
      [
        "-y",
        "-i",
        input,
        "-vn",
        "-af",
        COMMENTARY_FILTER_CHAIN,
        "-c:a",
        "libmp3lame",
        "-q:a",
        "4",
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
