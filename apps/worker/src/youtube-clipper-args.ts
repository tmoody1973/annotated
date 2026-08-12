/**
 * Pure argument builders for the YouTube slice pipeline, extracted from
 * youtube-clipper.ts so the slice contract is testable without spawning
 * yt-dlp or ffmpeg.
 *
 * Why the pad: `--force-keyframes-at-cuts` gave yt-dlp a frame-exact start at
 * the cost of a full re-encode inside yt-dlp (~19-27s of a ~30s slice). The
 * ffmpeg pass below already re-encodes for the 240p downscale, so we download a
 * slightly padded section at keyframe granularity (fast, no re-encode) and let
 * ffmpeg seek past the pad to the exact start in work it was already doing.
 */

/** Seconds of extra media downloaded either side of the requested span. */
export const PAD_MS = 3_000;

/** SPEC: clips are capped at 90 seconds. */
const MAX_CLIP_MS = 90_000;

const CLIP_HEIGHT = 240;

function toTimestamp(totalMs: number): string {
  const totalSeconds = Math.max(0, totalMs) / 1000;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number): string => String(Math.floor(n)).padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}:${seconds.toFixed(3).padStart(6, "0")}`;
}

/** The pad actually available before `startMs` — clamped at the video start. */
export function leadingPadMs(startMs: number): number {
  return Math.min(PAD_MS, Math.max(0, startMs));
}

export function buildYtDlpArgs(
  videoId: string,
  startMs: number,
  endMs: number,
  outputTemplate: string
): string[] {
  const sectionStartMs = startMs - leadingPadMs(startMs);
  const sectionEndMs = endMs + PAD_MS;
  return [
    "--no-playlist",
    "--quiet",
    "--no-warnings",
    "--download-sections",
    `*${toTimestamp(sectionStartMs)}-${toTimestamp(sectionEndMs)}`,
    "-f",
    "bv*[height<=360]+ba/b[height<=360]/b",
    "--merge-output-format",
    "mp4",
    "-o",
    outputTemplate,
    `https://www.youtube.com/watch?v=${videoId}`,
  ];
}

export function buildFfmpegArgs(
  inputPath: string,
  outputPath: string,
  seekMs: number,
  durationMs: number
): string[] {
  const cappedMs = Math.min(durationMs, MAX_CLIP_MS);
  return [
    "-y",
    // -ss before -i: ffmpeg seeks the input rather than decoding and discarding.
    "-ss",
    (Math.max(0, seekMs) / 1000).toFixed(3),
    "-i",
    inputPath,
    "-t",
    (cappedMs / 1000).toFixed(3),
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
    outputPath,
  ];
}
