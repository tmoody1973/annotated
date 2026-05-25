import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { upsertYoutubeSource } from "./sources";

/**
 * Shapes an annotation into the feed/profile card view: resolves the clip URL
 * and joins the source attribution + author. Shared by listFeed and listByAuthor.
 */
async function toFeedItem(ctx: QueryCtx, annotation: Doc<"annotations">) {
  const source = await ctx.db.get(annotation.sourceId);
  const author = await ctx.db.get(annotation.authorId);
  const clipUrl = annotation.clipStorageId
    ? await ctx.storage.getUrl(annotation.clipStorageId)
    : null;
  return {
    _id: annotation._id,
    publishedAt: annotation.publishedAt,
    selectedText: annotation.selectedText,
    commentaryText: annotation.commentaryText,
    commentaryAudioTranscript: annotation.commentaryAudioTranscript,
    clipStartMs: annotation.clipStartMs,
    clipEndMs: annotation.clipEndMs,
    clipUrl,
    commentCount: annotation.commentCount,
    likeCount: annotation.likeCount,
    downCount: annotation.downCount ?? 0,
    source: source
      ? {
          type: source.type,
          title: source.title,
          canonicalUrl: source.canonicalUrl,
          siteName: source.siteName,
        }
      : null,
    author: author
      ? {
          username: author.username,
          displayName: author.displayName,
          avatarUrl: author.avatarUrl,
        }
      : null,
  };
}

/** SPEC: clips are capped at 90 seconds. */
export const MAX_CLIP_MS = 90_000;

/**
 * Validates the publish-time invariants shared by the authed `create` mutation
 * and the dev seed publish: commentary must be present as text OR recorded audio
 * (SPEC), and the clip span must be ordered and within the 90s cap. Throws with
 * a readable reason.
 */
export function assertPublishable(input: {
  commentaryText?: string;
  commentaryAudioStorageId?: Id<"_storage">;
  clipStartMs: number;
  clipEndMs: number;
}): void {
  const hasText = (input.commentaryText ?? "").trim().length > 0;
  const hasAudio = input.commentaryAudioStorageId !== undefined;
  if (!hasText && !hasAudio) {
    throw new Error("Commentary is required (text or recorded audio)");
  }
  if (
    input.clipEndMs <= input.clipStartMs ||
    input.clipEndMs - input.clipStartMs > MAX_CLIP_MS
  ) {
    throw new Error("Invalid clip span");
  }
}

interface AnnotationInsert {
  authorId: Id<"users">;
  sourceId: Id<"sources">;
  clipStorageId?: Id<"_storage">;
  clipStartMs?: number;
  clipEndMs?: number;
  textStart?: number;
  textEnd?: number;
  selectedText?: string;
  commentaryText?: string;
  commentaryAudioStorageId?: Id<"_storage">;
  commentaryAudioTranscript?: string;
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
    textStart: input.textStart,
    textEnd: input.textEnd,
    selectedText: input.selectedText,
    commentaryText: input.commentaryText,
    commentaryAudioStorageId: input.commentaryAudioStorageId,
    commentaryAudioTranscript: input.commentaryAudioTranscript,
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
    assertPublishable(args);

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
 * The public feed: published annotations newest-first, paginated, each joined
 * with author + source + clip URL. Real-time via the client's usePaginatedQuery.
 */
export const listFeed = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query("annotations")
      .withIndex("by_feed", (q) => q.eq("isPublic", true))
      .order("desc")
      .paginate(args.paginationOpts);
    return {
      ...result,
      page: await Promise.all(result.page.map((a) => toFeedItem(ctx, a))),
    };
  },
});

/** A user's published annotations, newest-first, shaped as feed cards. */
export const listByAuthor = query({
  args: { authorId: v.id("users") },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("annotations")
      .withIndex("by_author", (q) => q.eq("authorId", args.authorId))
      .order("desc")
      .collect();
    const published = rows.filter((a) => a.isPublic);
    return await Promise.all(published.map((a) => toFeedItem(ctx, a)));
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
    const commentaryAudioUrl = annotation.commentaryAudioStorageId
      ? await ctx.storage.getUrl(annotation.commentaryAudioStorageId)
      : null;

    return {
      ...annotation,
      clipUrl,
      commentaryAudioUrl,
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
          }
        : null,
    };
  },
});
