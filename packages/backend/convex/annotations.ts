import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { upsertArticleSource, upsertYoutubeSource, youtubeThumbnailFor } from "./sources";
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
      ).filter(isVisible).length
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
  const takeText = annotation.takeText ?? annotation.commentaryText;
  const takeAudioTranscript =
    annotation.takeAudioTranscript ?? annotation.commentaryAudioTranscript;
  return {
    _id: annotation._id,
    publishedAt: annotation.publishedAt,
    selectedText: annotation.selectedText,
    takeText,
    takeAudioTranscript,
    // Transitional: the deployed web app still reads the pre-rename keys.
    // Drop once it has shipped with takeText/takeAudioTranscript.
    commentaryText: takeText,
    commentaryAudioTranscript: takeAudioTranscript,
    clipStartMs: annotation.clipStartMs,
    clipEndMs: annotation.clipEndMs,
    clipUrl,
    // Absent means "ready" (pre-optimistic-publish rows never set it).
    mediaState: annotation.mediaState,
    screenshotUrl,
    commentCount: annotation.commentCount,
    likeCount: annotation.likeCount,
    downCount: annotation.downCount ?? 0,
    threadId: annotation.threadId ?? null,
    clipCount,
    topics,
    isAnonymous,
    isEditorPick: annotation.isEditorPick ?? false,
    source: source
      ? {
          type: source.type,
          title: source.title,
          canonicalUrl: source.canonicalUrl,
          siteName: source.siteName,
          imageUrl: source.imageUrl,
          // Creator attribution: journalist (article), show (podcast), channel
          // name + link (youtube). Surfaced as a prominent byline on the card.
          author: source.author,
          podcastName: source.podcastName,
          youtubeChannelUrl: source.youtubeChannelUrl,
        }
      : null,
    author: author
      ? {
          username: author.username,
          displayName: author.displayName,
          avatarUrl: author.avatarUrl,
          isVerified: author.isVerified ?? false,
        }
      : null,
  };
}

/** SPEC: clips are capped at 90 seconds. */
export const MAX_CLIP_MS = 90_000;

/**
 * A removed annotation is invisible everywhere it would otherwise be listed.
 *
 * Removal is soft — the row stays so its URL keeps resolving to a tombstone
 * rather than a 404, because the link may already be pasted somewhere. That
 * makes filtering the *listing* queries load-bearing: miss one and a removed
 * clip quietly comes back. Every place that lists annotations calls this.
 */
export function isVisible(annotation: { removedAt?: number }): boolean {
  return annotation.removedAt === undefined;
}


/**
 * Validates the publish-time invariants shared by the authed `create` mutation
 * and the dev seed publish: a take must be present as text OR recorded audio
 * (SPEC), and the clip span must be ordered and within the 90s cap. Throws with
 * a readable reason.
 */
/**
 * Pre-rename publish arguments, still accepted.
 *
 * A sideloaded Chrome extension does NOT auto-update, so every build installed
 * before the commentary→take rename keeps sending the old field names forever.
 * Convex arg validators reject unknown fields outright, so omitting these means
 * "Object contains extra field `commentaryText`" and publishing simply stops
 * working for those users — with no upgrade prompt and no way for them to know.
 *
 * Accept them, map them forward in `resolveTake`, and drop this once the
 * installed base has moved. Nothing writes these names.
 */
const legacyTakeArgs = {
  commentaryText: v.optional(v.string()),
  commentaryAudioStorageId: v.optional(v.id("_storage")),
  commentaryAudioTranscript: v.optional(v.string()),
};

interface TakeFields {
  takeText?: string;
  takeAudioStorageId?: Id<"_storage">;
  takeAudioTranscript?: string;
  commentaryText?: string;
  commentaryAudioStorageId?: Id<"_storage">;
  commentaryAudioTranscript?: string;
}

/** The take, whichever generation of field names the caller used. */
export function resolveTake(args: TakeFields): {
  takeText?: string;
  takeAudioStorageId?: Id<"_storage">;
  takeAudioTranscript?: string;
} {
  return {
    takeText: args.takeText ?? args.commentaryText,
    takeAudioStorageId: args.takeAudioStorageId ?? args.commentaryAudioStorageId,
    takeAudioTranscript:
      args.takeAudioTranscript ?? args.commentaryAudioTranscript,
  };
}

