import { v } from "convex/values";
import { countWords, MAX_QUOTE_WORDS } from "@annotated/shared";
import { mutation, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { upsertArticleSource, upsertYoutubeSource } from "./sources";
import { assertPublishable, insertAnnotation } from "./annotations";

/** Clerk subject used for the dev seed author until extension auth ships. */
const SEED_CLERK_ID = "seed-dev-user";

/** An article highlight is an excerpt — a few paragraphs at most, not a reprint. */
const MAX_HIGHLIGHT_CHARS = 2000;

/**
 * Returns the dedicated dev seed user, creating it on first use. Lets the
 * token-guarded seed/publish paths attribute annotations to a stable author
 * before real extension (syncHost) auth exists.
 */
async function resolveSeedUser(ctx: MutationCtx): Promise<Id<"users">> {
  const existing = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", SEED_CLERK_ID))
    .first();
  if (existing) return existing._id;

  return await ctx.db.insert("users", {
    clerkId: SEED_CLERK_ID,
    username: "dev",
    displayName: "Dev Seed",
  });
}

/**
 * Test-only: insert a minimal podcast source so the transcribe pipeline can be
 * exercised end-to-end before the real source-resolution orchestration exists.
 * Guarded by the shared worker token so it is not an open insert.
 */
export const seedSource = mutation({
  args: { mp3Url: v.string(), workerToken: v.string() },
  returns: v.id("sources"),
  handler: async (ctx, args) => {
    if (args.workerToken !== process.env.WORKER_AUTH_TOKEN) {
      throw new Error("Unauthorized");
    }
    return await ctx.db.insert("sources", {
      type: "podcast",
      canonicalUrl: `test://e2e/${Date.now()}`,
      title: "E2E Test Episode",
      mp3Url: args.mp3Url,
    });
  },
});

/**
 * Test-only: publish a YouTube clip annotation as a dedicated seed dev user,
 * so the data layer + landing-page query can be exercised end-to-end before
 * real extension auth exists. Token-guarded.
 */
export const seedAnnotation = mutation({
  args: { clipStorageId: v.id("_storage"), workerToken: v.string() },
  returns: v.id("annotations"),
  handler: async (ctx, args) => {
    if (args.workerToken !== process.env.WORKER_AUTH_TOKEN) {
      throw new Error("Unauthorized");
    }

    const authorId = await resolveSeedUser(ctx);
    const sourceId = await upsertYoutubeSource(ctx, {
      videoId: `seed-${Date.now()}`,
      title: "Seed YouTube Clip",
    });

    return await insertAnnotation(ctx, {
      authorId,
      sourceId,
      clipStorageId: args.clipStorageId,
      clipStartMs: 0,
      clipEndMs: 10_000,
      commentaryText: "Seed commentary",
    });
  },
});

/**
 * Test-only: seed a thread of clips on a fresh podcast source as the dev seed
 * user, so the /t/[id] thread page + feed head-collapse can be exercised before
 * the extension "add another clip" flow (Phase B) exists. Token-guarded.
 */
export const seedThreadDev = mutation({
  args: { quotes: v.array(v.string()), workerToken: v.string() },
  returns: v.id("threads"),
  handler: async (ctx, args) => {
    if (args.workerToken !== process.env.WORKER_AUTH_TOKEN) {
      throw new Error("Unauthorized");
    }
    if (args.quotes.length === 0) {
      throw new Error("At least one quote is required");
    }

    const authorId = await resolveSeedUser(ctx);
    const sourceId = await ctx.db.insert("sources", {
      type: "podcast",
      canonicalUrl: `test://thread/${Date.now()}`,
      title: "Seed Thread Episode",
      podcastName: "Seed Show",
    });
    const threadId = await ctx.db.insert("threads", {
      authorId,
      sourceId,
      title: "A multi-clip thread",
      createdAt: Date.now(),
    });

    for (const quote of args.quotes) {
      await insertAnnotation(ctx, {
        authorId,
        sourceId,
        selectedText: quote,
        commentaryText: `Commentary on: ${quote}`,
        threadId,
      });
    }
    return threadId;
  },
});

/**
 * Dev publish path for the extension before syncHost auth exists. Token-guarded
 * (the panel has no Clerk session) and attributes the clip to the dev seed user.
 * Accepts the real span, commentary, and source metadata the sidepanel collects,
 * and enforces the same publish invariants as the authed `annotations.create`.
 * DEBT: production must replace this with real auth + a server-side worker call.
 */
export const publishYoutubeClipDev = mutation({
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
    workerToken: v.string(),
  },
  returns: v.id("annotations"),
  handler: async (ctx, args) => {
    if (args.workerToken !== process.env.WORKER_AUTH_TOKEN) {
      throw new Error("Unauthorized");
    }
    assertPublishable(args);

    const authorId = await resolveSeedUser(ctx);
    const sourceId = await upsertYoutubeSource(ctx, args);

    return await insertAnnotation(ctx, {
      authorId,
      sourceId,
      clipStorageId: args.clipStorageId,
      clipStartMs: args.clipStartMs,
      clipEndMs: args.clipEndMs,
      commentaryText: args.commentaryText,
      commentaryAudioStorageId: args.commentaryAudioStorageId,
      commentaryAudioTranscript: args.commentaryAudioTranscript,
      isAnonymous: args.isAnonymous,
      threadId: args.threadId,
    });
  },
});

