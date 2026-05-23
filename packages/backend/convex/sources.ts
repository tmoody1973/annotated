import { v } from "convex/values";
import { query } from "./_generated/server";

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
