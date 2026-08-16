import { v } from "convex/values";
import { internalMutation, internalQuery, query, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { isVisible } from "./annotations";
import { upsertArticleSource } from "./sources";

/**
 * The Record — a curated editorial layer over sources, published at `/2026`.
 *
 * Two properties are enforced here rather than by anyone remembering:
 *
 * 1. **A machine proposes, a person publishes.** Drafting is open to the
 *    curation agent; nothing reaches a public query without `publishedAt`, and
 *    only an operator can set it (internal mutation, CLI/dashboard only).
 * 2. **The record does the evidence, never the take.** There is no field here
 *    for an opinion. Takes are ordinary annotations on the same source.
 */

/** The visible editorial identity. Never a personal account — a reader has to
 *  be able to tell which parts a machine selected and which a person meant. */
export const EDITORIAL_BYLINE = "The 2026 Record";

const MAX_QUESTION_LENGTH = 300;
const MAX_SELECTION_NOTE_LENGTH = 800;
const MAX_TAKE_PREVIEWS = 3;

const trackValidator = v.union(
  v.literal("wisconsin"),
  v.literal("senate"),
  v.literal("governor"),
  v.literal("house"),
  v.literal("money")
);

/** Ordered for the filter rail. Wisconsin leads on purpose. */
export const TRACK_LABELS: { value: string; label: string }[] = [
  { value: "wisconsin", label: "Wisconsin" },
  { value: "senate", label: "US Senate" },
  { value: "governor", label: "Governors" },
  { value: "house", label: "US House" },
  { value: "money", label: "Money" },
];

const statusValidator = v.union(
  v.literal("proposed"),
  v.literal("under_review"),
  v.literal("hearing_scheduled"),
  v.literal("decided"),
  v.literal("withdrawn"),
  v.literal("preliminary"),
  v.literal("certified"),
  v.literal("archived")
);

/** Status renders as words, never colour alone. */
export const STATUS_LABELS: Record<string, string> = {
  proposed: "Proposed",
  under_review: "Under review",
  hearing_scheduled: "Hearing scheduled",
  decided: "Decided",
  withdrawn: "Withdrawn",
  preliminary: "Preliminary — not yet certified",
  certified: "Certified",
  archived: "Archived",
};

function requireText(value: string, field: string, maxLength: number): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new Error(`${field} is required.`);
  }
  if (trimmed.length > maxLength) {
    throw new Error(`${field} is too long.`);
  }
  return trimmed;
}

/**
 * Joins an entry to its source and the published takes hanging off that source.
 * Deliberately light — no storage URL lookups. A record row is a citation, and
 * the take links out to the clip page that already renders the media.
 */
async function toRecordRow(ctx: QueryCtx, entry: Doc<"recordEntries">) {
  const source = await ctx.db.get(entry.sourceId);

  const annotations = (
    await ctx.db
      .query("annotations")
      .withIndex("by_source", (q) => q.eq("sourceId", entry.sourceId))
      .order("desc")
      .collect()
  ).filter((a) => isVisible(a) && a.isPublic && a.publishedAt !== undefined);

  const takes = await Promise.all(
    annotations.slice(0, MAX_TAKE_PREVIEWS).map(async (annotation) => {
      const author = annotation.isAnonymous
        ? null
        : await ctx.db.get(annotation.authorId);
      return {
        _id: annotation._id,
        takeText: annotation.takeText ?? annotation.commentaryText ?? null,
        authorName: author?.displayName ?? "Anonymous",
        authorUsername: author?.username ?? null,
      };
    })
  );

  return {
    _id: entry._id,
    jurisdiction: entry.jurisdiction,
    body: entry.body,
    question: entry.question,
    track: entry.track ?? "wisconsin",
    status: entry.status ?? null,
    statusLabel: entry.status ? (STATUS_LABELS[entry.status] ?? entry.status) : null,
    retrievedAt: entry.retrievedAt,
    selectionNote: entry.selectionNote,
    nextDateAt: entry.nextDateAt,
    nextDateLabel: entry.nextDateLabel,
    curatedBy: entry.curatedBy,
    publishedAt: entry.publishedAt,
    byline: EDITORIAL_BYLINE,
    source: {
      _id: entry.sourceId,
      title: source?.title ?? "Source unavailable",
      url: source?.canonicalUrl ?? null,
      siteName: source?.siteName ?? null,
    },
    takeCount: annotations.length,
    takes,
  };
}

