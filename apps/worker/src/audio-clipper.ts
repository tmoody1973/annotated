import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const MAX_CLIP_SECONDS = 90;
const BIG_BUFFER = 1024 * 1024 * 64;

export interface ClipFile {
  filePath: string;
  cleanup: () => Promise<void>;
}

/** ffmpeg timestamp HH:MM:SS for the -ss/-t flags. */
function toTimestamp(totalSeconds: number): string {
  const whole = Math.max(0, Math.floor(totalSeconds));
  const hh = Math.floor(whole / 3600);
  const mm = Math.floor((whole % 3600) / 60);
  const ss = whole % 60;
  return [hh, mm, ss].map((n) => String(n).padStart(2, "0")).join(":");
}

/**
 * Follows the enclosure's redirect chain (Podtrac/Chartable/simplecast prefixes)
 * to the terminal MP3 URL via curl — a single ranged byte request that returns
 * only the final URL, never the body. We use curl rather than fetch because
 * undici stalls indefinitely on some tracking-prefix redirect chains that curl
 * resolves in well under a second. Falls back to the original URL on any error.
 */
export async function resolveFinalUrl(url: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync(
      "curl",
      ["-sL", "-r", "0-0", "-m", "8", "-o", "/dev/null", "-w", "%{url_effective}", url],
      { maxBuffer: BIG_BUFFER }
    );
    return stdout.trim() || url;
  } catch {
    return url;
  }
}

/**
 * Produces a ≤90s mp3 clip of a podcast episode span. We resolve the tracking
 * redirect first, then ffmpeg input-seeks the real URL (`-ss` before `-i`) and
 * stream-copies the audio — so only the requested range is fetched, never the
 * whole episode. Work happens in a temp dir the caller must `cleanup()`.
 */
export async function clipAudio(
  mp3Url: string,
  startMs: number,
  endMs: number
): Promise<ClipFile> {
  const workDir = await mkdtemp(join(tmpdir(), "audio-clip-"));
  const cleanup = (): Promise<void> => rm(workDir, { recursive: true, force: true });

  try {
    const finalUrl = await resolveFinalUrl(mp3Url);
    const startSec = startMs / 1000;
    const durationSec = Math.min((endMs - startMs) / 1000, MAX_CLIP_SECONDS);
    const output = join(workDir, "clip.mp3");

    await execFileAsync(
      "ffmpeg",
      [
        "-y",
        // Input/network options (before -i): tolerate dropped connections and
        // cap socket waits so a stalled CDN fails fast instead of hanging.
        "-reconnect",
        "1",
        "-reconnect_streamed",
        "1",
        "-reconnect_delay_max",
        "5",
        "-rw_timeout",
        "30000000",
        "-ss",
        toTimestamp(startSec),
        "-i",
        finalUrl,
        "-t",
        String(durationSec),
        "-c",
        "copy",
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
