import { v } from "convex/values";
import { action, type ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { parseRssFeed, matchEpisode } from "@annotated/shared";

/**
 * The resolver's public result. Annotated explicitly to break Convex's
 * self-referential type inference — the action calls functions through the
 * `internal` object, which includes the action itself.
 */
type ResolveResult =
  | {
      status: "resolved";
      sourceId: Id<"sources">;
      podcastName: string;
      episodeTitle: string;
      mp3Url: string;
    }
  | { status: "unsupported"; reason: string }
  | { status: "not_found"; reason: string };

const ITUNES_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const RSS_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const EPISODE_LIMIT = 200;
// Convex caps a single string field at 1MB. Large feeds (NPR's Up First is ~1.8MB)
// exceed that, so caching is best-effort: oversized payloads resolve fresh and skip
// the cache rather than failing the whole resolution.
const MAX_CACHE_BYTES = 900_000;

/** UTF-8 byte length, to stay under Convex's 1MB per-string limit. */
function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

const SPOTIFY_REASON =
  "Spotify exclusives have no RSS feed and can't be clipped. Open the Apple Podcasts or web RSS version of this show.";

/** Strips a trailing " — Site" / " | Site" / " : Site" suffix (surrounding spaces
 * required, so a colon inside a real title like "Fire Escape: Worthy" is kept). */
function cleanEpisodeTitle(title: string | undefined): string {
  if (!title) return "";
  const [head] = title.split(/\s+[|:–—-]\s+/);
  return (head ?? title).trim();
}

/** Hostname (sans www) as a last-resort show name when the page gives none. */
function hostnameLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Podcast";
  }
}

/** One episode resolved from iTunes, normalized to what the upsert needs. */
interface ResolvedEpisode {
  title: string;
  guid?: string;
  mp3Url: string;
}

/** Minimal shape of the iTunes Lookup results we read. */
interface ItunesResult {
  wrapperType?: string;
  kind?: string;
  feedUrl?: string;
  collectionName?: string;
  trackId?: number;
  episodeGuid?: string;
  episodeUrl?: string;
  trackName?: string;
}

const resolveResultValidator = v.union(
  v.object({
    status: v.literal("resolved"),
    sourceId: v.id("sources"),
    podcastName: v.string(),
    episodeTitle: v.string(),
    mp3Url: v.string(),
  }),
  v.object({ status: v.literal("unsupported"), reason: v.string() }),
  v.object({ status: v.literal("not_found"), reason: v.string() })
);

/**
 * Resolves a detected podcast page to a clippable episode MP3 and writes the
 * shared `sources` row. Apple uses iTunes Lookup (the `?i=` value is the
 * episode trackId); generic pages use their RSS `<link>`. Spotify is detected
 * but unsupported — exclusives have no enclosure. Produces only the enclosure
 * URL string; the worker follows its tracking redirect to the bytes in Step 7.
 */
export const resolvePodcast = action({
  args: {
    platform: v.union(
      v.literal("apple"),
      v.literal("spotify"),
      v.literal("generic"),
      v.literal("enclosure")
    ),
    canonicalUrl: v.string(),
    podcastId: v.optional(v.string()),
    episodeId: v.optional(v.string()),
    rssUrl: v.optional(v.string()),
    pageTitle: v.optional(v.string()),
    enclosureUrl: v.optional(v.string()),
    showName: v.optional(v.string()),
  },
  returns: resolveResultValidator,
  handler: async (ctx, args): Promise<ResolveResult> => {
    if (args.platform === "spotify") {
      return { status: "unsupported" as const, reason: SPOTIFY_REASON };
    }

    // The page carried the episode audio directly (NPR/Snap Judgment/Audible —
    // an episode tagged like an article). Clip it straight from the enclosure;
    // no iTunes/RSS round-trip. The worker resolves the tracking redirect later.
    if (args.platform === "enclosure") {
      if (!args.enclosureUrl) {
        return { status: "not_found" as const, reason: "No episode audio found on this page." };
      }
      const episodeTitle = cleanEpisodeTitle(args.pageTitle) || "Episode";
      const podcastName = args.showName?.trim() || hostnameLabel(args.canonicalUrl);
      const sourceId: Id<"sources"> = await ctx.runMutation(
        internal.sources.upsertPodcast,
        {
          canonicalUrl: args.canonicalUrl,
          title: episodeTitle,
          podcastName,
          mp3Url: args.enclosureUrl,
        }
      );
      return {
        status: "resolved" as const,
        sourceId,
        podcastName,
        episodeTitle,
        mp3Url: args.enclosureUrl,
      };
    }

    const resolved =
      args.platform === "apple"
        ? await resolveApple(ctx, args.podcastId, args.episodeId)
        : await resolveGeneric(ctx, args.rssUrl, args.pageTitle);

    if (resolved.status !== "resolved") return resolved;

    const sourceId: Id<"sources"> = await ctx.runMutation(
      internal.sources.upsertPodcast,
      {
        canonicalUrl: args.canonicalUrl,
        title: resolved.episode.title,
        podcastName: resolved.podcastName,
        episodeGuid: resolved.episode.guid,
        mp3Url: resolved.episode.mp3Url,
      }
    );

    return {
      status: "resolved" as const,
      sourceId,
      podcastName: resolved.podcastName,
      episodeTitle: resolved.episode.title,
      mp3Url: resolved.episode.mp3Url,
    };
  },
});

