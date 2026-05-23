import { v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

/**
 * Looks up a source by its YouTube video ID. Public (no auth) — the extension
 * calls this on sidepanel open to tell whether a video is already a known
 * source. Returns the row or null.
 */
export const getByYoutubeId = query({
  args: { youtubeVideoId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sources")
      .withIndex("by_youtube_id", (q) =>
        q.eq("youtubeVideoId", args.youtubeVideoId)
      )
      .first();
  },
});

interface YoutubeSourceInput {
  videoId: string;
  title: string;
  author?: string;
  thumbnailUrl?: string;
  durationMs?: number;
}

/**
 * Inserts a YouTube source, or returns the existing one for this video id.
 * Sources are shared across users (the dedup moat) — idempotent by video id.
 * Plain helper so `annotations.create` and the test seed share one code path.
 */
export async function upsertYoutubeSource(
  ctx: MutationCtx,
  input: YoutubeSourceInput
): Promise<Id<"sources">> {
  const existing = await ctx.db
    .query("sources")
    .withIndex("by_youtube_id", (q) => q.eq("youtubeVideoId", input.videoId))
    .first();
  if (existing) return existing._id;

  return await ctx.db.insert("sources", {
    type: "youtube",
    canonicalUrl: `https://www.youtube.com/watch?v=${input.videoId}`,
    title: input.title,
    author: input.author,
    youtubeVideoId: input.videoId,
    youtubeThumbnailUrl: input.thumbnailUrl,
    youtubeDurationMs: input.durationMs,
    cachedAt: Date.now(),
  });
}

/** Public idempotent upsert of a YouTube source; returns the source id. */
export const upsertYoutube = mutation({
  args: {
    videoId: v.string(),
    title: v.string(),
    author: v.optional(v.string()),
    thumbnailUrl: v.optional(v.string()),
    durationMs: v.optional(v.number()),
  },
  returns: v.id("sources"),
  handler: async (ctx, args) => {
    return await upsertYoutubeSource(ctx, args);
  },
});
