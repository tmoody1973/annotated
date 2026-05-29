import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import { getCurrentUser, requireCurrentUser } from "./users";
import type { Id } from "./_generated/dataModel";

/**
 * Adds a comment to an annotation as the signed-in user, and bumps the
 * denormalized `commentCount`. Empty/whitespace text is rejected.
 *
 * When `parentId` is given the comment is a reply. Nesting is capped at one
 * level: replying to a reply re-targets the reply's own top-level parent, so
 * the thread never grows deeper than comment → replies.
 */
export const add = mutation({
  args: {
    annotationId: v.id("annotations"),
    text: v.string(),
    parentId: v.optional(v.id("comments")),
  },
  returns: v.id("comments"),
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const text = args.text.trim();
    if (text.length === 0) {
      throw new Error("Comment can't be empty");
    }

    const annotation = await ctx.db.get(args.annotationId);
    if (!annotation) {
      throw new Error("Annotation not found");
    }

    const topLevelParentId = await resolveTopLevelParent(
      ctx,
      args.parentId,
      args.annotationId
    );

    const commentId = await ctx.db.insert("comments", {
      annotationId: args.annotationId,
      authorId: user._id,
      text,
      createdAt: Date.now(),
      ...(topLevelParentId ? { parentId: topLevelParentId } : {}),
    });
    await ctx.db.patch(args.annotationId, {
      commentCount: annotation.commentCount + 1,
    });
    return commentId;
  },
});

/**
 * Resolves the supplied parent to a valid top-level comment id, or `null` for a
 * top-level comment. Guards that the parent exists and belongs to the same
 * annotation; flattens a reply's parent to its own top-level ancestor.
 */
async function resolveTopLevelParent(
  ctx: QueryCtx,
  parentId: Id<"comments"> | undefined,
  annotationId: Id<"annotations">
): Promise<Id<"comments"> | null> {
  if (!parentId) return null;
  const parent = await ctx.db.get(parentId);
  if (!parent || parent.annotationId !== annotationId) {
    throw new Error("Parent comment not found on this annotation");
  }
  return parent.parentId ?? parent._id;
}

/**
 * Toggles the signed-in user's like on a comment. Idempotent per (comment,
 * user); the like count is always recomputed from rows, so it can't drift or go
 * negative. Returns the new liked state + count for an optimistic UI.
 */
export const toggleCommentLike = mutation({
  args: { commentId: v.id("comments") },
  returns: v.object({ liked: v.boolean(), likeCount: v.number() }),
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const comment = await ctx.db.get(args.commentId);
    if (!comment) {
      throw new Error("Comment not found");
    }

    const existing = await ctx.db
      .query("commentLikes")
      .withIndex("by_comment_and_user", (q) =>
        q.eq("commentId", args.commentId).eq("userId", user._id)
      )
      .first();
    if (existing) {
      await ctx.db.delete(existing._id);
    } else {
      await ctx.db.insert("commentLikes", {
        commentId: args.commentId,
        userId: user._id,
      });
    }

    const rows = await ctx.db
      .query("commentLikes")
      .withIndex("by_comment", (q) => q.eq("commentId", args.commentId))
      .collect();
    return { liked: existing === null, likeCount: rows.length };
  },
});

/**
 * Comments on an annotation as a one-level thread: top-level comments
 * oldest-first, each with an ordered `replies[]`. Each entry is joined with its
 * author and carries `likeCount` + `viewerHasLiked` (false when signed out).
 */
export const listByAnnotation = query({
  args: { annotationId: v.id("annotations") },
  handler: async (ctx, args) => {
    const viewer = await getCurrentUser(ctx);
    const viewerId = viewer?._id ?? null;

    const comments = await ctx.db
      .query("comments")
      .withIndex("by_annotation", (q) => q.eq("annotationId", args.annotationId))
      .collect();

    const enriched = await Promise.all(
      comments.map(async (comment) => {
        const author = await ctx.db.get(comment.authorId);
        const likes = await ctx.db
          .query("commentLikes")
          .withIndex("by_comment", (q) => q.eq("commentId", comment._id))
          .collect();
        return {
          _id: comment._id,
          parentId: comment.parentId ?? null,
          text: comment.text,
          createdAt: comment.createdAt,
          likeCount: likes.length,
          viewerHasLiked: viewerId
            ? likes.some((like) => like.userId === viewerId)
            : false,
          author: author
            ? {
                username: author.username,
                displayName: author.displayName,
                avatarUrl: author.avatarUrl,
              }
            : null,
        };
      })
    );

    const byCreatedAt = (a: { createdAt: number }, b: { createdAt: number }) =>
      a.createdAt - b.createdAt;
    const topLevel = enriched
      .filter((c) => c.parentId === null)
      .sort(byCreatedAt);

    return topLevel.map((top) => ({
      ...top,
      replies: enriched
        .filter((c) => c.parentId === top._id)
        .sort(byCreatedAt),
    }));
  },
});