export function assertPublishable(input: {
  takeText?: string;
  takeAudioStorageId?: Id<"_storage">;
  clipStartMs: number;
  clipEndMs: number;
}): void {
  const hasText = (input.takeText ?? "").trim().length > 0;
  const hasAudio = input.takeAudioStorageId !== undefined;
  if (!hasText && !hasAudio) {
    throw new Error("A take is required (text or recorded audio)");
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
  mediaState?: "processing" | "ready" | "failed";
  clipStartMs?: number;
  clipEndMs?: number;
  textStart?: number;
  textEnd?: number;
  selectedText?: string;
  takeText?: string;
  takeAudioStorageId?: Id<"_storage">;
  takeAudioTranscript?: string;
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
    mediaState: input.mediaState,
    clipStartMs: input.clipStartMs,
    clipEndMs: input.clipEndMs,
    textStart: input.textStart,
    textEnd: input.textEnd,
    selectedText: input.selectedText,
    takeText: input.takeText,
    takeAudioStorageId: input.takeAudioStorageId,
    takeAudioTranscript: input.takeAudioTranscript,
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
 * the sidepanel collects (audio take, anonymity, thread append), enforcing
 * the same `assertPublishable` invariants as the dev seed path.
 */
export const createYoutube = mutation({
  args: {
    videoId: v.string(),
    title: v.string(),
    author: v.optional(v.string()),
    channelUrl: v.optional(v.string()),
    thumbnailUrl: v.optional(v.string()),
    durationMs: v.optional(v.number()),
    clipStorageId: v.optional(v.id("_storage")),
    clipStartMs: v.number(),
    clipEndMs: v.number(),
    takeText: v.optional(v.string()),
    takeAudioStorageId: v.optional(v.id("_storage")),
    takeAudioTranscript: v.optional(v.string()),
    ...legacyTakeArgs,
    isAnonymous: v.optional(v.boolean()),
    threadId: v.optional(v.id("threads")),
    topicIds: v.array(v.id("topics")),
  },
  returns: v.id("annotations"),
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const take = resolveTake(args);
    assertPublishable({ ...args, ...take });
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
    const annotationId = await insertAnnotation(ctx, {
      authorId: user._id,
      sourceId,
      clipStorageId: args.clipStorageId,
      mediaState: args.clipStorageId === undefined ? "processing" : "ready",
      clipStartMs: args.clipStartMs,
      clipEndMs: args.clipEndMs,
      ...take,
      isAnonymous: args.isAnonymous,
      threadId: args.threadId,
      topicIds: args.topicIds,
    });

    // Optimistic publish: the row (and its URL) exist now; the slice happens
    // after. Skipped when the caller already supplied a clip.
    if (args.clipStorageId === undefined) {
      await ctx.scheduler.runAfter(0, internal.clips.sliceYoutube, {
        annotationId,
        videoId: args.videoId,
        startMs: args.clipStartMs,
        endMs: args.clipEndMs,
      });
    }
    return annotationId;
  },
});

/**
 * Publishes a podcast clip annotation as the signed-in user. The source row is
 * identified by the `sourceId` created during the podcast-resolution step
 * (Step 6). Validates that the source is actually a podcast, that the transcript
 * quote is non-empty, and that the clip span + take meet the publish
 * invariants. Author is derived from the Clerk identity — never accepted as an
 * argument.
 */
export const createPodcast = mutation({
  args: {
    sourceId: v.id("sources"),
    clipStorageId: v.optional(v.id("_storage")),
    clipStartMs: v.number(),
    clipEndMs: v.number(),
    selectedText: v.string(),
    takeText: v.optional(v.string()),
    takeAudioStorageId: v.optional(v.id("_storage")),
    takeAudioTranscript: v.optional(v.string()),
    ...legacyTakeArgs,
    isAnonymous: v.optional(v.boolean()),
    threadId: v.optional(v.id("threads")),
    topicIds: v.array(v.id("topics")),
  },
  returns: v.id("annotations"),
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const take = resolveTake(args);
    const source = await ctx.db.get(args.sourceId);
    if (!source || source.type !== "podcast") {
      throw new Error("Source is not a podcast");
    }
    if (args.selectedText.trim().length === 0) {
      throw new Error("A transcript quote is required");
    }
    assertPublishable({ ...args, ...take });
    await assertTopics(ctx, args.topicIds);
    if (args.threadId) {
      const thread = await ctx.db.get(args.threadId);
      if (!thread || thread.authorId !== user._id) {
        throw new Error("Cannot append to a thread you do not own");
      }
    }
    const annotationId = await insertAnnotation(ctx, {
      authorId: user._id,
      sourceId: args.sourceId,
      clipStorageId: args.clipStorageId,
      mediaState: args.clipStorageId === undefined ? "processing" : "ready",
      clipStartMs: args.clipStartMs,
      clipEndMs: args.clipEndMs,
      selectedText: args.selectedText,
      ...take,
      isAnonymous: args.isAnonymous,
      threadId: args.threadId,
      topicIds: args.topicIds,
    });

    if (args.clipStorageId === undefined) {
      // `.first()`, not `.unique()`: concurrent transcribe requests for the
      // same episode can insert more than one row (no dedup upstream), and
      // the first is the timeline-correct one — the row whose word
      // timestamps the extension actually displayed.
      const transcript = await ctx.db
        .query("transcripts")
        .withIndex("by_source", (q) => q.eq("sourceId", args.sourceId))
        .first();
      // The frozen episode is what the displayed word timestamps belong to.
      // Clipping the live enclosure would drift against ad insertion (9cf7ac0).
      if (!transcript || transcript.status === "pending" || transcript.status === "processing") {
        // Transient: transcription hasn't finished yet, retrying later works.
        throw new Error(
          "This episode isn't ready to clip yet — its audio is still being prepared."
        );
      }
      if (transcript.status === "failed" || !transcript.episodeStorageId) {
        // Permanent: transcription itself failed, or it finished but the
        // frozen download failed (transcribe.ts's live-URL fallback) — no
        // episode audio will ever show up here, so don't tell the user to wait.
        throw new Error(
          "This episode's audio couldn't be prepared for clipping. Try a different clip."
        );
      }
      await ctx.scheduler.runAfter(0, internal.clips.slicePodcast, {
        annotationId,
        episodeStorageId: transcript.episodeStorageId,
        startMs: args.clipStartMs,
        endMs: args.clipEndMs,
      });
    }
    return annotationId;
  },
});