/**
 * Dev publish path for podcast clips before syncHost auth exists. Token-guarded
 * (the panel has no Clerk session) and attributed to the dev seed user. Reuses
 * the podcast `sources` row created during Step 6 resolution (passed by id), and
 * persists the transcript-derived quote alongside the span and commentary.
 * DEBT: production must replace this with real auth + a server-side worker call.
 */
export const publishPodcastClipDev = mutation({
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
    workerToken: v.string(),
  },
  returns: v.id("annotations"),
  handler: async (ctx, args) => {
    if (args.workerToken !== process.env.WORKER_AUTH_TOKEN) {
      throw new Error("Unauthorized");
    }
    const source = await ctx.db.get(args.sourceId);
    if (!source || source.type !== "podcast") {
      throw new Error("Source is not a podcast");
    }
    if (args.selectedText.trim().length === 0) {
      throw new Error("A transcript quote is required");
    }
    assertPublishable(args);

    const authorId = await resolveSeedUser(ctx);
    return await insertAnnotation(ctx, {
      authorId,
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
    });
  },
});

/**
 * Dev publish path for article clips before syncHost auth exists. Token-guarded
 * and attributed to the dev seed user. An article has no media clip — the "clip"
 * is the highlighted quote (`selectedText` + char offsets) plus commentary, so
 * this does NOT use `assertPublishable` (which assumes an audio/video span) and
 * instead requires both a non-empty quote and non-empty commentary directly.
 * DEBT: production must replace this with real auth + a server-side worker call.
 */
export const publishArticleClipDev = mutation({
  args: {
    canonicalUrl: v.string(),
    title: v.string(),
    siteName: v.optional(v.string()),
    author: v.optional(v.string()),
    selectedText: v.string(),
    textStart: v.number(),
    textEnd: v.number(),
    commentaryText: v.optional(v.string()),
    commentaryAudioStorageId: v.optional(v.id("_storage")),
    commentaryAudioTranscript: v.optional(v.string()),
    screenshotStorageId: v.optional(v.id("_storage")),
    isAnonymous: v.optional(v.boolean()),
    threadId: v.optional(v.id("threads")),
    workerToken: v.string(),
  },
  returns: v.id("annotations"),
  handler: async (ctx, args) => {
    if (args.workerToken !== process.env.WORKER_AUTH_TOKEN) {
      throw new Error("Unauthorized");
    }
    if (args.selectedText.trim().length === 0) {
      throw new Error("A highlighted quote is required");
    }
    const hasText = (args.commentaryText ?? "").trim().length > 0;
    if (!hasText && args.commentaryAudioStorageId === undefined) {
      throw new Error("Commentary is required (text or recorded audio)");
    }
    // Trust-boundary checks (the token is bundled = client-trusted): the offsets
    // must be ordered, non-negative, and consistent with the quote, and the
    // highlight is an excerpt — not a vehicle to republish a whole article.
    if (
      !Number.isInteger(args.textStart) ||
      !Number.isInteger(args.textEnd) ||
      args.textStart < 0 ||
      args.selectedText.length !== args.textEnd - args.textStart
    ) {
      throw new Error("Highlight offsets are invalid");
    }
    if (args.selectedText.length > MAX_HIGHLIGHT_CHARS) {
      throw new Error(`Highlight exceeds the ${MAX_HIGHLIGHT_CHARS}-character excerpt limit`);
    }
    // Fair-use ceiling, aligned with the UI clamp (a non-UI client can't bypass
    // it by sending a >100-word quote that fits under the char cap).
    if (countWords(args.selectedText) > MAX_QUOTE_WORDS) {
      throw new Error(`Highlight exceeds the ${MAX_QUOTE_WORDS}-word fair-use limit`);
    }

    const authorId = await resolveSeedUser(ctx);
    const sourceId = await upsertArticleSource(ctx, {
      canonicalUrl: args.canonicalUrl,
      title: args.title,
      siteName: args.siteName,
      author: args.author,
    });

    return await insertAnnotation(ctx, {
      authorId,
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
    });
  },
});

/**
 * Dev path for §1 Phase B ("Add another clip to this thread"). Lazily threads an
 * existing standalone clip: creates a thread on that clip's source + author and
 * attaches the clip as order 0, returning the threadId. Idempotent — if the clip
 * is already threaded, returns its existing threadId. Token-guarded; attributed
 * via the clip's own authorId (the seed dev user). The extension then passes the
 * returned threadId to the next publish so follow-on clips append in order.
 * DEBT: production must replace this with the real authed `threads.create`.
 */
export const startThreadDev = mutation({
  args: { annotationId: v.id("annotations"), workerToken: v.string() },
  returns: v.id("threads"),
  handler: async (ctx, args) => {
    if (args.workerToken !== process.env.WORKER_AUTH_TOKEN) {
      throw new Error("Unauthorized");
    }
    const annotation = await ctx.db.get(args.annotationId);
    if (!annotation) {
      throw new Error("Annotation not found");
    }
    if (annotation.threadId) {
      return annotation.threadId;
    }
    const threadId = await ctx.db.insert("threads", {
      authorId: annotation.authorId,
      sourceId: annotation.sourceId,
      createdAt: Date.now(),
    });
    await ctx.db.patch(args.annotationId, { threadId, threadOrder: 0 });
    return threadId;
  },
});
