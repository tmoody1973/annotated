import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, internalMutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

/**
 * The slice pipeline. Publishing creates the annotation row immediately
 * (mediaState "processing") and schedules one of the actions here. The action
 * calls the Fly worker with WORKER_AUTH_TOKEN held server-side — the extension
 * never sees it — and patches the result back through the mutations below.
 *
 * Everything here is internal: no client calls these directly.
 */

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
    await ctx.db.patch(args.annotationId, { mediaState: "failed" });
    console.error(`clip slice failed for ${args.annotationId}: ${args.reason}`);
    return null;
  },
});

/** Reads the worker config, throwing a single clear error when unset. */
function workerConfig(): { url: string; token: string } {
  const url = process.env.WORKER_URL;
  const token = process.env.WORKER_AUTH_TOKEN;
  if (!url || !token) {
    throw new Error("Worker is not configured (WORKER_URL / WORKER_AUTH_TOKEN)");
  }
  return { url, token };
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
      const { url, token } = workerConfig();
      const response = await fetch(`${url}/clip-youtube`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          videoId: args.videoId,
          startMs: args.startMs,
          endMs: args.endMs,
        }),
      });
      if (!response.ok) {
        throw new Error(`Worker returned ${response.status}`);
      }
      const body = (await response.json()) as { storageId?: string };
      if (typeof body.storageId !== "string") {
        throw new Error("Worker returned no storageId");
      }
      await ctx.runMutation(internal.clips.attachClip, {
        annotationId: args.annotationId,
        clipStorageId: body.storageId as Id<"_storage">,
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
      const { url, token } = workerConfig();
      const mp3Url = await ctx.storage.getUrl(args.episodeStorageId);
      if (!mp3Url) throw new Error("Frozen episode audio not found in storage");
      const response = await fetch(`${url}/clip-audio`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          mp3Url,
          startMs: args.startMs,
          endMs: args.endMs,
        }),
      });
      if (!response.ok) {
        throw new Error(`Worker returned ${response.status}`);
      }
      const body = (await response.json()) as { storageId?: string };
      if (typeof body.storageId !== "string") {
        throw new Error("Worker returned no storageId");
      }
      await ctx.runMutation(internal.clips.attachClip, {
        annotationId: args.annotationId,
        clipStorageId: body.storageId as Id<"_storage">,
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
