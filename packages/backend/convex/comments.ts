import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireCurrentUser } from "./users";

/**
 * Adds a comment to an annotation as the signed-in user, and bumps the
 * denormalized `commentCount`. Empty/whitespace text is rejected.
 */
export const add = mutation({
  args: { annotationId: v.id("annotations"), text: v.string() },
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

    const commentId = await ctx.db.insert("comments", {
      annotationId: args.annotationId,
      authorId: user._id,
      text,
      createdAt: Date.now(),
    });
    await ctx.db.patch(args.annotationId, {
      commentCount: annotation.commentCount + 1,
    });
    return commentId;
  },
});

/** Comments on an annotation, oldest-first, joined with each author. */
export const listByAnnotation = query({
  args: { annotationId: v.id("annotations") },
  handler: async (ctx, args) => {
    const comments = await ctx.db
      .query("comments")
      .withIndex("by_annotation", (q) => q.eq("annotationId", args.annotationId))
      .collect();

    return await Promise.all(
      comments.map(async (comment) => {
        const author = await ctx.db.get(comment.authorId);
        return {
          _id: comment._id,
          text: comment.text,
          createdAt: comment.createdAt,
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
  },
});
