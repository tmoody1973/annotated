import { v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { getCurrentUser, requireCurrentUser } from "./users";

export const VOTE_UP = 1;
export const VOTE_DOWN = -1;
const voteValue = v.union(v.literal(VOTE_UP), v.literal(VOTE_DOWN));

/** A row with no stored `value` predates voting and reads as an upvote. */
function directionOf(row: { value?: number }): 1 | -1 {
  return row.value === VOTE_DOWN ? VOTE_DOWN : VOTE_UP;
}

/**
 * Recomputes up/down counts from the actual vote rows and patches the annotation
 * (`likeCount` = upvotes, `downCount` = downvotes). Recomputing rather than ±1 is
 * drift-proof under rapid toggles and can never go negative.
 */
async function syncVoteCounts(
  ctx: MutationCtx,
  annotationId: Id<"annotations">
): Promise<{ upCount: number; downCount: number }> {
  const rows = await ctx.db
    .query("likes")
    .withIndex("by_annotation", (q) => q.eq("annotationId", annotationId))
    .collect();
  let upCount = 0;
  let downCount = 0;
  for (const row of rows) {
    if (directionOf(row) === VOTE_DOWN) downCount += 1;
    else upCount += 1;
  }
  await ctx.db.patch(annotationId, { likeCount: upCount, downCount });
  return { upCount, downCount };
}

/**
 * Casts, flips, or clears the signed-in user's vote on an annotation, then
 * recomputes counts. Pressing the same arrow again clears the vote; pressing the
 * opposite arrow flips it (never two rows). Captures Jason's binary "brilliant"
 * (+1) vs "BS" (-1) trigger. Returns the resulting state for the UI.
 */
export const toggleVote = mutation({
  args: { annotationId: v.id("annotations"), value: voteValue },
  returns: v.object({
    myVote: v.union(voteValue, v.null()),
    upCount: v.number(),
    downCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const existing = await ctx.db
      .query("likes")
      .withIndex("by_annotation_and_user", (q) =>
        q.eq("annotationId", args.annotationId).eq("userId", user._id)
      )
      .first();

    let myVote: 1 | -1 | null;
    if (existing && directionOf(existing) === args.value) {
      await ctx.db.delete(existing._id);
      myVote = null;
    } else if (existing) {
      await ctx.db.patch(existing._id, { value: args.value });
      myVote = args.value;
    } else {
      await ctx.db.insert("likes", {
        annotationId: args.annotationId,
        userId: user._id,
        value: args.value,
      });
      myVote = args.value;
    }

    const { upCount, downCount } = await syncVoteCounts(ctx, args.annotationId);
    return { myVote, upCount, downCount };
  },
});

/** The signed-in user's vote on an annotation: 1, -1, or null (incl. signed out). */
export const getMyVote = query({
  args: { annotationId: v.id("annotations") },
  returns: v.union(voteValue, v.null()),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;
    const existing = await ctx.db
      .query("likes")
      .withIndex("by_annotation_and_user", (q) =>
        q.eq("annotationId", args.annotationId).eq("userId", user._id)
      )
      .first();
    return existing ? directionOf(existing) : null;
  },
});
