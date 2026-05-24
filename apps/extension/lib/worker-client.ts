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
