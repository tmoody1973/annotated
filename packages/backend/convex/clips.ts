import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, internalMutation, mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireCurrentUser } from "./users";

/**
 * The slice pipeline. Publishing creates the annotation row immediately
 * (mediaState "processing") and schedules one of the actions here. The action
 * calls the Fly worker with WORKER_AUTH_TOKEN held server-side — the extension
 * never sees it — and patches the result back through the mutations below.
 *
 * Everything here is internal: no client calls these directly.
 */

// Bounds the worker fetch so a hung Fly instance can't leave a row stuck
// "processing" forever — Convex would otherwise only cut it off at the
// action's own runtime limit, well past the point of being useful.
//
// Raised from 60s on 2026-08-12. 60s was set when a slice took 4-10s, which
// made it look like generous headroom. Measured on the live worker: throughput
// to YouTube is around 30KB/s, so a 90-second 360p section is ~3.5MB and takes
// about two minutes to fetch — and every clip of a dense video was being killed
// at 60s and marked "failed" while the download was still healthy.
//
// The wait costs nothing that matters: publish is optimistic, so the annotation
// and its page already exist and the panel is showing "clip processing…". This
// only decides how long we let a *working* download run before giving up on it.
export const WORKER_FETCH_TIMEOUT_MS = 240_000;

/** Attaches a finished clip and flips the row to ready. */
export const attachClip = internalMutation({
  args: {
    annotationId: v.id("annotations"),
    clipStorageId: v.id("_storage"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const annotation = await ctx.db.get(args.annotationId);
    // The row can be gone if the author removed it while the slice ran. Drop
    // the orphaned blob rather than leaking it (closes debt d/i).
    if (!annotation) {
      await ctx.storage.delete(args.clipStorageId);
      return null;
    }
    // A re-slice replaces the clip — delete the blob it's replacing so it
    // doesn't leak (same family as debt d).
    if (annotation.clipStorageId) {
      await ctx.storage.delete(annotation.clipStorageId);
    }
    await ctx.db.patch(args.annotationId, {
      clipStorageId: args.clipStorageId,
      mediaState: "ready",
    });
    return null;
  },
});

/**
 * Records a slice failure. Deliberately leaves `isPublic` alone: the URL may
 * already be pasted somewhere, so the page must resolve — it renders a "clip
 * couldn't be made" notice with the take and source intact.
 */
export const markFailed = internalMutation({
  args: {
    annotationId: v.id("annotations"),
    reason: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const annotation = await ctx.db.get(args.annotationId);
    if (!annotation) return null;
    // A late/duplicate failure callback must not clobber a row that already
    // attached its clip successfully.
    if (annotation.mediaState === "ready") return null;
    await ctx.db.patch(args.annotationId, { mediaState: "failed" });
    console.error(`clip slice failed for ${args.annotationId}: ${args.reason}`);
    return null;
  },
});

/** Reads the worker config, throwing a single clear error when unset. */
export function workerConfig(): { url: string; token: string } {
  const url = process.env.WORKER_URL;
  const token = process.env.WORKER_AUTH_TOKEN;
  if (!url || !token) {
    throw new Error("Worker is not configured (WORKER_URL / WORKER_AUTH_TOKEN)");
  }
  return { url, token };
}

/**
 * How many times a slice is attempted before the row is marked failed.
 *
 * Measured on 2026-08-16: a clip failed with "ffmpeg exited with code 1" from
 * inside yt-dlp, and the *same video on the same worker succeeded 37 seconds
 * later*. Pulling several megabytes from YouTube will occasionally drop a
 * fragment; that is normal. What was not normal is that a single blip was
 * permanent, because the pipeline called the worker exactly once and any error
 * went straight to markFailed with no way back.
 */
const SLICE_ATTEMPTS = 3;

/** Backoff before attempt 2 and 3. Short — this is a hiccup, not an outage. */
const RETRY_DELAYS_MS = [3_000, 9_000];

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * A timeout is not worth retrying: it means the download was still running when
 * we gave up, so a second attempt starts the same slow work from zero and is
 * more likely to exhaust the action's own runtime than to succeed. Everything
 * else — a 5xx, a dropped connection, ffmpeg dying mid-fragment — is exactly
 * the transient class that a retry fixes.
 */
function isWorthRetrying(err: unknown): boolean {
  if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
    return false;
  }
  return true;
}

/**
 * Calls the worker for a clip and returns the storageId, retrying transient
 * failures. Throws the last error when every attempt is spent.
 */
