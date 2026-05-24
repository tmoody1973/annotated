import { v } from "convex/values";
import { mutation, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { upsertYoutubeSource } from "./sources";
import { assertPublishable, insertAnnotation } from "./annotations";

/** Clerk subject used for the dev seed author until extension auth ships. */
const SEED_CLERK_ID = "seed-dev-user";

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
    commentaryText: v.string(),
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
    commentaryText: v.string(),
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
    });
  },
});