/**
 * The public record. Only entries a person has published, newest first.
 * Readable signed out — the record is the part that must not require an account.
 */
export const listPublished = query({
  args: { campaign: v.string() },
  handler: async (ctx, args) => {
    const entries = await ctx.db
      .query("recordEntries")
      .withIndex("by_campaign_and_published", (q) => q.eq("campaign", args.campaign))
      .collect();

    const published = entries
      .filter((entry) => entry.publishedAt !== undefined)
      .sort((a, b) => (b.publishedAt ?? 0) - (a.publishedAt ?? 0));

    return await Promise.all(published.map((entry) => toRecordRow(ctx, entry)));
  },
});

/**
 * The review queue: everything drafted and not yet published. Internal — an
 * unreviewed entry is exactly what must not be publicly reachable.
 */
export const listDrafts = internalQuery({
  args: { campaign: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("recordEntries")
      .withIndex("by_campaign_and_published", (q) =>
        q.eq("campaign", args.campaign).eq("publishedAt", undefined)
      )
      .collect();
  },
});

/**
 * Proposes an entry. Internal so the curation agent can call it and nothing
 * else can; it lands unpublished no matter who asks.
 */
export const draft = internalMutation({
  args: {
    campaign: v.string(),
    sourceId: v.id("sources"),
    jurisdiction: v.string(),
    body: v.string(),
    question: v.string(),
    status: v.optional(statusValidator),
    track: v.optional(trackValidator),
    retrievedAt: v.number(),
    selectionNote: v.string(),
    nextDateAt: v.optional(v.number()),
    nextDateLabel: v.optional(v.string()),
    curatedBy: v.union(v.literal("agent"), v.literal("editor")),
  },
  returns: v.id("recordEntries"),
  handler: async (ctx, args) => {
    const source = await ctx.db.get(args.sourceId);
    if (!source) {
      throw new Error("That source no longer exists.");
    }

    return await ctx.db.insert("recordEntries", {
      campaign: requireText(args.campaign, "Campaign", 32),
      sourceId: args.sourceId,
      jurisdiction: requireText(args.jurisdiction, "Jurisdiction", 120),
      body: requireText(args.body, "Body", 200),
      question: requireText(args.question, "Question", MAX_QUESTION_LENGTH),
      ...(args.status ? { status: args.status } : {}),
      track: args.track ?? "wisconsin",
      retrievedAt: args.retrievedAt,
      selectionNote: requireText(
        args.selectionNote,
        "Selection note",
        MAX_SELECTION_NOTE_LENGTH
      ),
      ...(args.nextDateAt !== undefined ? { nextDateAt: args.nextDateAt } : {}),
      ...(args.nextDateLabel ? { nextDateLabel: args.nextDateLabel.trim() } : {}),
      curatedBy: args.curatedBy,
      // publishedAt deliberately absent — the gate.
    });
  },
});

/** The gate. A person, via the CLI or dashboard, and nothing else. */
export const publish = internalMutation({
  args: { entryId: v.id("recordEntries") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const entry = await ctx.db.get(args.entryId);
    if (!entry) {
      throw new Error("That record entry no longer exists.");
    }
    await ctx.db.patch(args.entryId, { publishedAt: Date.now() });
    return null;
  },
});

/** Puts an entry back behind the gate. Not a delete — the row and its status
 *  history survive, which is what makes the record auditable. */