async function sliceWithRetry(
  path: "/clip-youtube" | "/clip-audio",
  body: Record<string, unknown>,
): Promise<Id<"_storage">> {
  const { url, token } = workerConfig();
  let lastError: unknown = new Error("Slice never attempted");

  for (let attempt = 0; attempt < SLICE_ATTEMPTS; attempt++) {
    if (attempt > 0) await sleep(RETRY_DELAYS_MS[attempt - 1] ?? 9_000);
    try {
      const response = await fetch(`${url}${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(WORKER_FETCH_TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`Worker returned ${response.status}`);
      const parsed = (await response.json()) as { storageId?: string };
      if (typeof parsed.storageId !== "string") {
        throw new Error("Worker returned no storageId");
      }
      return parsed.storageId as Id<"_storage">;
    } catch (err) {
      lastError = err;
      if (!isWorthRetrying(err)) break;
    }
  }
  throw lastError;
}

export const sliceYoutube = internalAction({
  args: {
    annotationId: v.id("annotations"),
    videoId: v.string(),
    startMs: v.number(),
    endMs: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      const clipStorageId = await sliceWithRetry("/clip-youtube", {
        videoId: args.videoId,
        startMs: args.startMs,
        endMs: args.endMs,
      });
      await ctx.runMutation(internal.clips.attachClip, {
        annotationId: args.annotationId,
        clipStorageId,
      });
    } catch (err) {
      await ctx.runMutation(internal.clips.markFailed, {
        annotationId: args.annotationId,
        reason: err instanceof Error ? err.message : "Unknown slice failure",
      });
    }
    return null;
  },
});

export const slicePodcast = internalAction({
  args: {
    annotationId: v.id("annotations"),
    // The FROZEN episode copy, not the live enclosure — clipping mp3Url would
    // drift against ad insertion and reintroduce the bug 9cf7ac0 fixed.
    episodeStorageId: v.id("_storage"),
    startMs: v.number(),
    endMs: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      const mp3Url = await ctx.storage.getUrl(args.episodeStorageId);
      if (!mp3Url) throw new Error("Frozen episode audio not found in storage");
      const clipStorageId = await sliceWithRetry("/clip-audio", {
        mp3Url,
        startMs: args.startMs,
        endMs: args.endMs,
      });
      await ctx.runMutation(internal.clips.attachClip, {
        annotationId: args.annotationId,
        clipStorageId,
      });
    } catch (err) {
      await ctx.runMutation(internal.clips.markFailed, {
        annotationId: args.annotationId,
        reason: err instanceof Error ? err.message : "Unknown slice failure",
      });
    }
    return null;
  },
});

/**
 * Re-run a failed slice for an annotation the caller owns.
 *
 * Publishing is optimistic, so a failed slice leaves a real page with a real
 * URL that may already be pasted somewhere — the take and the source link are
 * intact and only the media is missing. Before this existed the page told the
 * author to "try clipping it again", which meant starting over in the extension
 * and publishing a *second* annotation at a *different* URL. The first one
 * stayed broken forever, and whoever already had the link kept seeing it.
 *
 * This re-slices in place: same row, same URL, same votes and comments.
 *
 * Only the author may call it, and only on a row that actually failed — a
 * "ready" row would have its clip needlessly rebuilt, and a "processing" row is
 * already working.
 */
export const retrySlice = mutation({
  args: { annotationId: v.id("annotations") },
  returns: v.object({ retried: v.boolean(), reason: v.optional(v.string()) }),
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const annotation = await ctx.db.get(args.annotationId);
    if (!annotation) throw new Error("That clip no longer exists");
    if (annotation.authorId !== user._id) {
      throw new Error("Only the person who published this can retry it");
    }
    if (annotation.mediaState !== "failed") {
      return { retried: false, reason: "This clip isn't in a failed state" };
    }
    if (annotation.clipStartMs === undefined || annotation.clipEndMs === undefined) {
      return { retried: false, reason: "This annotation has no clip to rebuild" };
    }

    const source = await ctx.db.get(annotation.sourceId);
    if (!source) return { retried: false, reason: "The source is missing" };

    if (source.type === "youtube" && source.youtubeVideoId) {
      await ctx.db.patch(args.annotationId, { mediaState: "processing" });
      await ctx.scheduler.runAfter(0, internal.clips.sliceYoutube, {
        annotationId: args.annotationId,
        videoId: source.youtubeVideoId,
        startMs: annotation.clipStartMs,
        endMs: annotation.clipEndMs,
      });
      return { retried: true };
    }

    if (source.type === "podcast") {
      const transcript = await ctx.db
        .query("transcripts")
        .withIndex("by_source", (q) => q.eq("sourceId", annotation.sourceId))
        .first();
      // The frozen episode copy is what podcast clips are cut from; without it
      // a retry would clip the live enclosure and drift against ad insertion.
      if (!transcript?.episodeStorageId) {
        return { retried: false, reason: "The episode audio is no longer stored" };
      }
      await ctx.db.patch(args.annotationId, { mediaState: "processing" });
      await ctx.scheduler.runAfter(0, internal.clips.slicePodcast, {
        annotationId: args.annotationId,
        episodeStorageId: transcript.episodeStorageId,
        startMs: annotation.clipStartMs,
        endMs: annotation.clipEndMs,
      });
      return { retried: true };
    }

    return { retried: false, reason: "This kind of source has no clip to rebuild" };
  },
});

/**
 * Whether the signed-in viewer may retry this clip.
 *
 * A boolean rather than exposing the annotation's authorId: an annotation can
 * be published anonymously, and shipping the author id to every client so the
 * UI could compare it would undo exactly the promise anonymity makes. The
 * server knows who is asking, so it answers the only question the UI has.
 */
export const canRetry = query({
  args: { annotationId: v.id("annotations") },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return false;
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) return false;
    const annotation = await ctx.db.get(args.annotationId);
    if (!annotation) return false;
    return annotation.authorId === user._id && annotation.mediaState === "failed";
  },
});
