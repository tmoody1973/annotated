import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireCurrentUser } from "./users";
import { toLandingView } from "./annotations";

/**
 * Starts a thread on a source as the signed-in user (gap §1). A thread is an
 * ordered series of that author's clips from one source, addressable at
 * /t/[id]. Author is derived from the Clerk identity — never an argument.
 */
export const create = mutation({
  args: { sourceId: v.id("sources"), title: v.optional(v.string()) },
  returns: v.id("threads"),
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const source = await ctx.db.get(args.sourceId);
    if (!source) {
      throw new Error("Source not found");
    }
    return await ctx.db.insert("threads", {
      authorId: user._id,
      sourceId: args.sourceId,
      title: args.title,
      createdAt: Date.now(),
    });
  },
});

/**
 * A thread with its clips in order: the joined source + author and the ordered
 * list of clip landing views (each shaped exactly like the /a/[id] page).
 * Null if the thread doesn't exist.
 */
export const getWithClips = query({
  args: { threadId: v.id("threads") },
  handler: async (ctx, args) => {
    const thread = await ctx.db.get(args.threadId);
    if (!thread) return null;

    const source = await ctx.db.get(thread.sourceId);
    const author = await ctx.db.get(thread.authorId);

    const annotations = await ctx.db
      .query("annotations")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .collect();
    const ordered = annotations.sort(
      (a, b) => (a.threadOrder ?? 0) - (b.threadOrder ?? 0)
    );
    const clips = await Promise.all(
      ordered.map((annotation) => toLandingView(ctx, annotation))
    );

    return {
      _id: thread._id,
      title: thread.title ?? null,
      createdAt: thread.createdAt,
      source: source
        ? {
            canonicalUrl: source.canonicalUrl,
            title: source.title,
            type: source.type,
            siteName: source.siteName,
            author: source.author,
          }
        : null,
      author: author
        ? {
            id: author._id,
            username: author.username,
            displayName: author.displayName,
            avatarUrl: author.avatarUrl,
          }
        : null,
      clips,
    };
  },
});
