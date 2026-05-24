import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

/**
 * Raw read/write of the iTunes Lookup and RSS feed caches. TTL is enforced by
 * the caller (the resolver action knows the freshness windows); these helpers
 * only store and return rows. Both caches are global — the dedup moat means the
 * second person to open a show pays no network cost.
 */

export const getItunes = internalQuery({
  args: { appleId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("itunesCache")
      .withIndex("by_apple_id", (q) => q.eq("appleId", args.appleId))
      .first();
  },
});

export const setItunes = internalMutation({
  args: { appleId: v.string(), json: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("itunesCache")
      .withIndex("by_apple_id", (q) => q.eq("appleId", args.appleId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { json: args.json, fetchedAt: Date.now() });
    } else {
      await ctx.db.insert("itunesCache", {
        appleId: args.appleId,
        json: args.json,
        fetchedAt: Date.now(),
      });
    }
    return null;
  },
});

export const getRss = internalQuery({
  args: { feedUrl: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("rssCache")
      .withIndex("by_feed_url", (q) => q.eq("feedUrl", args.feedUrl))
      .first();
  },
});

export const setRss = internalMutation({
  args: { feedUrl: v.string(), rawXml: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("rssCache")
      .withIndex("by_feed_url", (q) => q.eq("feedUrl", args.feedUrl))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { rawXml: args.rawXml, fetchedAt: Date.now() });
    } else {
      await ctx.db.insert("rssCache", {
        feedUrl: args.feedUrl,
        rawXml: args.rawXml,
        fetchedAt: Date.now(),
      });
    }
    return null;
  },
});
