import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Returns a short-lived upload URL for Convex file storage. Token-guarded so
 * only the worker (presenting the shared secret) can request one.
 */
export const generateUploadUrl = mutation({
  args: { workerToken: v.string() },
  returns: v.string(),
  handler: async (ctx, args) => {
    if (args.workerToken !== process.env.WORKER_AUTH_TOKEN) {
      throw new Error("Unauthorized: invalid worker token");
    }
    return await ctx.storage.generateUploadUrl();
  },
});

/** Returns a signed URL for a stored file, or null if it does not exist. */
export const getUrl = query({
  args: { storageId: v.id("_storage") },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});
