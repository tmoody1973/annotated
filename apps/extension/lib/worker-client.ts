const workerUrl = process.env.PLASMO_PUBLIC_WORKER_URL;
const workerToken = process.env.PLASMO_PUBLIC_WORKER_TOKEN;

export interface ClipResult {
  storageId: string;
  durationMs: number;
}

export interface ClipRequest {
  videoId: string;
  startMs: number;
  endMs: number;
}

/**
 * Asks the worker to clip the given YouTube span and store it, returning the
 * Convex storageId. DEBT: the worker token is bundled (dev only) — production
 * should route this through a Convex action so the secret stays server-side.
 */
export async function clipYoutube(input: ClipRequest): Promise<ClipResult> {
  if (!workerUrl || !workerToken) {
    throw new Error("Worker is not configured (PLASMO_PUBLIC_WORKER_URL/_TOKEN)");
  }

  const response = await fetch(`${workerUrl}/clip-youtube`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${workerToken}`,
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Clip failed (${response.status})${detail ? `: ${detail}` : ""}`
    );
  }

  const body = (await response.json()) as Partial<ClipResult>;
  if (typeof body.storageId !== "string") {
    throw new Error("Worker returned an unexpected response (no storageId)");
  }
  return { storageId: body.storageId, durationMs: body.durationMs ?? 0 };
}

/**
 * Asks the worker to transcribe a podcast episode (sync Deepgram) and write the
 * transcript row for this source. Idempotent on the caller's side — only invoked
 * when no transcript exists yet.
 */
export async function transcribePodcast(
  sourceId: string,
  mp3Url: string
): Promise<void> {
  if (!workerUrl || !workerToken) {
    throw new Error("Worker is not configured (PLASMO_PUBLIC_WORKER_URL/_TOKEN)");
  }
  const response = await fetch(`${workerUrl}/transcribe`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${workerToken}`,
    },
    body: JSON.stringify({ sourceId, mp3Url }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Transcribe failed (${response.status})${detail ? `: ${detail}` : ""}`);
  }
}

/** Asks the worker to cut a podcast audio span and store it; returns the storageId. */
export async function clipAudio(
  mp3Url: string,
  startMs: number,
  endMs: number
): Promise<string> {
  if (!workerUrl || !workerToken) {
    throw new Error("Worker is not configured (PLASMO_PUBLIC_WORKER_URL/_TOKEN)");
  }
  const response = await fetch(`${workerUrl}/clip-audio`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${workerToken}`,
    },
    body: JSON.stringify({ mp3Url, startMs, endMs }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Audio clip failed (${response.status})${detail ? `: ${detail}` : ""}`);
  }
  const body = (await response.json()) as { storageId?: string };
  if (typeof body.storageId !== "string") {
    throw new Error("Worker returned no storageId for the audio clip");
  }
  return body.storageId;
}

export interface ExtractedArticle {
  title: string;
  textContent: string;
  byline: string | null;
  siteName: string | null;
}

/**
 * Asks the worker to run Mozilla Readability over the page. Sends the live HTML
 * grabbed by the content script (so the worker sees what the user sees), with the
 * URL for the canonical source. CORS-free because the extension has the worker
 * host permission. DEBT: the worker token is bundled (dev only).
 */
export async function extractArticle(
  url: string,
  html: string
): Promise<ExtractedArticle> {
  if (!workerUrl || !workerToken) {
    throw new Error("Worker is not configured (PLASMO_PUBLIC_WORKER_URL/_TOKEN)");
  }
  const response = await fetch(`${workerUrl}/extract-article`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${workerToken}`,
    },
    body: JSON.stringify({ url, html }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Extract failed (${response.status})${detail ? `: ${detail}` : ""}`
    );
  }
  const body = (await response.json()) as Partial<ExtractedArticle>;
  if (typeof body.title !== "string" || typeof body.textContent !== "string") {
    throw new Error("Worker returned an unexpected article response");
  }
  return {
    title: body.title,
    textContent: body.textContent,
    byline: body.byline ?? null,
    siteName: body.siteName ?? null,
  };
}

/** Encodes a recorded audio blob to base64 (no data-URL prefix) for JSON transport. */
async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/**
 * Uploads a recorded voice-commentary blob (webm/opus) to the worker, which
 * transcodes it to mp3, stores it, and returns the Convex storageId. DEBT: the
 * worker token is bundled (dev only) — production routes this server-side.
 */
export async function transcodeCommentary(blob: Blob): Promise<string> {
  if (!workerUrl || !workerToken) {
    throw new Error("Worker is not configured (PLASMO_PUBLIC_WORKER_URL/_TOKEN)");
  }
  const audioBase64 = await blobToBase64(blob);
  const response = await fetch(`${workerUrl}/transcode-commentary`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${workerToken}`,
    },
    body: JSON.stringify({ audioBase64, mimeType: blob.type || "audio/webm" }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Commentary transcode failed (${response.status})${detail ? `: ${detail}` : ""}`
    );
  }
  const body = (await response.json()) as { storageId?: string };
  if (typeof body.storageId !== "string") {
    throw new Error("Worker returned no storageId for the commentary audio");
  }
  return body.storageId;
}

/** The dev worker token, passed to the token-guarded publish mutation. */
export function getWorkerToken(): string {
  if (!workerToken) {
    throw new Error("Missing PLASMO_PUBLIC_WORKER_TOKEN");
  }
  return workerToken;
}

/** Base URL of the web app, for building the published annotation link. */
export function getWebUrl(): string {
  return process.env.PLASMO_PUBLIC_WEB_URL ?? "http://localhost:3000";
}
