import { v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { upsertYoutubeSource } from "./sources";

/** SPEC: clips are capped at 90 seconds. */
const MAX_CLIP_MS = 90_000;

interface AnnotationInsert {
  authorId: Id<"users">;
  sourceId: Id<"sources">;
  clipStorageId?: Id<"_storage">;
  clipStartMs?: number;
  clipEndMs?: number;
  commentaryText?: string;
}

/**
 * Inserts an annotation with publishing defaults. Shared by the authed `create`
 * mutation and the test seed so both exercise the same persistence path.
 */
export async function insertAnnotation(
  ctx: MutationCtx,
  input: AnnotationInsert
): Promise<Id<"annotations">> {
  return await ctx.db.insert("annotations", {
    authorId: input.authorId,
    sourceId: input.sourceId,
    clipStorageId: input.clipStorageId,
    clipStartMs: input.clipStartMs,
    clipEndMs: input.clipEndMs,
    commentaryText: input.commentaryText,
    isPublic: true,
    publishedAt: Date.now(),
    commentCount: 0,
    likeCount: 0,
  });
}

/**
 * Publishes a YouTube clip annotation as the signed-in user. Upserts the shared
 * source, then inserts the annotation. Author is derived from the Clerk identity
 * — never accepted as an argument.
 */
export const create = mutation({
  args: {
    videoId: v.string(),
    title: v.string(),
    author: v.optional(v.string()),
    thumbnailUrl: v.optional(v.string()),
    durationMs: v.optional(v.number()),
    clipStorageId: v.id("_storage"),
    clipStartMs: v.number(),
    clipEndMs: v.number(),
    commentaryText: v.string(),
  },
  returns: v.id("annotations"),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!user) {
      throw new Error("No user record for the current identity");
    }
    if (args.commentaryText.trim().length === 0) {
      throw new Error("Commentary is required");
    }
    if (
      args.clipEndMs <= args.clipStartMs ||
      args.clipEndMs - args.clipStartMs > MAX_CLIP_MS
    ) {
      throw new Error("Invalid clip span");
    }

    const sourceId = await upsertYoutubeSource(ctx, args);
    return await insertAnnotation(ctx, {
      authorId: user._id,
      sourceId,
      clipStorageId: args.clipStorageId,
      clipStartMs: args.clipStartMs,
      clipEndMs: args.clipEndMs,
      commentaryText: args.commentaryText,
    });
  },
});

/**
 * Returns an annotation with the joined data the landing page renders: the clip
 * video URL, the source attribution, and the author. Null if not found.
 */
export const getById = query({
  args: { annotationId: v.id("annotations") },
  handler: async (ctx, args) => {
    const annotation = await ctx.db.get(args.annotationId);
    if (!annotation) return null;

    const source = await ctx.db.get(annotation.sourceId);
    const author = await ctx.db.get(annotation.authorId);
    const clipUrl = annotation.clipStorageId
      ? await ctx.storage.getUrl(annotation.clipStorageId)
      : null;

    return {
      ...annotation,
      clipUrl,
      source: source
        ? { canonicalUrl: source.canonicalUrl, title: source.title, type: source.type }
        : null,
      author: author
        ? { username: author.username, displayName: author.displayName }
        : null,
    };
  },
});