export const unpublish = internalMutation({
  args: { entryId: v.id("recordEntries") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.entryId, { publishedAt: undefined });
    return null;
  },
});

/** Corrects a published entry in place — a status moves, a date is set. */
export const update = internalMutation({
  args: {
    entryId: v.id("recordEntries"),
    status: v.optional(statusValidator),
    track: v.optional(trackValidator),
    selectionNote: v.optional(v.string()),
    retrievedAt: v.optional(v.number()),
    nextDateAt: v.optional(v.number()),
    nextDateLabel: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { entryId, ...patch } = args;
    const entry = await ctx.db.get(entryId);
    if (!entry) {
      throw new Error("That record entry no longer exists.");
    }
    if (patch.selectionNote !== undefined) {
      patch.selectionNote = requireText(
        patch.selectionNote,
        "Selection note",
        MAX_SELECTION_NOTE_LENGTH
      );
    }
    await ctx.db.patch(entryId, patch);
    return null;
  },
});

/**
 * Drafts an entry straight from a URL, upserting the source if it is new. This
 * is the shape a curator (and later the agent) actually works in: they have a
 * document, not a source id. Still lands unpublished — the gate is unchanged.
 */
export const draftFromUrl = internalMutation({
  args: {
    campaign: v.string(),
    canonicalUrl: v.string(),
    sourceTitle: v.string(),
    siteName: v.optional(v.string()),
    jurisdiction: v.string(),
    body: v.string(),
    question: v.string(),
    status: v.optional(statusValidator),
    track: v.optional(trackValidator),
    retrievedAt: v.number(),
    selectionNote: v.string(),
    nextDateAt: v.optional(v.number()),
    nextDateLabel: v.optional(v.string()),
    curatedBy: v.union(v.literal("agent"), v.literal("editor")),
  },
  returns: v.id("recordEntries"),
  handler: async (ctx, args): Promise<Id<"recordEntries">> => {
    if (!/^https:\/\//.test(args.canonicalUrl)) {
      throw new Error("A record source must be an https URL.");
    }
    const sourceId = await upsertArticleSource(ctx, {
      canonicalUrl: args.canonicalUrl,
      title: requireText(args.sourceTitle, "Source title", 300),
      siteName: args.siteName,
    });
    return await ctx.runMutation(internal.recordEntries.draft, {
      campaign: args.campaign,
      sourceId,
      jurisdiction: args.jurisdiction,
      body: args.body,
      question: args.question,
      ...(args.status ? { status: args.status } : {}),
      ...(args.track ? { track: args.track } : {}),
      retrievedAt: args.retrievedAt,
      selectionNote: args.selectionNote,
      ...(args.nextDateAt !== undefined ? { nextDateAt: args.nextDateAt } : {}),
      ...(args.nextDateLabel ? { nextDateLabel: args.nextDateLabel } : {}),
      curatedBy: args.curatedBy,
    });
  },
});

/** Publishes every drafted entry for a campaign — the curator's bulk review
 *  action after reading the queue. Still a person, still explicit. */
export const publishAllDrafts = internalMutation({
  args: { campaign: v.string() },
  returns: v.number(),
  handler: async (ctx, args) => {
    const drafts = await ctx.db
      .query("recordEntries")
      .withIndex("by_campaign_and_published", (q) =>
        q.eq("campaign", args.campaign).eq("publishedAt", undefined)
      )
      .collect();
    const now = Date.now();
    for (const draftRow of drafts) {
      await ctx.db.patch(draftRow._id, { publishedAt: now });
    }
    return drafts.length;
  },
});

/** Resolves a source by URL so seeding can reference one without an id. */
export const findSourceByUrl = internalQuery({
  args: { canonicalUrl: v.string() },
  handler: async (ctx, args): Promise<Id<"sources"> | null> => {
    const source = await ctx.db
      .query("sources")
      .withIndex("by_canonical_url", (q) => q.eq("canonicalUrl", args.canonicalUrl))
      .first();
    return source?._id ?? null;
  },
});
