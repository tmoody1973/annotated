import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getCurrentUser, requireCurrentUser } from "./users";

/**
 * Follows or unfollows a target user (idempotent toggle). The follower is the
 * signed-in user — never an argument. Following yourself is rejected. Returns
 * the resulting state so the UI can reflect it without a refetch.
 */
export const toggleFollow = mutation({
  args: { targetUserId: v.id("users") },
  returns: v.object({ following: v.boolean() }),
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    if (user._id === args.targetUserId) {
      throw new Error("You can't follow yourself");
    }

    const existing = await ctx.db
      .query("follows")
      .withIndex("by_follower", (q) => q.eq("followerId", user._id))
      .filter((q) => q.eq(q.field("followingId"), args.targetUserId))
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
      return { following: false };
    }

    await ctx.db.insert("follows", {
      followerId: user._id,
      followingId: args.targetUserId,
    });
    return { following: true };
  },
});

/** Whether the signed-in user follows the target. False when signed out. */
export const isFollowing = query({
  args: { targetUserId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) return false;
    const existing = await ctx.db
      .query("follows")
      .withIndex("by_follower", (q) => q.eq("followerId", user._id))
      .filter((q) => q.eq(q.field("followingId"), args.targetUserId))
      .first();
    return existing !== null;
  },
});

/** Follower + following counts for a user's profile. */
export const getCounts = query({
  args: { userId: v.id("users") },
  returns: v.object({ followers: v.number(), following: v.number() }),
  handler: async (ctx, args) => {
    const followers = await ctx.db
      .query("follows")
      .withIndex("by_following", (q) => q.eq("followingId", args.userId))
      .collect();
    const following = await ctx.db
      .query("follows")
      .withIndex("by_follower", (q) => q.eq("followerId", args.userId))
      .collect();
    return { followers: followers.length, following: following.length };
  },
});
