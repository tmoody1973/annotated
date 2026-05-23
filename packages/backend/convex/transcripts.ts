import { v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";

/**
 * Validator for a single transcript word, matching the `transcripts.words`
 * shape in schema.ts.
 */
const wordValidator = v.object({
  word: v.string(),
  startMs: v.number(),
  endMs: v.number(),
  speaker: v.optional(v.string()),
  confidence: v.optional(v.number()),
});

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
      words: [],
      status: "processing",
      deepgramJobId: args.deepgramJobId,
    });
  },
});

/** Writes the transcribed words and flips the row to "ready". */
export const setReady = mutation({
  args: {
    transcriptId: v.id("transcripts"),
    words: v.array(wordValidator),
    deepgramJobId: v.optional(v.string()),
    workerToken: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    assertWorkerToken(ctx, args.workerToken);
    await ctx.db.patch(args.transcriptId, {
      words: args.words,
      status: "ready",
      ...(args.deepgramJobId ? { deepgramJobId: args.deepgramJobId } : {}),
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
