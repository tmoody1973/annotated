import { v } from "convex/values";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Doc } from "./_generated/dataModel";

export async function getCurrentUser(ctx: QueryCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  return await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .first();
}

/**
 * Returns the signed-in user's row, throwing if unauthenticated or unmirrored.
 * Shared by every social mutation so the author is always the Clerk identity —
 * never an argument.
 */
export async function requireCurrentUser(
  ctx: QueryCtx | MutationCtx
): Promise<Doc<"users">> {
  const user = await getCurrentUser(ctx);
  if (!user) {
    throw new Error("Not authenticated");
  }
  return user;
}

/** Public profile lookup by username (or null). Used by the /u/[username] page. */
export const getByUsername = query({
  args: { username: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", args.username))
      .first();
  },
});

function deriveUsername(seed: string): string {
  const cleaned = seed.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const truncated = cleaned.slice(0, 30) || "user";
  return truncated;
}

export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    return await getCurrentUser(ctx);
  },
});

export const ensureCurrentUser = mutation({
  args: {},
  returns: v.id("users"),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (existing) {
      return existing._id;
    }

    const displayName =
      identity.name ?? identity.nickname ?? identity.givenName ?? "Anonymous";
    const usernameSeed =
      identity.nickname ?? identity.preferredUsername ?? identity.name ?? identity.subject;
    const username = deriveUsername(String(usernameSeed));

    return await ctx.db.insert("users", {
      clerkId: identity.subject,
      username,
      displayName,
      avatarUrl: identity.pictureUrl ?? undefined,
    });
  },
});
