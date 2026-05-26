import { execFile } from "node:child_process";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterAll, beforeAll, expect, test } from "vitest";
import {
  transcodeToMp3,
  COMMENTARY_FILTER_CHAIN,
} from "./commentary-transcoder.js";

const execFileAsync = promisify(execFile);

/** Probes the duration (seconds) of an audio file via ffprobe. */
async function durationSeconds(filePath: string): Promise<number> {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=nw=1:nk=1",
    filePath,
  ]);
  return Number.parseFloat(stdout.trim());
}

let webmBytes: Buffer;
let fixtureDir: string;

beforeAll(async () => {
  fixtureDir = await mkdtemp(join(tmpdir(), "commentary-fixture-"));
  const webmPath = join(fixtureDir, "voice.webm");
  // A real 1s opus-in-webm clip — the container/codec MediaRecorder emits in Chrome.
  await execFileAsync("ffmpeg", [
    "-y",
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=440:duration=1",
    "-c:a",
    "libopus",
    webmPath,
  ]);
  webmBytes = await readFile(webmPath);
});

afterAll(async () => {
  await rm(fixtureDir, { recursive: true, force: true });
});

test("transcodes a real webm/opus recording to mp3", async () => {
  const clip = await transcodeToMp3(webmBytes);
  try {
    const { stdout } = await execFileAsync("ffprobe", [
      "-v",
      "error",
      "-select_streams",
      "a:0",
      "-show_entries",
      "stream=codec_name",
      "-of",
      "default=nw=1:nk=1",
      clip.filePath,
    ]);
    expect(stdout.trim()).toBe("mp3");
  } finally {
    await clip.cleanup();
  }
});

test("the filter chain trims silence and normalizes loudness", () => {
  expect(COMMENTARY_FILTER_CHAIN).toContain("silenceremove");
  expect(COMMENTARY_FILTER_CHAIN).toContain("loudnorm");
});

test("leading silence is trimmed from the output (silenceremove ran)", async () => {
  // A 1s silence + 1s tone fixture (2s total); after trimming the leading
  // silence the output should be meaningfully shorter than the input.
  const silentHeadPath = join(fixtureDir, "silent-head.webm");
  await execFileAsync("ffmpeg", [
    "-y",
    "-f",
    "lavfi",
    "-i",
    "anullsrc=r=48000:cl=mono",
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=440:duration=1",
    "-filter_complex",
    "[0:a]atrim=duration=1[s];[s][1:a]concat=n=2:v=0:a=1[out]",
    "-map",
    "[out]",
    "-c:a",
    "libopus",
    silentHeadPath,
  ]);
  const inputBytes = await readFile(silentHeadPath);
  const inputDuration = await durationSeconds(silentHeadPath);

  const clip = await transcodeToMp3(inputBytes);
  try {
    const outputDuration = await durationSeconds(clip.filePath);
    expect(outputDuration).toBeLessThan(inputDuration - 0.5);
  } finally {
    await clip.cleanup();
  }
});

test("cleanup removes the temp working directory", async () => {
  const clip = await transcodeToMp3(webmBytes);
  await clip.cleanup();
  await expect(readFile(clip.filePath)).rejects.toThrow();
});