/**
 * Publishes an article clip annotation as the signed-in user. An article has
 * no media clip — the "clip" is the highlighted quote (`selectedText` +
 * char offsets) plus a take. Does NOT call `assertPublishable` (which
 * assumes an audio/video span); instead validates the quote, offsets, and
 * take directly. Upserts the article source by canonical URL. Author is
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
    takeText: v.optional(v.string()),
    takeAudioStorageId: v.optional(v.id("_storage")),
    takeAudioTranscript: v.optional(v.string()),
    ...legacyTakeArgs,
    screenshotStorageId: v.optional(v.id("_storage")),
    isAnonymous: v.optional(v.boolean()),
    threadId: v.optional(v.id("threads")),
    topicIds: v.array(v.id("topics")),
  },
  returns: v.id("annotations"),
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const take = resolveTake(args);
    if (args.selectedText.trim().length === 0) {
      throw new Error("A highlighted quote is required");
    }
    const hasTakeText = (take.takeText ?? "").trim().length > 0;
    if (!hasTakeText && take.takeAudioStorageId === undefined) {
      throw new Error("A take is required (text or recorded audio)");
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
      ...take,
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
      (a) => isVisible(a) && (a.threadId === undefined || a.threadOrder === 0)
    );
    return {
      ...result,
      page: await Promise.all(heads.map((a) => toFeedItem(ctx, a))),
    };
  },
});

/**
 * The signed-out default feed (§1 cold-start): editor-picked clips only, newest
 * first, threads collapsed to their head — a hand-picked highlight reel instead
 * of an empty "For You". Same card shape as listFeed so the UI is interchangeable.
 */
