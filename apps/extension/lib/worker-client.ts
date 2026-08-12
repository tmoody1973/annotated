import { makeFunctionReference } from "convex/server";
import type { Chapter } from "@annotated/shared";
import { buildAuthedClient } from "./convex-client";

// The extension no longer talks to the Fly worker directly — every former
// worker call now routes through a Convex action/mutation, which holds the
// worker token server-side. Nothing here reads PLASMO_PUBLIC_WORKER_TOKEN
// anymore (its last caller, lib/use-thread.ts, now calls the authed
// threads:startFromAnnotation mutation instead of the token-guarded dev seed).

const youtubeChapters = makeFunctionReference<
  "action", { videoId: string }, Chapter[]
>("media:youtubeChapters");

const transcodeTake = makeFunctionReference<
  "action",
  { audioStorageId: string; mimeType: string },
  { storageId: string; transcript: string | null }
>("media:transcodeTake");

const transcribePodcastAction = makeFunctionReference<
  "action", { sourceId: string }, null
>("media:transcribePodcast");

const transcribeSourceAction = makeFunctionReference<
  "action", { videoId: string }, null
>("media:transcribeSource");

const generateUploadUrlForUser = makeFunctionReference<
  "mutation", Record<string, never>, string
>("files:generateUploadUrlForUser");

export interface ExtractedArticle {
  title: string;
  textContent: string;
  byline: string | null;
  siteName: string | null;
  imageUrl: string | null;
}

const extractArticleAction = makeFunctionReference<
  "action", { url: string; htmlStorageId?: string }, ExtractedArticle
>("articles:extractArticle");

/**
 * Runs Mozilla Readability over the article at `url`, server-side. `html` is
 * the content script's live outerHTML (option B — paywalls/JS resolved, what
 * the user actually sees) — it goes to Convex storage first, not through the
 * action argument directly, since a real page's outerHTML can exceed 1MB
 * (NPR measured 1.11MB), Convex's per-value size cap. The server reads it
 * back from storage and deletes it once used (see convex/articles.ts). When
 * `html` is omitted, or the upload fails, the worker falls back to fetching
 * `url` itself (option A) — a best-effort enhancement, never a hard failure.
 */
export async function extractArticle(
  url: string,
  html?: string
): Promise<ExtractedArticle> {
  let htmlStorageId: string | undefined;
  if (html) {
    try {
      const uploadUrl = await mintUploadUrl();
      const uploaded = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": "text/html" },
        body: html,
      });
      if (uploaded.ok) {
        const body = (await uploaded.json()) as { storageId: string };
        htmlStorageId = body.storageId;
      }
    } catch {
      // Falls through to url-only extraction.
    }
  }
  const client = await buildAuthedClient();
  return await client.action(extractArticleAction, { url, htmlStorageId });
}

/** Chapters are an enhancement — a failure must never block clipping. */
export async function fetchYoutubeChapters(videoId: string): Promise<Chapter[]> {
  try {
    const client = await buildAuthedClient();
    return await client.action(youtubeChapters, { videoId });
  } catch {
    return [];
  }
}

/** Mints a short-lived Convex storage upload URL for the signed-in user. Shared
 *  by uploadTakeAudio (recorded take) and the article panel (source screenshot)
 *  — both need "put a blob in storage" with no worker involvement. */
export async function mintUploadUrl(): Promise<string> {
  const client = await buildAuthedClient();
  return await client.mutation(generateUploadUrlForUser, {});
}

/**
 * Puts a recorded take into Convex storage, then asks the server to transcode
 * it to mp3 and transcribe it. The blob goes straight to storage rather than
 * through an action argument — a 90s recording exceeds Convex's argument size
 * limit as base64.
 */
export async function uploadTakeAudio(
  blob: Blob
): Promise<{ storageId: string; transcript: string | null }> {
  const uploadUrl = await mintUploadUrl();
  const uploaded = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": blob.type || "audio/webm" },
    body: blob,
  });
  if (!uploaded.ok) {
    throw new Error("Couldn't upload that recording. Try again.");
  }
  const { storageId } = (await uploaded.json()) as { storageId: string };
  const client = await buildAuthedClient();
  return await client.action(transcodeTake, {
    audioStorageId: storageId,
    mimeType: blob.type || "audio/webm",
  });
}

/**
 * Asks the server to transcribe a podcast episode (Deepgram) and write the
 * transcript row for this source. The server reads the source's mp3Url itself
 * — the client no longer forwards it (that would be an SSRF vector now that
 * the fetch originates server-side). Idempotent on the caller's side — only
 * invoked when no transcript exists yet.
 */
export async function transcribePodcast(sourceId: string): Promise<void> {
  const client = await buildAuthedClient();
  await client.action(transcribePodcastAction, { sourceId });
}

/**
 * Fire-and-forget: asks the server to fetch + store this video's captions as a
 * youtube-vtt transcript (idempotent per source, resolved server-side from the
 * videoId). Best-effort — a failure must never affect the publish, so this
 * never throws. Called once after a YouTube clip is published.
 */
export async function transcribeSource(videoId: string): Promise<void> {
  try {
    const client = await buildAuthedClient();
    await client.action(transcribeSourceAction, { videoId });
  } catch {
    // Transcript is an enhancement; swallow.
  }
}

/** Base URL of the web app, for building the published annotation link. */
export function getWebUrl(): string {
  return process.env.PLASMO_PUBLIC_WEB_URL ?? "http://localhost:3000";
}
