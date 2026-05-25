import { execFile } from "node:child_process";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterAll, beforeAll, expect, test } from "vitest";
import { transcodeToMp3 } from "./commentary-transcoder.js";

const execFileAsync = promisify(execFile);

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

test("cleanup removes the temp working directory", async () => {
  const clip = await transcodeToMp3(webmBytes);
  await clip.cleanup();
  await expect(readFile(clip.filePath)).rejects.toThrow();
});