type ResolveOutcome =
  | { status: "resolved"; podcastName: string; episode: ResolvedEpisode }
  | { status: "unsupported"; reason: string }
  | { status: "not_found"; reason: string };

/** Apple path: iTunes Lookup → feedUrl + episode list, matched by trackId. */
async function resolveApple(
  ctx: ActionCtx,
  podcastId: string | undefined,
  episodeId: string | undefined
): Promise<ResolveOutcome> {
  if (!podcastId) {
    return { status: "not_found", reason: "Missing Apple podcast id." };
  }

  const json = await loadItunes(ctx, podcastId);
  if (!json) {
    return { status: "not_found", reason: "Couldn't reach Apple Podcasts." };
  }

  let results: ItunesResult[];
  try {
    results = (JSON.parse(json) as { results?: ItunesResult[] }).results ?? [];
  } catch {
    return {
      status: "not_found",
      reason: "Apple Podcasts returned an unreadable response.",
    };
  }
  const podcast = results.find((r) => r.feedUrl);
  const podcastName = podcast?.collectionName ?? "Unknown show";
  const episodes = results.filter((r) => r.wrapperType === "podcastEpisode");

  const chosen = episodeId
    ? episodes.find((e) => String(e.trackId) === episodeId)
    : episodes[0];

  if (!chosen) {
    return {
      status: "not_found",
      reason: episodeId
        ? "Couldn't pin this episode — try a recent one from this show."
        : "No episodes found for this show.",
    };
  }
  if (!chosen.episodeUrl) {
    return { status: "not_found", reason: "This episode has no audio enclosure." };
  }

  return {
    status: "resolved",
    podcastName,
    episode: {
      title: chosen.trackName ?? "Untitled episode",
      guid: chosen.episodeGuid,
      mp3Url: chosen.episodeUrl,
    },
  };
}

/** Generic path: fetch the page's RSS feed, match the episode by title. */
async function resolveGeneric(
  ctx: ActionCtx,
  rssUrl: string | undefined,
  pageTitle: string | undefined
): Promise<ResolveOutcome> {
  if (!rssUrl) {
    return { status: "not_found", reason: "No RSS feed found on this page." };
  }

  const xml = await loadRss(ctx, rssUrl);
  if (!xml) {
    return { status: "not_found", reason: "Couldn't fetch the podcast feed." };
  }

  const { podcastName, episodes } = parseRssFeed(xml);
  if (episodes.length === 0) {
    return { status: "not_found", reason: "No clippable episodes in this feed." };
  }

  const matched = pageTitle
    ? matchEpisode(episodes, { title: pageTitle })
    : null;
  const chosen = matched ?? episodes[0];
  // episodes is non-empty (checked above), so episodes[0] exists; guard anyway
  // to narrow the type and stay graceful if that invariant ever changes.
  if (!chosen) {
    return { status: "not_found", reason: "No clippable episodes in this feed." };
  }

  // parseRssFeed already drops null-enclosure episodes, but the type is
  // string|null — guard explicitly rather than cast, so a future loosening
  // of that filter surfaces a graceful not_found instead of a validator throw.
  if (!chosen.enclosureUrl) {
    return { status: "not_found", reason: "This episode has no audio enclosure." };
  }

  return {
    status: "resolved",
    podcastName: podcastName || "Unknown show",
    episode: {
      title: chosen.title,
      guid: chosen.guid ?? undefined,
      mp3Url: chosen.enclosureUrl,
    },
  };
}

/** Returns cached iTunes JSON if fresh, else fetches, caches, and returns it. */
async function loadItunes(
  ctx: ActionCtx,
  podcastId: string
): Promise<string | null> {
  const cached = await ctx.runQuery(internal.cache.getItunes, {
    appleId: podcastId,
  });
  if (cached && Date.now() - cached.fetchedAt < ITUNES_TTL_MS) {
    return cached.json;
  }

  try {
    const res = await fetch(
      `https://itunes.apple.com/lookup?id=${encodeURIComponent(podcastId)}&entity=podcastEpisode&limit=${EPISODE_LIMIT}`
    );
    if (!res.ok) return cached?.json ?? null;
    const json = await res.text();
    // Only cache valid JSON — a 200-OK HTML error/rate-limit page must not
    // poison the 7-day cache (it would make every reopen of this show fail).
    try {
      JSON.parse(json);
    } catch {
      return cached?.json ?? null;
    }
    if (byteLength(json) <= MAX_CACHE_BYTES) {
      await ctx.runMutation(internal.cache.setItunes, { appleId: podcastId, json });
    }
    return json;
  } catch {
    return cached?.json ?? null;
  }
}

/** Returns cached RSS XML if fresh, else fetches, caches, and returns it. */
async function loadRss(
  ctx: ActionCtx,
  feedUrl: string
): Promise<string | null> {
  const cached = await ctx.runQuery(internal.cache.getRss, { feedUrl });
  if (cached && Date.now() - cached.fetchedAt < RSS_TTL_MS) {
    return cached.rawXml;
  }

  try {
    const res = await fetch(feedUrl);
    if (!res.ok) return cached?.rawXml ?? null;
    const rawXml = await res.text();
    if (byteLength(rawXml) <= MAX_CACHE_BYTES) {
      await ctx.runMutation(internal.cache.setRss, { feedUrl, rawXml });
    }
    return rawXml;
  } catch {
    return cached?.rawXml ?? null;
  }
}
