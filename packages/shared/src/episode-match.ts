import type { RssEpisode } from "./rss-feed";

/** What we know about the episode the user is viewing, from page or iTunes. */
export interface EpisodeCriteria {
  guid?: string | null;
  title?: string | null;
  pubDate?: string | null;
}

/** Collapses whitespace and lowercases so cosmetic title differences still match. */
function normalizeTitle(title: string): string {
  return title.trim().replace(/\s+/g, " ").toLowerCase();
}

/** Compares two RFC-822/ISO date strings at day resolution, ignoring format. */
function sameDay(a: string, b: string): boolean {
  const da = new Date(a);
  const db = new Date(b);
  if (Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) return false;
  return da.toISOString().slice(0, 10) === db.toISOString().slice(0, 10);
}

/**
 * Finds the episode in a feed that matches what we know about the page.
 * GUID is authoritative; otherwise we match on normalized title, using
 * pubDate to disambiguate shows that reuse episode titles. Returns null
 * when nothing matches — the caller never guesses.
 */
export function matchEpisode(
  episodes: RssEpisode[],
  criteria: EpisodeCriteria
): RssEpisode | null {
  if (criteria.guid) {
    const byGuid = episodes.find((episode) => episode.guid === criteria.guid);
    if (byGuid) return byGuid;
  }

  if (criteria.title) {
    const target = normalizeTitle(criteria.title);
    const byTitle = episodes.filter(
      (episode) => normalizeTitle(episode.title) === target
    );
    if (byTitle.length === 1) return byTitle[0] ?? null;
    if (byTitle.length > 1 && criteria.pubDate) {
      const pubDate = criteria.pubDate;
      const byDate = byTitle.find((episode) => sameDay(episode.pubDate, pubDate));
      if (byDate) return byDate;
    }
    // Multiple same-titled episodes and pubDate didn't disambiguate: return null
    // rather than guess. The caller decides the fallback (e.g. latest episode).
  }

  return null;
}
