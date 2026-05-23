import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { upsertYoutubeSource } from "./sources";
import { insertAnnotation } from "./annotations";

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

    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", "seed-dev-user"))
      .first();
    const authorId =
      existingUser?._id ??
      (await ctx.db.insert("users", {
        clerkId: "seed-dev-user",
        username: "dev",
        displayName: "Dev Seed",
      }));

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
