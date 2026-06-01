import { v } from "convex/values";
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
} from "./_generated/server";
import type { Id } from "./_generated/dataModel";

/**
 * Looks up a source by its YouTube video ID. Public (no auth) — the extension
 * calls this on sidepanel open to tell whether a video is already a known
 * source. Returns the row or null.
 */
export const getByYoutubeId = query({
  args: { youtubeVideoId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sources")
      .withIndex("by_youtube_id", (q) =>
        q.eq("youtubeVideoId", args.youtubeVideoId)
      )
      .first();
  },
});

interface YoutubeSourceInput {
  videoId: string;
  title: string;
  author?: string;
  channelUrl?: string;
  thumbnailUrl?: string;
  durationMs?: number;
}

/**
 * The poster image for a YouTube source's share/OG card. Prefers a stored
 * thumbnail, else derives YouTube's deterministic per-video still from the video
 * id — so every video clip has a card image even though the extension doesn't
 * send one (existing rows included, no migration). Undefined only when there's
 * no video id (non-YouTube source).
 */
export function youtubeThumbnailFor(source: {
  youtubeThumbnailUrl?: string;
  youtubeVideoId?: string;
}): string | undefined {
  if (source.youtubeThumbnailUrl) return source.youtubeThumbnailUrl;
  return source.youtubeVideoId
    ? `https://i.ytimg.com/vi/${source.youtubeVideoId}/hqdefault.jpg`
    : undefined;
}

/** Titles that mean "we never captured a real one" — safe to replace on re-clip. */
const PLACEHOLDER_YOUTUBE_TITLES = new Set(["", "YouTube", "YouTube video"]);

const isBlank = (value?: string): boolean =>
  value === undefined || value.trim() === "";

/**
 * Fills only the fields the existing row is missing (or that hold a placeholder
 * title) from a later, better-resolved clip. First *real* writer still wins for
 * any field that's already populated — we never overwrite good data. This
 * self-heals rows captured before the page hydrated (no channel name, "YouTube"
 * title) when the same video is clipped again.
 */
async function backfillYoutubeSource(
  ctx: MutationCtx,
  existing: { _id: Id<"sources">; title?: string; author?: string; youtubeChannelUrl?: string; youtubeThumbnailUrl?: string; youtubeDurationMs?: number },
  input: YoutubeSourceInput
): Promise<void> {
  const patch: Partial<{
    title: string;
    author: string;
    youtubeChannelUrl: string;
    youtubeThumbnailUrl: string;
    youtubeDurationMs: number;
  }> = {};

  if (!isBlank(input.author) && isBlank(existing.author)) {
    patch.author = input.author!.trim();
  }
  // Channel URL: fill if blank. Also upgrade a DOM-scraped `/@handle` (which can
  // point at the wrong anchor entirely) to a `/channel/<id>` from videoDetails —
  // the authoritative owner of the video. Never downgrade /channel → @handle.
  const isHandleUrl = (url?: string): boolean => !!url && /\/@[^/]+/.test(url);
  const isChannelIdUrl = (url?: string): boolean => !!url && /\/channel\//.test(url);
  if (!isBlank(input.channelUrl)) {
    if (isBlank(existing.youtubeChannelUrl)) {
      patch.youtubeChannelUrl = input.channelUrl!.trim();
    } else if (
      isHandleUrl(existing.youtubeChannelUrl) &&
      isChannelIdUrl(input.channelUrl)
    ) {
      patch.youtubeChannelUrl = input.channelUrl!.trim();
    }
  }
  if (!isBlank(input.thumbnailUrl) && isBlank(existing.youtubeThumbnailUrl)) {
    patch.youtubeThumbnailUrl = input.thumbnailUrl!.trim();
  }
  if (input.durationMs !== undefined && existing.youtubeDurationMs === undefined) {
    patch.youtubeDurationMs = input.durationMs;
  }

  const incomingTitleIsReal =
    !isBlank(input.title) && !PLACEHOLDER_YOUTUBE_TITLES.has(input.title.trim());
  const existingTitleIsPlaceholder =
    isBlank(existing.title) || PLACEHOLDER_YOUTUBE_TITLES.has(existing.title!.trim());
  if (incomingTitleIsReal && existingTitleIsPlaceholder) {
    patch.title = input.title.trim();
  }

  if (Object.keys(patch).length > 0) {
    await ctx.db.patch(existing._id, patch);
  }
}

/**
 * Inserts a YouTube source, or returns the existing one for this video id.
 * Sources are shared across users (the dedup moat) — idempotent by video id.
 * On a re-clip, missing/placeholder metadata is backfilled (see
 * `backfillYoutubeSource`). Plain helper so `annotations.createYoutube` and the
 * test seed share one code path.
 */
export async function upsertYoutubeSource(
  ctx: MutationCtx,
  input: YoutubeSourceInput
): Promise<Id<"sources">> {
  const existing = await ctx.db
    .query("sources")
    .withIndex("by_youtube_id", (q) => q.eq("youtubeVideoId", input.videoId))
    .first();
  if (existing) {
    await backfillYoutubeSource(ctx, existing, input);
    return existing._id;
  }

  return await ctx.db.insert("sources", {
    type: "youtube",
    canonicalUrl: `https://www.youtube.com/watch?v=${input.videoId}`,
    title: input.title,
    author: input.author,
    youtubeVideoId: input.videoId,
    youtubeThumbnailUrl: input.thumbnailUrl,
    youtubeChannelUrl: input.channelUrl,
    youtubeDurationMs: input.durationMs,
    cachedAt: Date.now(),
  });
}

