/**
 * A podcast reference extracted from a page URL. Apple gives a podcast id plus
 * an optional episode id (`?i=`); Spotify gives an episode id. Only episode-level
 * Spotify URLs are clippable, so show pages resolve to null.
 */
export type PodcastRef =
  | { platform: "apple"; podcastId: string; episodeId: string | null }
  | { platform: "spotify"; episodeId: string };

/**
 * Parses a browser URL into a podcast reference, or null when the URL is not a
 * recognized podcast episode/show surface. Pure — the extension uses it to
 * decide whether the active tab is clippable before any network call.
 */
export function parsePodcastUrl(raw: string): PodcastRef | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./, "");

  if (host === "podcasts.apple.com") {
    const podcastId = url.pathname.match(/\/id(\d+)/)?.[1];
    if (podcastId === undefined) return null;
    return {
      platform: "apple",
      podcastId,
      episodeId: url.searchParams.get("i"),
    };
  }

  if (host === "open.spotify.com") {
    const episodeId = url.pathname.match(/^\/episode\/([A-Za-z0-9]+)/)?.[1];
    if (episodeId === undefined) return null;
    return { platform: "spotify", episodeId };
  }

  return null;
}
