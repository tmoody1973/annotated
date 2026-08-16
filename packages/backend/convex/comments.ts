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
/** Intents a person may choose. `source_response` is placed by the slot, not here. */
const COMPOSER_INTENTS = v.union(
  v.literal("context"),
  v.literal("challenge"),
  v.literal("support"),
  v.literal("question"),
  v.literal("source_response"),
);

/** Intents that assert a source, and so read as Unsourced when none is attached. */
const SOURCE_CLAIMING_INTENTS = new Set(["challenge", "support"]);

const MAX_EVIDENCE_URL_LENGTH = 2_000;

/**
 * Validates the receipt on a reply, if there is one.
 *
 * At most one, and it has to still be something a reader can actually open: a
 * removed clip must not come back into circulation because somebody cited it,
 * which would quietly undo the author's removal.
 */
async function validateEvidence(
  ctx: QueryCtx,
  args: {
    annotationId: Id<"annotations">;
    evidenceAnnotationId?: Id<"annotations">;
    evidenceUrl?: string;
  },
): Promise<void> {
  if (args.evidenceAnnotationId && args.evidenceUrl) {
    throw new Error("A reply carries one receipt, not two");
  }

  if (args.evidenceAnnotationId) {
    if (args.evidenceAnnotationId === args.annotationId) {
      throw new Error("A clip can't cite itself");
    }
    const evidence = await ctx.db.get(args.evidenceAnnotationId);
    if (!evidence || !evidence.isPublic || evidence.removedAt !== undefined) {
      throw new Error("That clip is no longer available to cite");
    }
  }

  if (args.evidenceUrl !== undefined) {
    const url = args.evidenceUrl.trim();
    if (url.length > MAX_EVIDENCE_URL_LENGTH) {
      throw new Error("That web link is too long");
    }
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new Error("A receipt needs a web link starting with http or https");
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("A receipt needs a web link starting with http or https");
    }
  }
}

