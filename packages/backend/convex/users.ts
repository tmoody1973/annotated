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

const BIO_MAX = 280;
const HANDLE_MAX = 50;
const URL_MAX = 200;

function normalizeWebsite(raw: string): string {
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    throw new Error("Website must be a valid URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Website must be an http(s) URL");
  }
  return url.toString();
}

/**
 * Updates the signed-in user's editable profile fields. Account basics (name,
 * avatar, email) stay with Clerk; this owns bio + social links. A field that
 * arrives is trimmed/capped and, when empty, cleared (patched to undefined);
 * a field that is omitted is left untouched. The X handle is stored without '@'.
 */
export const updateProfile = mutation({
  args: {
    bio: v.optional(v.string()),
    xHandle: v.optional(v.string()),
    website: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const clean = (value: string, max: number): string | undefined => {
      const trimmed = value.trim().slice(0, max);
      return trimmed.length === 0 ? undefined : trimmed;
    };

    const patch: Partial<Doc<"users">> = {};
    if (args.bio !== undefined) patch.bio = clean(args.bio, BIO_MAX);
    if (args.xHandle !== undefined) {
      patch.xHandle = clean(args.xHandle.replace(/^@/, ""), HANDLE_MAX);
    }
    if (args.website !== undefined) {
      const trimmed = args.website.trim().slice(0, URL_MAX);
      patch.website = trimmed.length === 0 ? undefined : normalizeWebsite(trimmed);
    }

    await ctx.db.patch(user._id, patch);
    return null;
  },
});

/**
 * Up to `limit` suggested accounts for the feed's "people worth following" rail:
 * most-recent users, excluding the signed-in user. Lightweight — no ranking yet.
 */
export const suggestions = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const me = await getCurrentUser(ctx);
    const limit = Math.min(args.limit ?? 4, 12);
    const recent = await ctx.db.query("users").order("desc").take(limit + 2);
    return recent
      .filter((u) => !me || u._id !== me._id)
      .slice(0, limit)
      .map((u) => ({
        _id: u._id,
        username: u.username,
        displayName: u.displayName,
        avatarUrl: u.avatarUrl,
      }));
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