export const listCurated = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query("annotations")
      .withIndex("by_curated", (q) => q.eq("isEditorPick", true))
      .order("desc")
      .paginate(args.paginationOpts);
    const heads = result.page.filter(
      (a) => isVisible(a) && a.isPublic && (a.threadId === undefined || a.threadOrder === 0)
    );
    return {
      ...result,
      page: await Promise.all(heads.map((a) => toFeedItem(ctx, a))),
    };
  },
});

/**
 * Curate (or un-curate) a clip for the signed-out Editor's Picks feed. Internal:
 * reachable only via the dashboard or `npx convex run annotations:setEditorPick
 * '{"annotationId":"…","isEditorPick":true}'` — never exposed to clients.
 */
export const setEditorPick = internalMutation({
  args: { annotationId: v.id("annotations"), isEditorPick: v.boolean() },
  handler: async (ctx, args) => {
    const annotation = await ctx.db.get(args.annotationId);
    if (!annotation) throw new Error("Annotation not found");
    await ctx.db.patch(args.annotationId, { isEditorPick: args.isEditorPick });
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
    const published = rows.filter((a) => isVisible(a) && a.isPublic && !a.isAnonymous);
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
        isVisible(a) &&
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
  const takeAudioStorageId =
    annotation.takeAudioStorageId ?? annotation.commentaryAudioStorageId;
  const takeAudioUrl = takeAudioStorageId
    ? await ctx.storage.getUrl(takeAudioStorageId)
    : null;
  const screenshotUrl = annotation.screenshotStorageId
    ? await ctx.storage.getUrl(annotation.screenshotStorageId)
    : null;
  const takeText = annotation.takeText ?? annotation.commentaryText;
  const takeAudioTranscript =
    annotation.takeAudioTranscript ?? annotation.commentaryAudioTranscript;

  return {
    // The page must resolve even after removal — the link may be pasted
    // somewhere — so it renders a tombstone rather than 404ing.
    removed: annotation.removedAt !== undefined,
    canEditTake: canEditTake(annotation),
    ...annotation,
    // Mask the author's row id from the public payload when anonymous (kept on
    // the stored row for claims/moderation, never projected). Convex drops
    // `undefined` fields from the return, so it isn't sent to the client.
    ...(isAnonymous ? { authorId: undefined } : {}),
    isAnonymous,
    // Pre-§2 rows have no `downCount`; default to 0 so the vote control gets a
    // number (mirrors the `listFeed` projection).
    downCount: annotation.downCount ?? 0,
    takeText,
    takeAudioTranscript,
    clipUrl,
    takeAudioUrl,
    // Transitional: the deployed web app still reads the pre-rename keys
    // (the `...annotation` spread above only carries their *raw*, possibly
    // undefined, DB values for post-rename rows — these overrides make them
    // correct for every row's vintage). Drop once it has shipped with
    // takeText/takeAudioUrl/takeAudioTranscript.
    commentaryText: takeText,
    commentaryAudioUrl: takeAudioUrl,
    commentaryAudioTranscript: takeAudioTranscript,
    screenshotUrl,
    source: source
      ? {
          canonicalUrl: source.canonicalUrl,
          title: source.title,
          type: source.type,
          siteName: source.siteName,
          author: source.author,
          imageUrl: source.imageUrl,
          youtubeThumbnailUrl: youtubeThumbnailFor(source),
          podcastName: source.podcastName,
          youtubeChannelUrl: source.youtubeChannelUrl,
        }
      : null,
    author: author
      ? {
          id: author._id,
          username: author.username,
          displayName: author.displayName,
          avatarUrl: author.avatarUrl,
          isVerified: author.isVerified ?? false,
        }
      : null,
    // A removed annotation keeps its row and its URL — the link must not 404 —
    // but stops serving what was taken down. Blanked here, last, rather than in
    // each page: `toLandingView` feeds the landing page, the OG unfurl, the
    // share card and the thread page, and every one of those would otherwise
    // keep showing a take its author deleted. The source stays, because the
    // citation is what the tombstone still has to offer.
    ...(annotation.removedAt !== undefined
      ? {
          selectedText: undefined,
          takeText: undefined,
          takeAudioTranscript: undefined,
          takeAudioUrl: null,
          commentaryText: undefined,
          commentaryAudioUrl: null,
          commentaryAudioTranscript: undefined,
          clipUrl: null,
          screenshotUrl: null,
        }
      : {}),
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

/**
 * The author removes their own annotation.
 *
 * Soft, deliberately. The whole product premise is that a clip page is a
 * receipt someone else can cite, so the URL has to keep resolving — a hard
 * delete turns every pasted link into a 404 and quietly rewrites what other
 * people saw. The row stays, every listing hides it, and the page renders a
 * tombstone.
 *
 * The clip blob is dropped, because that is the expensive part and nothing
 * renders it again.
 */
export const remove = mutation({
  args: { annotationId: v.id("annotations") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const annotation = await ctx.db.get(args.annotationId);
    if (!annotation) throw new Error("That clip no longer exists");
    if (annotation.authorId !== user._id) {
      throw new Error("Only the person who published this can remove it");
    }
    if (annotation.removedAt !== undefined) return null;

    if (annotation.clipStorageId) {
      await ctx.storage.delete(annotation.clipStorageId);
    }
    await ctx.db.patch(args.annotationId, {
      removedAt: Date.now(),
      clipStorageId: undefined,
    });
    return null;
  },
});

/** How long a take stays editable once someone has engaged with it: not at all. */
export function canEditTake(annotation: {
  commentCount: number;
  likeCount: number;
  removedAt?: number;
}): boolean {
  return (
    annotation.removedAt === undefined &&
    annotation.commentCount === 0 &&
    annotation.likeCount === 0
  );
}

/**
 * Fix a take that nobody has engaged with yet.
 *
 * Not a general edit. A published take is what other people voted on and
 * replied to, and rewriting it afterwards changes what they endorsed — that is
 * the opposite of publishing a receipt. But a typo you spot ten seconds after
 * publishing is a real thing, so the take stays editable right up until the
 * first vote or comment, and then never again.
 */
export const updateTake = mutation({
  args: { annotationId: v.id("annotations"), takeText: v.string() },
  returns: v.object({ updated: v.boolean(), reason: v.optional(v.string()) }),
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const annotation = await ctx.db.get(args.annotationId);
    if (!annotation) throw new Error("That clip no longer exists");
    if (annotation.authorId !== user._id) {
      throw new Error("Only the person who published this can edit it");
    }

    const text = args.takeText.trim();
    if (text.length === 0) {
      return { updated: false, reason: "A take can't be empty" };
    }
    if (text.length > 5_000) {
      return { updated: false, reason: "That take is too long" };
    }
    if (!canEditTake(annotation)) {
      return {
        updated: false,
        reason:
          annotation.removedAt !== undefined
            ? "This clip was removed"
            : "People have already replied or voted — takes are fixed once that happens",
      };
    }

    await ctx.db.patch(args.annotationId, { takeText: text });
    return { updated: true };
  },
});

/**
 * What the signed-in viewer may do to this annotation.
 *
 * A single query rather than exposing the author id so the client can compare:
 * an annotation may be published anonymously, and shipping its author to every
 * reader in order to render an Edit button would undo that.
 */
export const ownerActions = query({
  args: { annotationId: v.id("annotations") },
  returns: v.object({ isOwner: v.boolean(), canEditTake: v.boolean() }),
  handler: async (ctx, args) => {
    const nothing = { isOwner: false, canEditTake: false };
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return nothing;
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) return nothing;
    const annotation = await ctx.db.get(args.annotationId);
    if (!annotation || annotation.authorId !== user._id) return nothing;
    if (annotation.removedAt !== undefined) return nothing;
    return { isOwner: true, canEditTake: canEditTake(annotation) };
  },
});