export const add = mutation({
  args: {
    annotationId: v.id("annotations"),
    text: v.string(),
    parentId: v.optional(v.id("comments")),
    intent: v.optional(COMPOSER_INTENTS),
    evidenceAnnotationId: v.optional(v.id("annotations")),
    evidenceUrl: v.optional(v.string()),
  },
  returns: v.id("comments"),
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const text = args.text.trim();
    if (text.length === 0) {
      throw new Error("Comment can't be empty");
    }

    // Anyone could otherwise mint a reply that reads as the source owner's.
    // The slot is the only route in, and it is operator-placed until domain
    // verification exists.
    if (args.intent === "source_response") {
      throw new Error("A right of reply can only be placed by the source owner");
    }

    const annotation = await ctx.db.get(args.annotationId);
    if (!annotation) {
      throw new Error("Annotation not found");
    }

    await validateEvidence(ctx, args);

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
      ...(args.intent ? { intent: args.intent } : {}),
      ...(args.evidenceAnnotationId
        ? { evidenceAnnotationId: args.evidenceAnnotationId }
        : {}),
      ...(args.evidenceUrl ? { evidenceUrl: args.evidenceUrl.trim() } : {}),
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
        // A removed note keeps its place so replies hanging off it still make
        // sense, but its words are gone — including from the API, not merely
        // hidden in the UI.
        const removed = comment.removedAt !== undefined;
        const author = await ctx.db.get(comment.authorId);
        const likes = await ctx.db
          .query("commentLikes")
          .withIndex("by_comment", (q) => q.eq("commentId", comment._id))
          .collect();
        return {
          _id: comment._id,
          parentId: comment.parentId ?? null,
          text: removed ? "" : comment.text,
          removed,
          intent: comment.intent ?? null,
          evidence: removed ? null : await resolveEvidence(ctx, comment),
          // Only an intent that claims a source can be missing one. A plain
          // note never promised evidence, so it is not marked short of it.
          unsourced:
            !removed &&
            comment.intent !== undefined &&
            SOURCE_CLAIMING_INTENTS.has(comment.intent) &&
            comment.evidenceAnnotationId === undefined &&
            comment.evidenceUrl === undefined,
          isOwn: viewerId !== null && comment.authorId === viewerId,
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

/** What the thread needs to render a receipt, or null when the reply has none. */
type ResolvedEvidence =
  | {
      kind: "annotation";
      annotationId: Id<"annotations">;
      removed: boolean;
      /** Absent once removed — the take is exactly what removal took away. */
      takeText?: string;
      clipUrl?: string | null;
      sourceTitle?: string;
      sourceUrl?: string;
      sourceType?: string;
    }
  | { kind: "url"; url: string }
  | null;

/**
 * Joins a reply's receipt into something playable.
 *
 * A cited clip can be removed after it was cited, so this re-checks on every
 * read rather than trusting the check made at write time. When that happens the
 * card degrades to a notice and the take is not projected at all — hiding it in
 * the UI would still ship the words to every client.
 */
async function resolveEvidence(
  ctx: QueryCtx,
  comment: {
    evidenceAnnotationId?: Id<"annotations">;
    evidenceUrl?: string;
  },
): Promise<ResolvedEvidence> {
  if (comment.evidenceUrl) return { kind: "url", url: comment.evidenceUrl };
  if (!comment.evidenceAnnotationId) return null;

  const evidence = await ctx.db.get(comment.evidenceAnnotationId);
  if (!evidence || !evidence.isPublic || evidence.removedAt !== undefined) {
    return {
      kind: "annotation",
      annotationId: comment.evidenceAnnotationId,
      removed: true,
    };
  }

  const source = await ctx.db.get(evidence.sourceId);
  return {
    kind: "annotation",
    annotationId: evidence._id,
    removed: false,
    takeText: evidence.takeText ?? evidence.commentaryText,
    clipUrl: evidence.clipStorageId
      ? await ctx.storage.getUrl(evidence.clipStorageId)
      : null,
    ...(source
      ? {
          sourceTitle: source.title,
          sourceUrl: source.canonicalUrl,
          sourceType: source.type,
        }
      : {}),
  };
}

/**
 * Whether this clip's source owner has a seat, and whether they have used it.
 *
 * The slot appears only once someone has actually challenged the clip. That
 * keeps an empty box off every quiet page, and it makes the promise concrete at
 * the moment it matters: the instant a clip is contested, its subject's place
 * in the thread exists and is visible, above the challenge.
 *
 * "Standing, not veto" — the response occupies a reserved position and can do
 * nothing else. It cannot hide, delete, or outrank the challenge it answers.
 */
export const rightOfReply = query({
  args: { annotationId: v.id("annotations") },
  handler: async (ctx, args) => {
    const hidden = { show: false, response: null, sourceTitle: null };

    const comments = await ctx.db
      .query("comments")
      .withIndex("by_annotation", (q) => q.eq("annotationId", args.annotationId))
      .collect();
    const visible = comments.filter((c) => c.removedAt === undefined);
    if (!visible.some((c) => c.intent === "challenge")) return hidden;

    const annotation = await ctx.db.get(args.annotationId);
    if (!annotation) return hidden;
    const source = await ctx.db.get(annotation.sourceId);

    const placed = visible.find((c) => c.intent === "source_response");
    return {
      show: true,
      sourceTitle: source?.title ?? null,
      response: placed
        ? { _id: placed._id, text: placed.text, createdAt: placed.createdAt }
        : null,
    };
  },
});

/**
 * The author deletes their own note.
 *
 * Soft, like an annotation, and for the same reason plus one: a note can have
 * replies hanging off it, and hard-deleting the parent would orphan them. The
 * row stays, `listByAnnotation` renders it as removed, and the thread holds
 * its shape.
 *
 * `commentCount` is decremented so the card's "N notes" matches what a reader
 * can actually see.
 */
export const remove = mutation({
  args: { commentId: v.id("comments") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const comment = await ctx.db.get(args.commentId);
    if (!comment) throw new Error("That note no longer exists");
    if (comment.authorId !== user._id) {
      throw new Error("Only the person who wrote this can delete it");
    }
    if (comment.removedAt !== undefined) return null;

    await ctx.db.patch(args.commentId, { removedAt: Date.now() });

    const annotation = await ctx.db.get(comment.annotationId);
    if (annotation) {
      await ctx.db.patch(comment.annotationId, {
        commentCount: Math.max(0, annotation.commentCount - 1),
      });
    }
    return null;
  },
});
