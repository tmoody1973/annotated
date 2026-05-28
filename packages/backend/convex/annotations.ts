import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { upsertArticleSource, upsertYoutubeSource } from "./sources";
import { requireCurrentUser } from "./users";
import { countWords, MAX_QUOTE_WORDS, rankAnnotations } from "@annotated/shared";

/** An article highlight is an excerpt — a few paragraphs at most, not a reprint. */
const MAX_HIGHLIGHT_CHARS = 2000;

const MIN_TOPICS = 1;
const MAX_TOPICS = 3;

/**
 * Shapes an annotation into the feed/profile card view: resolves the clip URL
 * and joins the source attribution + author. Shared by listFeed and listByAuthor.
 */
async function toFeedItem(ctx: QueryCtx, annotation: Doc<"annotations">) {
  const isAnonymous = annotation.isAnonymous ?? false;
  const source = await ctx.db.get(annotation.sourceId);
  // Never load/project the author when anonymous — the identity is masked.
  const author = isAnonymous ? null : await ctx.db.get(annotation.authorId);
  const clipUrl = annotation.clipStorageId
    ? await ctx.storage.getUrl(annotation.clipStorageId)
    : null;
  // The source-page screenshot (articles) — the feed card's citation visual when
  // there's no audio/video clip. Not identity-bearing, so shown even if anonymous.
  const screenshotUrl = annotation.screenshotStorageId
    ? await ctx.storage.getUrl(annotation.screenshotStorageId)
    : null;
  // A thread head card carries the count of clips in its thread (badge);
  // standalone clips count as 1.
  const clipCount = annotation.threadId
    ? (
        await ctx.db
          .query("annotations")
          .withIndex("by_thread", (q) => q.eq("threadId", annotation.threadId))
          .collect()
      ).length
    : 1;
  const topicRows = await ctx.db
    .query("annotationTopics")
    .withIndex("by_annotation", (q) => q.eq("annotationId", annotation._id))
    .collect();
  const topics = (
    await Promise.all(topicRows.map((r) => ctx.db.get(r.topicId)))
  )
    .filter((t): t is Doc<"topics"> => t !== null)
    .map((t) => ({ slug: t.slug, name: t.name }));
  return {
    _id: annotation._id,
    publishedAt: annotation.publishedAt,
    selectedText: annotation.selectedText,
    commentaryText: annotation.commentaryText,
    commentaryAudioTranscript: annotation.commentaryAudioTranscript,
    clipStartMs: annotation.clipStartMs,
    clipEndMs: annotation.clipEndMs,
    clipUrl,
    screenshotUrl,
    commentCount: annotation.commentCount,
    likeCount: annotation.likeCount,
    downCount: annotation.downCount ?? 0,
    threadId: annotation.threadId ?? null,
    clipCount,
    topics,
    isAnonymous,
    source: source
      ? {
          type: source.type,
          title: source.title,
          canonicalUrl: source.canonicalUrl,
          siteName: source.siteName,
          imageUrl: source.imageUrl,
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

/**
 * Publish-time topic guard: 1–3 distinct topics, each one a real `topics` row.
 * The id list arrives from the client, so never trust the count or membership.
 */
export async function assertTopics(
  ctx: MutationCtx,
  topicIds: Id<"topics">[]
): Promise<void> {
  if (topicIds.length < MIN_TOPICS || topicIds.length > MAX_TOPICS) {
    throw new Error("Pick 1-3 topics");
  }
  if (new Set(topicIds).size !== topicIds.length) {
    throw new Error("Duplicate topic");
  }
  for (const id of topicIds) {
    if (!(await ctx.db.get(id))) {
      throw new Error("Unknown topic");
    }
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
  screenshotStorageId?: Id<"_storage">;
  threadId?: Id<"threads">;
  isAnonymous?: boolean;
  topicIds?: Id<"topics">[];
}

/**
 * The 0-based position a new clip takes within a thread: the count of clips
 * already in it. Sequential publishing keeps the order gap-free.
 */
async function nextThreadOrder(
  ctx: MutationCtx,
  threadId: Id<"threads">
): Promise<number> {
  const existing = await ctx.db
    .query("annotations")
    .withIndex("by_thread", (q) => q.eq("threadId", threadId))
    .collect();
  return existing.length;
}

/**
 * Inserts an annotation with publishing defaults. Shared by the authed `create`
 * mutation and the test seed so both exercise the same persistence path. When a
 * `threadId` is given the clip is appended to that thread at the next order.
 */
export async function insertAnnotation(
  ctx: MutationCtx,
  input: AnnotationInsert
): Promise<Id<"annotations">> {
  const threadOrder =
    input.threadId !== undefined
      ? await nextThreadOrder(ctx, input.threadId)
      : undefined;
  const publishedAt = Date.now();
  const annotationId = await ctx.db.insert("annotations", {
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
    screenshotStorageId: input.screenshotStorageId,
    threadId: input.threadId,
    threadOrder,
    isAnonymous: input.isAnonymous,
    isPublic: true,
    publishedAt,
    commentCount: 0,
    likeCount: 0,
  });
  for (const topicId of input.topicIds ?? []) {
    await ctx.db.insert("annotationTopics", { annotationId, topicId, publishedAt });
  }
  return annotationId;
}

/**
 * Publishes a YouTube clip annotation as the signed-in user. Upserts the shared
 * source, then inserts the annotation. Author is derived from the Clerk identity
 * (`requireCurrentUser`) — never accepted as an argument. Mirrors the field set
 * the sidepanel collects (audio commentary, anonymity, thread append), enforcing
 * the same `assertPublishable` invariants as the dev seed path.
 */
export const createYoutube = mutation({
  args: {
    videoId: v.string(),
    title: v.string(),
    author: v.optional(v.string()),
    thumbnailUrl: v.optional(v.string()),
    durationMs: v.optional(v.number()),
    clipStorageId: v.id("_storage"),
    clipStartMs: v.number(),
    clipEndMs: v.number(),
    commentaryText: v.optional(v.string()),
    commentaryAudioStorageId: v.optional(v.id("_storage")),
    commentaryAudioTranscript: v.optional(v.string()),
    isAnonymous: v.optional(v.boolean()),
    threadId: v.optional(v.id("threads")),
    topicIds: v.array(v.id("topics")),
  },
  returns: v.id("annotations"),
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    assertPublishable(args);
    await assertTopics(ctx, args.topicIds);
    // A clip may only be appended to a thread the caller owns — the threadId
    // arrives from the client, so never trust it to belong to this author.
    if (args.threadId) {
      const thread = await ctx.db.get(args.threadId);
      if (!thread || thread.authorId !== user._id) {
        throw new Error("Cannot append to a thread you do not own");
      }
    }

    const sourceId = await upsertYoutubeSource(ctx, args);
    return await insertAnnotation(ctx, {
      authorId: user._id,
      sourceId,
      clipStorageId: args.clipStorageId,
      clipStartMs: args.clipStartMs,
      clipEndMs: args.clipEndMs,
      commentaryText: args.commentaryText,
      commentaryAudioStorageId: args.commentaryAudioStorageId,
      commentaryAudioTranscript: args.commentaryAudioTranscript,
      isAnonymous: args.isAnonymous,
      threadId: args.threadId,
      topicIds: args.topicIds,
    });
  },
});

/**
 * Publishes a podcast clip annotation as the signed-in user. The source row is
 * identified by the `sourceId` created during the podcast-resolution step
 * (Step 6). Validates that the source is actually a podcast, that the transcript
 * quote is non-empty, and that the clip span + commentary meet the publish
 * invariants. Author is derived from the Clerk identity — never accepted as an
 * argument.
 */
export const createPodcast = mutation({
  args: {
    sourceId: v.id("sources"),
    clipStorageId: v.id("_storage"),
    clipStartMs: v.number(),
    clipEndMs: v.number(),
    selectedText: v.string(),
    commentaryText: v.optional(v.string()),
    commentaryAudioStorageId: v.optional(v.id("_storage")),
    commentaryAudioTranscript: v.optional(v.string()),
    isAnonymous: v.optional(v.boolean()),
    threadId: v.optional(v.id("threads")),
    topicIds: v.array(v.id("topics")),
  },
  returns: v.id("annotations"),
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const source = await ctx.db.get(args.sourceId);
    if (!source || source.type !== "podcast") {
      throw new Error("Source is not a podcast");
    }
    if (args.selectedText.trim().length === 0) {
      throw new Error("A transcript quote is required");
    }
    assertPublishable(args);
    await assertTopics(ctx, args.topicIds);
    if (args.threadId) {
      const thread = await ctx.db.get(args.threadId);
      if (!thread || thread.authorId !== user._id) {
        throw new Error("Cannot append to a thread you do not own");
      }
    }
    return await insertAnnotation(ctx, {
      authorId: user._id,
      sourceId: args.sourceId,
      clipStorageId: args.clipStorageId,
      clipStartMs: args.clipStartMs,
      clipEndMs: args.clipEndMs,
      selectedText: args.selectedText,
      commentaryText: args.commentaryText,
      commentaryAudioStorageId: args.commentaryAudioStorageId,
      commentaryAudioTranscript: args.commentaryAudioTranscript,
      isAnonymous: args.isAnonymous,
      threadId: args.threadId,
      topicIds: args.topicIds,
    });
  },
});

/**
 * Publishes an article clip annotation as the signed-in user. An article has
 * no media clip — the "clip" is the highlighted quote (`selectedText` +
 * char offsets) plus commentary. Does NOT call `assertPublishable` (which
 * assumes an audio/video span); instead validates the quote, offsets, and
 * commentary directly. Upserts the article source by canonical URL. Author is
 * derived from the Clerk identity — never accepted as an argument.
 */
export const createArticle = mutation({
  args: {
    canonicalUrl: v.string(),
    title: v.string(),
    siteName: v.optional(v.string()),
    author: v.optional(v.string()),
    sourceImageUrl: v.optional(v.string()),
    selectedText: v.string(),
    textStart: v.number(),
    textEnd: v.number(),
    commentaryText: v.optional(v.string()),
    commentaryAudioStorageId: v.optional(v.id("_storage")),
    commentaryAudioTranscript: v.optional(v.string()),
    screenshotStorageId: v.optional(v.id("_storage")),
    isAnonymous: v.optional(v.boolean()),
    threadId: v.optional(v.id("threads")),
    topicIds: v.array(v.id("topics")),
  },
  returns: v.id("annotations"),
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    if (args.selectedText.trim().length === 0) {
      throw new Error("A highlighted quote is required");
    }
    const hasCommentaryText = (args.commentaryText ?? "").trim().length > 0;
    if (!hasCommentaryText && args.commentaryAudioStorageId === undefined) {
      throw new Error("Commentary is required (text or recorded audio)");
    }
    if (
      !Number.isInteger(args.textStart) ||
      !Number.isInteger(args.textEnd) ||
      args.textStart < 0 ||
      args.selectedText.length !== args.textEnd - args.textStart
    ) {
      throw new Error("Highlight offsets are invalid");
    }
    if (args.selectedText.length > MAX_HIGHLIGHT_CHARS) {
      throw new Error(
        `Highlight exceeds the ${MAX_HIGHLIGHT_CHARS}-character excerpt limit`
      );
    }
    if (countWords(args.selectedText) > MAX_QUOTE_WORDS) {
      throw new Error(
        `Highlight exceeds the ${MAX_QUOTE_WORDS}-word fair-use limit`
      );
    }
    await assertTopics(ctx, args.topicIds);
    if (args.threadId) {
      const thread = await ctx.db.get(args.threadId);
      if (!thread || thread.authorId !== user._id) {
        throw new Error("Cannot append to a thread you do not own");
      }
    }
    const sourceId = await upsertArticleSource(ctx, {
      canonicalUrl: args.canonicalUrl,
      title: args.title,
      siteName: args.siteName,
      author: args.author,
      imageUrl: args.sourceImageUrl,
    });
    return await insertAnnotation(ctx, {
      authorId: user._id,
      sourceId,
      selectedText: args.selectedText,
      textStart: args.textStart,
      textEnd: args.textEnd,
      commentaryText: args.commentaryText,
      commentaryAudioStorageId: args.commentaryAudioStorageId,
      commentaryAudioTranscript: args.commentaryAudioTranscript,
      screenshotStorageId: args.screenshotStorageId,
      isAnonymous: args.isAnonymous,
      threadId: args.threadId,
      topicIds: args.topicIds,
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
    // Collapse threads: show only the head (order 0); follow-on clips are
    // represented by the head's "N clips" badge, not their own card.
    const heads = result.page.filter(
      (a) => a.threadId === undefined || a.threadOrder === 0
    );
    return {
      ...result,
      page: await Promise.all(heads.map((a) => toFeedItem(ctx, a))),
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
    // Anonymous annotations are masked everywhere — they never surface on the
    // author's own public profile either.
    const published = rows.filter((a) => a.isPublic && !a.isAnonymous);
    return await Promise.all(published.map((a) => toFeedItem(ctx, a)));
  },
});

const TOPIC_CANDIDATE_CAP = 1000;
const TOPIC_PAGE_SIZE = 50;

/**
 * A topic room: published clips carrying `slug`, ranked by `sort`. Candidates are
 * the most-recent rows from the `by_topic` index (capped), thread follow-ons are
 * collapsed to their head, then the pure ranker orders them. Null when the slug
 * is unknown so the page can 404.
 */
export const listByTopic = query({
  args: {
    slug: v.string(),
    sort: v.union(v.literal("hot"), v.literal("top"), v.literal("new")),
  },
  handler: async (ctx, args) => {
    const topic = await ctx.db
      .query("topics")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
    if (!topic) return null;

    const joins = await ctx.db
      .query("annotationTopics")
      .withIndex("by_topic", (q) => q.eq("topicId", topic._id))
      .order("desc")
      .take(TOPIC_CANDIDATE_CAP);

    const annotations = (
      await Promise.all(joins.map((j) => ctx.db.get(j.annotationId)))
    ).filter(
      (a): a is Doc<"annotations"> =>
        a !== null &&
        a.isPublic &&
        (a.threadId === undefined || a.threadOrder === 0)
    );

    const ranked = rankAnnotations(annotations, args.sort).slice(0, TOPIC_PAGE_SIZE);
    return {
      topic: { slug: topic.slug, name: topic.name, description: topic.description },
      items: await Promise.all(ranked.map((a) => toFeedItem(ctx, a))),
    };
  },
});

/**
 * Shapes an annotation into the full landing view: the clip/audio URLs, the
 * source attribution, and the author. Shared by `getById` and the thread page
 * (`threads.getWithClips`) so a clip renders identically standalone or in a
 * thread.
 */
export async function toLandingView(
  ctx: QueryCtx,
  annotation: Doc<"annotations">
) {
  const isAnonymous = annotation.isAnonymous ?? false;
  const source = await ctx.db.get(annotation.sourceId);
  // Never load/project the author when anonymous — the identity is masked.
  const author = isAnonymous ? null : await ctx.db.get(annotation.authorId);
  const clipUrl = annotation.clipStorageId
    ? await ctx.storage.getUrl(annotation.clipStorageId)
    : null;
  const commentaryAudioUrl = annotation.commentaryAudioStorageId
    ? await ctx.storage.getUrl(annotation.commentaryAudioStorageId)
    : null;
  const screenshotUrl = annotation.screenshotStorageId
    ? await ctx.storage.getUrl(annotation.screenshotStorageId)
    : null;

  return {
    ...annotation,
    // Mask the author's row id from the public payload when anonymous (kept on
    // the stored row for claims/moderation, never projected). Convex drops
    // `undefined` fields from the return, so it isn't sent to the client.
    ...(isAnonymous ? { authorId: undefined } : {}),
    isAnonymous,
    // Pre-§2 rows have no `downCount`; default to 0 so the vote control gets a
    // number (mirrors the `listFeed` projection).
    downCount: annotation.downCount ?? 0,
    clipUrl,
    commentaryAudioUrl,
    screenshotUrl,
    source: source
      ? {
          canonicalUrl: source.canonicalUrl,
          title: source.title,
          type: source.type,
          siteName: source.siteName,
          author: source.author,
          imageUrl: source.imageUrl,
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
}

/**
 * Returns an annotation with the joined data the landing page renders: the clip
 * video URL, the source attribution, and the author. Null if not found. If the
 * clip belongs to a thread, also returns its `threadId`/`threadOrder` (the page
 * redirects threaded clips to /t/[threadId]).
 */
export const getById = query({
  args: { annotationId: v.id("annotations") },
  handler: async (ctx, args) => {
    const annotation = await ctx.db.get(args.annotationId);
    if (!annotation) return null;
    return await toLandingView(ctx, annotation);
  },
});
