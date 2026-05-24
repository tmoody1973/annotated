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
    const idMatch = url.pathname.match(/\/id(\d+)/);
    if (!idMatch) return null;
    return {
      platform: "apple",
      podcastId: idMatch[1],
      episodeId: url.searchParams.get("i"),
    };
  }

  if (host === "open.spotify.com") {
    const episodeMatch = url.pathname.match(/^\/episode\/([A-Za-z0-9]+)/);
    if (!episodeMatch) return null;
    return { platform: "spotify", episodeId: episodeMatch[1] };
  }

  return null;
}
