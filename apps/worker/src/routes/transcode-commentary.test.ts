import { execFile } from "node:child_process";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import Fastify, { type FastifyInstance, type LightMyRequestResponse } from "fastify";
import { afterAll, beforeAll, beforeEach, expect, test, vi } from "vitest";
import { registerTranscodeCommentaryRoute } from "./transcode-commentary.js";
import type { ClipUploader } from "../clip-uploader.js";
import type { DeepgramClient } from "../deepgram-client.js";

const execFileAsync = promisify(execFile);
const WORKER_TOKEN = "test-worker-token";
const STORAGE_ID = "kg2fakestorageid000000000000000";

let webmBase64: string;
let fixtureDir: string;

// Controllable transcript behavior per test: the stub resolves/rejects from here.
let transcribeFileImpl: (audio: Buffer, mimetype: string) => Promise<string>;

beforeAll(async () => {
  fixtureDir = await mkdtemp(join(tmpdir(), "transcode-route-fixture-"));
  const webmPath = join(fixtureDir, "voice.webm");
  // A real 1s opus-in-webm clip — what MediaRecorder emits in Chrome — so the
  // route's transcodeToMp3 step runs for real (no ffmpeg mock).
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
  webmBase64 = (await readFile(webmPath)).toString("base64");
});

afterAll(async () => {
  await rm(fixtureDir, { recursive: true, force: true });
});

function buildApp(): FastifyInstance {
  const app = Fastify();
  const uploader: ClipUploader = {
    upload: vi.fn(async () => STORAGE_ID),
  };
  const deepgram: DeepgramClient = {
    transcribeUrl: vi.fn(),
    transcribeFile: (audio, mimetype) => transcribeFileImpl(audio, mimetype),
  };
  registerTranscodeCommentaryRoute(app, { uploader, deepgram, workerToken: WORKER_TOKEN });
  return app;
}

function post(
  app: FastifyInstance,
  body: Record<string, unknown>,
  token: string | null = WORKER_TOKEN
): Promise<LightMyRequestResponse> {
  return app.inject({
    method: "POST",
    url: "/transcode-commentary",
    headers: token ? { authorization: `Bearer ${token}` } : {},
    payload: body,
  });
}

beforeEach(() => {
  // Default: a clean successful transcription.
  transcribeFileImpl = async () => "This is a real test of recorded voice commentary.";
});

test("returns the storageId and the Deepgram transcript on success", async () => {
  const app = buildApp();
  const res = await post(app, { audioBase64: webmBase64, mimeType: "audio/webm" });
  expect(res.statusCode).toBe(200);
  expect(res.json()).toEqual({
    storageId: STORAGE_ID,
    transcript: "This is a real test of recorded voice commentary.",
  });
});

test("transcription is best-effort: a Deepgram error yields a null transcript, not a 5xx", async () => {
  transcribeFileImpl = async () => {
    throw new Error("Deepgram 502");
  };
  const app = buildApp();
  const res = await post(app, { audioBase64: webmBase64, mimeType: "audio/webm" });
  // The publish must still succeed with the uploaded clip.
  expect(res.statusCode).toBe(200);
  expect(res.json()).toEqual({ storageId: STORAGE_ID, transcript: null });
});

test("an empty/whitespace transcript is normalized to null", async () => {
  transcribeFileImpl = async () => "   ";
  const app = buildApp();
  const res = await post(app, { audioBase64: webmBase64, mimeType: "audio/webm" });
  expect(res.statusCode).toBe(200);
  expect(res.json()).toEqual({ storageId: STORAGE_ID, transcript: null });
});

test("trims surrounding whitespace from a real transcript", async () => {
  transcribeFileImpl = async () => "  hello world  ";
  const app = buildApp();
  const res = await post(app, { audioBase64: webmBase64, mimeType: "audio/webm" });
  expect(res.statusCode).toBe(200);
  expect(res.json()).toEqual({ storageId: STORAGE_ID, transcript: "hello world" });
});

test("rejects an unauthenticated request with 401", async () => {
  const app = buildApp();
  const res = await post(app, { audioBase64: webmBase64, mimeType: "audio/webm" }, null);
  expect(res.statusCode).toBe(401);
});

test("rejects a wrong worker token with 401", async () => {
  const app = buildApp();
  const res = await post(app, { audioBase64: webmBase64, mimeType: "audio/webm" }, "wrong");
  expect(res.statusCode).toBe(401);
});

test("rejects an empty base64 audio payload with 400", async () => {
  const app = buildApp();
  const res = await post(app, { audioBase64: "", mimeType: "audio/webm" });
  expect(res.statusCode).toBe(400);
});
