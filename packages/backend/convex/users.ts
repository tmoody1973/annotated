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

/**
 * Appends an incrementing suffix (`-2`, `-3`, …) to `base` until it's free,
 * via the `by_username` index. Existing rows are never touched — this only
 * stops new collisions (Fix 4).
 */
async function ensureUniqueUsername(ctx: MutationCtx, base: string): Promise<string> {
  let candidate = base;
  for (let suffix = 2; ; suffix++) {
    const taken = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", candidate))
      .first();
    if (!taken) return candidate;
    candidate = `${base}-${suffix}`;
  }
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
 * most-recent users, excluding the signed-in user, anyone already followed, and
 * anyone with zero published annotations (an empty account isn't "worth
 * following"). Accounts sharing a username (possible pre-Fix-4 — see
 * `ensureUniqueUsername`) are collapsed to the one with the most annotations.
 */
export const suggestions = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const me = await getCurrentUser(ctx);
    const limit = Math.min(args.limit ?? 4, 12);

    const alreadyFollowing = me
      ? new Set(
          (
            await ctx.db
              .query("follows")
              .withIndex("by_follower", (q) => q.eq("followerId", me._id))
              .collect()
          ).map((f) => f.followingId)
        )
      : new Set();

    // Over-fetch recent users since most candidates get filtered out below;
    // capped so this stays cheap regardless of `limit`.
    const candidatePoolSize = Math.min(limit * 6 + 12, 60);
    const recent = await ctx.db.query("users").order("desc").take(candidatePoolSize);
    const eligible = recent.filter(
      (u) => (!me || u._id !== me._id) && !alreadyFollowing.has(u._id)
    );

    const withPublishedCount = await Promise.all(
      eligible.map(async (user) => {
        const posts = await ctx.db
          .query("annotations")
          .withIndex("by_author", (q) => q.eq("authorId", user._id))
          .take(50);
        const publishedCount = posts.filter((a) => a.isPublic && !a.isAnonymous).length;
        return { user, publishedCount };
      })
    );

    const byUsername = new Map<string, { user: Doc<"users">; publishedCount: number }>();
    for (const candidate of withPublishedCount) {
      if (candidate.publishedCount === 0) continue;
      const existing = byUsername.get(candidate.user.username);
      if (!existing || candidate.publishedCount > existing.publishedCount) {
        byUsername.set(candidate.user.username, candidate);
      }
    }

    return Array.from(byUsername.values())
      .slice(0, limit)
      .map(({ user }) => ({
        _id: user._id,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
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
    const username = await ensureUniqueUsername(ctx, deriveUsername(String(usernameSeed)));

    return await ctx.db.insert("users", {
      clerkId: identity.subject,
      username,
      displayName,
      avatarUrl: identity.pictureUrl ?? undefined,
    });
  },
});
