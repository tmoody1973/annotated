import { execFile } from "node:child_process";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
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
let webmPath: string;
let fixtureDir: string;
let fixtureServer: Server;
let fixtureAudioUrl: string;

// Controllable transcript behavior per test: the stub resolves/rejects from here.
let transcribeFileImpl: (audio: Buffer, mimetype: string) => Promise<string>;

beforeAll(async () => {
  fixtureDir = await mkdtemp(join(tmpdir(), "transcode-route-fixture-"));
  webmPath = join(fixtureDir, "voice.webm");
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

  // Serves the same fixture over http://127.0.0.1 so the audioUrl branch can
  // fetch it exactly like it would fetch a Convex storage URL.
  fixtureServer = createServer((_req, res) => {
    res.writeHead(200, { "content-type": "audio/webm" });
    createReadStream(webmPath).pipe(res);
  });
  await new Promise<void>((resolve) => fixtureServer.listen(0, "127.0.0.1", () => resolve()));
  const address = fixtureServer.address() as AddressInfo;
  fixtureAudioUrl = `http://127.0.0.1:${address.port}/voice.webm`;
});

afterAll(async () => {
  await rm(fixtureDir, { recursive: true, force: true });
  await new Promise<void>((resolve) => fixtureServer.close(() => resolve()));
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

test("accepts audioUrl, fetches it, and returns the same storageId/transcript shape", async () => {
  const app = buildApp();
  const res = await post(app, { audioUrl: fixtureAudioUrl, mimeType: "audio/webm" });
  expect(res.statusCode).toBe(200);
  expect(res.json()).toEqual({
    storageId: STORAGE_ID,
    transcript: "This is a real test of recorded voice commentary.",
  });
});

test("rejects a body with both audioBase64 and audioUrl", async () => {
  const app = buildApp();
  const res = await post(app, {
    audioBase64: webmBase64,
    audioUrl: fixtureAudioUrl,
    mimeType: "audio/webm",
  });
  expect(res.statusCode).toBe(400);
});

test("rejects a body with neither audioBase64 nor audioUrl", async () => {
  const app = buildApp();
  const res = await post(app, { mimeType: "audio/webm" });
  expect(res.statusCode).toBe(400);
  // Asserts the schema's own refine message, not just the status code — without
  // it this would also 400 via the unrelated "empty audio payload" fallback.
  expect(JSON.stringify(res.json())).toContain(
    "Provide exactly one of audioBase64 or audioUrl"
  );
});
