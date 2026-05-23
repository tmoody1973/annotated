import { v } from "convex/values";
import { mutation } from "./_generated/server";

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
