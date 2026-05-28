import { v } from "convex/values";
import { query, internalMutation } from "./_generated/server";

/** The canonical starter set (slugs are stable URL keys; refine names freely). */
const SEED_TOPICS: { slug: string; name: string; sortOrder: number }[] = [
  { slug: "news-politics", name: "News & Politics", sortOrder: 0 },
  { slug: "media-accountability", name: "Media & Accountability", sortOrder: 1 },
  { slug: "tech", name: "Tech", sortOrder: 2 },
  { slug: "business-investing", name: "Business & Investing", sortOrder: 3 },
  { slug: "science", name: "Science", sortOrder: 4 },
  { slug: "health", name: "Health", sortOrder: 5 },
  { slug: "education", name: "Education", sortOrder: 6 },
  { slug: "culture-arts", name: "Culture & Arts", sortOrder: 7 },
  { slug: "history", name: "History", sortOrder: 8 },
  { slug: "sports", name: "Sports", sortOrder: 9 },
  { slug: "comedy", name: "Comedy", sortOrder: 10 },
  { slug: "true-crime", name: "True Crime", sortOrder: 11 },
  { slug: "society", name: "Society", sortOrder: 12 },
  { slug: "climate", name: "Climate", sortOrder: 13 },
  { slug: "ideas-philosophy", name: "Ideas & Philosophy", sortOrder: 14 },
];

/** Idempotently insert the canonical topics. Internal — run via `convex run topics:seedTopics`. */
export const seedTopics = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    let created = 0;
    for (const t of SEED_TOPICS) {
      const existing = await ctx.db
        .query("topics")
        .withIndex("by_slug", (q) => q.eq("slug", t.slug))
        .first();
      if (!existing) {
        await ctx.db.insert("topics", t);
        created++;
      }
    }
    return created;
  },
});

/** All topics for the directory + the composer/picker selector. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const topics = await ctx.db.query("topics").collect();
    return topics
      .sort(
        (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name)
      )
      .map((t) => ({ _id: t._id, slug: t.slug, name: t.name, description: t.description }));
  },
});

/** One topic for the room header. Null when the slug is unknown (page 404s on null). */
export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const t = await ctx.db
      .query("topics")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
    return t ? { _id: t._id, slug: t.slug, name: t.name, description: t.description } : null;
  },
});
