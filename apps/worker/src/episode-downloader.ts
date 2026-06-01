import { execFile } from "node:child_process";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const BIG_BUFFER = 1024 * 1024 * 64;
const DOWNLOAD_TIMEOUT_SECONDS = 120;

export interface DownloadedEpisode {
  filePath: string;
  cleanup: () => Promise<void>;
}

/**
 * Downloads a podcast enclosure to a temp file ONCE, following tracking-prefix
 * redirects with curl (undici stalls on some of them). The caller both
 * transcribes and stores this single file, so the clip is later cut from the
 * exact same bytes — the fix for dynamic-ad-insertion drift between a podcast
 * clip's transcript and its audio. The caller must `cleanup()`.
 */
export async function downloadEpisode(mp3Url: string): Promise<DownloadedEpisode> {
  const workDir = await mkdtemp(join(tmpdir(), "episode-"));
  const filePath = join(workDir, "episode.mp3");
  const cleanup = (): Promise<void> => rm(workDir, { recursive: true, force: true });
  try {
    await execFileAsync(
      "curl",
      ["-sL", "--fail", "--max-time", String(DOWNLOAD_TIMEOUT_SECONDS), "-o", filePath, mp3Url],
      { maxBuffer: BIG_BUFFER }
    );
    const { size } = await stat(filePath);
    if (size === 0) throw new Error("Downloaded episode is empty");
    return { filePath, cleanup };
  } catch (err) {
    await cleanup();
    throw err;
  }
}
