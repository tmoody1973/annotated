import { v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";

const providerValidator = v.union(
  v.literal("deepgram"),
  v.literal("youtube-vtt")
);

/**
 * Authorizes a write from the stateless worker via the shared secret.
 * The worker is a trusted service, not a Clerk user, so it presents
 * `WORKER_AUTH_TOKEN` rather than a JWT identity.
 */
function assertWorkerToken(_ctx: MutationCtx, token: string): void {
  const expected = process.env.WORKER_AUTH_TOKEN;
  if (!expected) {
    throw new Error("WORKER_AUTH_TOKEN is not configured on the Convex deployment");
  }
  if (token !== expected) {
    throw new Error("Unauthorized: invalid worker token");
  }
}

/** Returns the transcript row for a source, or null if none exists yet. */
export const getBySource = query({
  args: { sourceId: v.id("sources") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("transcripts")
      .withIndex("by_source", (q) => q.eq("sourceId", args.sourceId))
      .first();
  },
});

/** Creates a transcript row in the "processing" state and returns its id. */
export const create = mutation({
  args: {
    sourceId: v.id("sources"),
    provider: providerValidator,
    deepgramJobId: v.optional(v.string()),
    workerToken: v.string(),
  },
  returns: v.id("transcripts"),
  handler: async (ctx, args) => {
    assertWorkerToken(ctx, args.workerToken);
    return await ctx.db.insert("transcripts", {
      sourceId: args.sourceId,
      provider: args.provider,
      status: "processing",
      deepgramJobId: args.deepgramJobId,
    });
  },
});

/**
 * Writes the transcribed words (as a JSON string — see schema, bypasses Convex's
 * 8192-element array cap) and flips the row to "ready".
 */
export const setReady = mutation({
  args: {
    transcriptId: v.id("transcripts"),
    wordsJson: v.string(),
    deepgramJobId: v.optional(v.string()),
    // The frozen episode audio in Convex storage — podcast clips cut from this so
    // the audio and these word timestamps share one timeline (no ad drift).
    episodeStorageId: v.optional(v.id("_storage")),
    workerToken: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    assertWorkerToken(ctx, args.workerToken);
    await ctx.db.patch(args.transcriptId, {
      wordsJson: args.wordsJson,
      status: "ready",
      ...(args.deepgramJobId ? { deepgramJobId: args.deepgramJobId } : {}),
      ...(args.episodeStorageId ? { episodeStorageId: args.episodeStorageId } : {}),
    });
    return null;
  },
});

/** Marks a transcript row "failed" after a transcription error. */
export const setFailed = mutation({
  args: {
    transcriptId: v.id("transcripts"),
    workerToken: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    assertWorkerToken(ctx, args.workerToken);
    await ctx.db.patch(args.transcriptId, { status: "failed" });
    return null;
  },
});