/** Public idempotent upsert of a YouTube source; returns the source id. */
export const upsertYoutube = mutation({
  args: {
    videoId: v.string(),
    title: v.string(),
    author: v.optional(v.string()),
    channelUrl: v.optional(v.string()),
    thumbnailUrl: v.optional(v.string()),
    durationMs: v.optional(v.number()),
  },
  returns: v.id("sources"),
  handler: async (ctx, args) => {
    return await upsertYoutubeSource(ctx, args);
  },
});

interface PodcastSourceInput {
  canonicalUrl: string;
  title: string;
  podcastName: string;
  episodeGuid?: string;
  mp3Url: string;
}

/**
 * Inserts a podcast source, or returns the existing one. Dedup is by episode
 * GUID when present (the same episode shares one row across users); feeds
 * without GUIDs fall back to the canonical page URL.
 */
/** Fills only blank podcast fields from a later resolve (first real writer wins). */
async function backfillPodcastSource(
  ctx: MutationCtx,
  existing: { _id: Id<"sources">; title?: string; podcastName?: string; mp3Url?: string },
  input: PodcastSourceInput
): Promise<void> {
  const patch: Partial<{ title: string; podcastName: string; mp3Url: string }> = {};
  if (!isBlank(input.title) && isBlank(existing.title)) patch.title = input.title.trim();
  if (!isBlank(input.podcastName) && isBlank(existing.podcastName)) {
    patch.podcastName = input.podcastName.trim();
  }
  if (!isBlank(input.mp3Url) && isBlank(existing.mp3Url)) patch.mp3Url = input.mp3Url.trim();
  if (Object.keys(patch).length > 0) await ctx.db.patch(existing._id, patch);
}

export async function upsertPodcastSource(
  ctx: MutationCtx,
  input: PodcastSourceInput
): Promise<Id<"sources">> {
  if (input.episodeGuid) {
    const byGuid = await ctx.db
      .query("sources")
      .withIndex("by_podcast_guid", (q) =>
        q.eq("podcastEpisodeGuid", input.episodeGuid)
      )
      .first();
    if (byGuid) {
      await backfillPodcastSource(ctx, byGuid, input);
      return byGuid._id;
    }
  } else {
    const byUrl = await ctx.db
      .query("sources")
      .withIndex("by_canonical_url", (q) =>
        q.eq("canonicalUrl", input.canonicalUrl)
      )
      .first();
    if (byUrl) {
      await backfillPodcastSource(ctx, byUrl, input);
      return byUrl._id;
    }
  }

  return await ctx.db.insert("sources", {
    type: "podcast",
    canonicalUrl: input.canonicalUrl,
    title: input.title,
    podcastName: input.podcastName,
    podcastEpisodeGuid: input.episodeGuid,
    mp3Url: input.mp3Url,
    cachedAt: Date.now(),
  });
}

interface ArticleSourceInput {
  canonicalUrl: string;
  title: string;
  siteName?: string;
  author?: string;
  imageUrl?: string;
}

/**
 * Inserts an article source, or returns the existing one for this canonical
 * URL. Articles dedup on the page URL (no GUID, no video id) — two users
 * annotating the same article share one source row, like the other types.
 */
/** Fills only blank article fields from a later annotation (first real writer wins). */
async function backfillArticleSource(
  ctx: MutationCtx,
  existing: { _id: Id<"sources">; title?: string; siteName?: string; author?: string; imageUrl?: string },
  input: ArticleSourceInput
): Promise<void> {
  const patch: Partial<{ title: string; siteName: string; author: string; imageUrl: string }> = {};
  if (!isBlank(input.title) && isBlank(existing.title)) patch.title = input.title.trim();
  if (!isBlank(input.siteName) && isBlank(existing.siteName)) {
    patch.siteName = input.siteName!.trim();
  }
  if (!isBlank(input.author) && isBlank(existing.author)) patch.author = input.author!.trim();
  if (!isBlank(input.imageUrl) && isBlank(existing.imageUrl)) {
    patch.imageUrl = input.imageUrl!.trim();
  }
  if (Object.keys(patch).length > 0) await ctx.db.patch(existing._id, patch);
}

export async function upsertArticleSource(
  ctx: MutationCtx,
  input: ArticleSourceInput
): Promise<Id<"sources">> {
  const existing = await ctx.db
    .query("sources")
    .withIndex("by_canonical_url", (q) =>
      q.eq("canonicalUrl", input.canonicalUrl)
    )
    .first();
  if (existing) {
    await backfillArticleSource(ctx, existing, input);
    return existing._id;
  }

  return await ctx.db.insert("sources", {
    type: "article",
    canonicalUrl: input.canonicalUrl,
    title: input.title,
    siteName: input.siteName,
    author: input.author,
    imageUrl: input.imageUrl,
    cachedAt: Date.now(),
  });
}

/** Internal idempotent upsert of a podcast source; called by the resolver action. */
export const upsertPodcast = internalMutation({
  args: {
    canonicalUrl: v.string(),
    title: v.string(),
    podcastName: v.string(),
    episodeGuid: v.optional(v.string()),
    mp3Url: v.string(),
  },
  returns: v.id("sources"),
  handler: async (ctx, args) => {
    return await upsertPodcastSource(ctx, args);
  },
});
