import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { workerConfig, WORKER_FETCH_TIMEOUT_MS } from "./clips";
import { parseYoutubeChapters } from "@annotated/shared";
import type { Id } from "./_generated/dataModel";

// /transcribe downloads the whole episode then runs Deepgram sync (debt j:
// ~20-40s typical, longer for long episodes) — a materially heavier call than
// the other worker endpoints, so it gets more headroom than the shared 60s bound.
const TRANSCRIBE_PODCAST_TIMEOUT_MS = 180_000;

/**
 * Server-side proxies for the worker endpoints the extension used to call
 * directly with a bundled bearer token. Every one of these is auth-gated on the
 * Clerk identity — the worker token lives only here.
 */

export async function requireIdentity(ctx: { auth: { getUserIdentity: () => Promise<unknown> } }) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Sign in to continue");
}

const chapterValidator = v.object({
  title: v.string(),
  startMs: v.number(),
  endMs: v.number(),
});

/**
 * A video's chapter marks. The one call here that is NOT auth-gated.
 *
 * Clipping does not require an account, and chapters are how you decide what to
 * clip — gating them behind sign-in withheld the help exactly when a first-time
 * visitor needs it, to protect data that is already public on the video's own
 * page. The worker token still never leaves the server, the response carries
 * nothing user-specific, and a failure returns [] rather than an error.
 *
 * The cost of a yt-dlp call is the real exposure; if that becomes a problem the
 * answer is a cache or a rate limit here, not a sign-in wall.
 */
export const youtubeChapters = action({
  args: { videoId: v.string() },
  returns: v.array(chapterValidator),
  handler: async (ctx, args) => {
    // Chapters are an enhancement: a failure — including a timeout, or a
    // worker that isn't configured in this environment — must never block
    // clipping, so even reading the config happens inside the guard.
    try {
      const { url, token } = workerConfig();
      const response = await fetch(`${url}/youtube-chapters`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ videoId: args.videoId }),
        signal: AbortSignal.timeout(WORKER_FETCH_TIMEOUT_MS),
      });
      if (!response.ok) return [];
      const body = (await response.json()) as { chapters?: unknown };
      // The worker returns yt-dlp verbatim — seconds, snake_case, sometimes the
      // string "NA". parseYoutubeChapters is the trust boundary that turns that
      // into Chapters; casting instead of calling it made every video that had
      // chapters fail this action's own returns validator.
      return parseYoutubeChapters(body.chapters);
    } catch {
      return [];
    }
  },
});

export const transcodeTake = action({
  args: { audioStorageId: v.id("_storage"), mimeType: v.string() },
  returns: v.object({
    storageId: v.id("_storage"),
    transcript: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    await requireIdentity(ctx);
    const { url, token } = workerConfig();
    const sourceUrl = await ctx.storage.getUrl(args.audioStorageId);
    if (!sourceUrl) throw new Error("Recorded take not found in storage");
    let response: Response;
    try {
      response = await fetch(`${url}/transcode-commentary`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ audioUrl: sourceUrl, mimeType: args.mimeType }),
        signal: AbortSignal.timeout(WORKER_FETCH_TIMEOUT_MS),
      });
    } catch {
      throw new Error("Couldn't process that recording. Try again.");
    }
    if (!response.ok) {
      throw new Error("Couldn't process that recording. Try again.");
    }
    const body = (await response.json()) as {
      storageId?: string;
      transcript?: string | null;
    };
    if (typeof body.storageId !== "string") {
      throw new Error("Worker returned no storageId for the recorded take");
    }
    return {
      storageId: body.storageId as Id<"_storage">,
      transcript: body.transcript ?? null,
    };
  },
});

export const transcribePodcast = action({
  args: { sourceId: v.id("sources") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireIdentity(ctx);
    const source = await ctx.runQuery(internal.sources.getById, {
      sourceId: args.sourceId,
    });
    if (!source) throw new Error("Source not found");
    if (source.type !== "podcast") throw new Error("Source is not a podcast");
    // Read server-side, never accept a client-supplied mp3Url — a forwarded
    // client URL would be an SSRF vector now that this call originates here.
    if (!source.mp3Url) throw new Error("Podcast source has no audio URL");
    const { url, token } = workerConfig();
    let response: Response;
    try {
      response = await fetch(`${url}/transcribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ sourceId: args.sourceId, mp3Url: source.mp3Url }),
        signal: AbortSignal.timeout(TRANSCRIBE_PODCAST_TIMEOUT_MS),
      });
    } catch {
      throw new Error("Couldn't start transcription. Try again.");
    }
    if (!response.ok) {
      throw new Error("Couldn't start transcription. Try again.");
    }
    return null;
  },
});

export const transcribeSource = action({
  args: { videoId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireIdentity(ctx);
    const { url, token } = workerConfig();
    // Fire-and-forget backfill: never surface a failure to the clipper.
    try {
      await fetch(`${url}/transcribe-youtube`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ videoId: args.videoId }),
        signal: AbortSignal.timeout(WORKER_FETCH_TIMEOUT_MS),
      });
    } catch {
      // intentionally ignored
    }
    return null;
  },
});
