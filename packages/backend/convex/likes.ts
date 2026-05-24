import { v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { getCurrentUser, requireCurrentUser } from "./users";

/**
 * Recomputes an annotation's likeCount from the actual like rows and patches it.
 * Recomputing (rather than ±1) is drift-proof under rapid toggles and can never
 * go negative.
 */
async function syncLikeCount(
  ctx: MutationCtx,
  annotationId: Id<"annotations">
): Promise<number> {
  const likes = await ctx.db
    .query("likes")
    .withIndex("by_annotation", (q) => q.eq("annotationId", annotationId))
    .collect();
  await ctx.db.patch(annotationId, { likeCount: likes.length });
  return likes.length;
}

/**
 * Likes or unlikes an annotation (idempotent toggle) as the signed-in user, then
 * recomputes likeCount. Returns the resulting state + count for the UI.
 */
export const toggleLike = mutation({
  args: { annotationId: v.id("annotations") },
  returns: v.object({ liked: v.boolean(), likeCount: v.number() }),
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);

    const existing = await ctx.db
      .query("likes")
      .withIndex("by_annotation_and_user", (q) =>
        q.eq("annotationId", args.annotationId).eq("userId", user._id)
      )
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
      const likeCount = await syncLikeCount(ctx, args.annotationId);
      return { liked: false, likeCount };
    }

    await ctx.db.insert("likes", {
      annotationId: args.annotationId,
      userId: user._id,
    });
    const likeCount = await syncLikeCount(ctx, args.annotationId);
    return { liked: true, likeCount };
  },
});

/** Whether the signed-in user has liked the annotation. False when signed out. */
export const isLiked = query({
  args: { annotationId: v.id("annotations") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) return false;
    const existing = await ctx.db
      .query("likes")
      .withIndex("by_annotation_and_user", (q) =>
        q.eq("annotationId", args.annotationId).eq("userId", user._id)
      )
      .first();
    return existing !== null;
  },
});
