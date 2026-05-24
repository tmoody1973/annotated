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
