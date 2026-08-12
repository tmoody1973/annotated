import { v } from "convex/values";
import { query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

/**
 * A topic to pre-fill on the take screen.
 *
 * The panel used to disable Publish until a topic was picked, and explain why
 * *below* the dead button. Pre-filling turns that gate into a default: the
 * chip arrives filled in, editable, and Publish is live from the first frame.
 *
 * Everything here is best-effort by design. This is an enhancement to a screen
 * whose actual job is publishing, so an unauthenticated caller, a source nobody
 * has annotated, or a title that matches nothing all return `[]` — never an
 * error, and never a guess dressed up as a suggestion.
 *
 * No model call: the common case has to be free.
 */

/** How far back to look for a signal. Enough to be useful, bounded to stay cheap. */
const RECENT_ANNOTATIONS = 50;

/**
 * The last topic this source was tagged with — the strongest signal there is,
 * because it means someone (often the same person) already made this judgement
 * about this exact piece.
 */
async function fromSource(
  ctx: QueryCtx,
  sourceId: Id<"sources">,
): Promise<Id<"topics"> | null> {
  const annotations = await ctx.db
    .query("annotations")
    .withIndex("by_source", (q) => q.eq("sourceId", sourceId))
    .order("desc")
    .take(RECENT_ANNOTATIONS);

  for (const annotation of annotations) {
    const tag = await ctx.db
      .query("annotationTopics")
      .withIndex("by_annotation", (q) => q.eq("annotationId", annotation._id))
      .order("desc")
      .first();
    if (tag) return tag.topicId;
  }
  return null;
}

/** Word-boundary split, so "technicality" never matches the topic "tech". */
function words(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((word) => word.length > 2),
  );
}

/**
 * A topic whose slug or name appears in the source title as a whole word.
 * Deliberately literal: a fuzzy match here would put a confident wrong topic in
 * front of the user, which is worse than an empty chip.
 */
function fromTitle(topics: Doc<"topics">[], title: string): Id<"topics"> | null {
  const inTitle = words(title);
  if (inTitle.size === 0) return null;

  for (const topic of topics) {
    const terms = new Set([...words(topic.slug), ...words(topic.name)]);
    for (const term of terms) {
      if (inTitle.has(term)) return topic._id;
    }
  }
  return null;
}

/** The topic this person reaches for most — their own habit, not a global default. */
async function fromHabit(ctx: QueryCtx, authorId: Id<"users">): Promise<Id<"topics"> | null> {
  const mine = await ctx.db
    .query("annotations")
    .withIndex("by_author", (q) => q.eq("authorId", authorId))
    .order("desc")
    .take(RECENT_ANNOTATIONS);

  const uses = new Map<Id<"topics">, number>();
  for (const annotation of mine) {
    const tags = await ctx.db
      .query("annotationTopics")
      .withIndex("by_annotation", (q) => q.eq("annotationId", annotation._id))
      .collect();
    for (const tag of tags) uses.set(tag.topicId, (uses.get(tag.topicId) ?? 0) + 1);
  }

  let best: Id<"topics"> | null = null;
  let bestCount = 0;
  for (const [topicId, count] of uses) {
    if (count > bestCount) {
      best = topicId;
      bestCount = count;
    }
  }
  return best;
}

export const forSource = query({
  args: {
    sourceId: v.optional(v.id("sources")),
    title: v.string(),
  },
  returns: v.array(v.id("topics")),
  handler: async (ctx, args): Promise<Id<"topics">[]> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) return [];

    if (args.sourceId) {
      const previous = await fromSource(ctx, args.sourceId);
      if (previous) return [previous];
    }

    const topics = await ctx.db.query("topics").collect();
    const byTitle = fromTitle(topics, args.title);
    if (byTitle) return [byTitle];

    const habit = await fromHabit(ctx, user._id);
    return habit ? [habit] : [];
  },
});
