import { XMLParser } from "fast-xml-parser";

/** A single clippable episode extracted from an RSS feed. */
export interface RssEpisode {
  guid: string | null;
  title: string;
  pubDate: string;
  enclosureUrl: string | null;
}

/** The parsed feed: the show name plus its clippable episodes. */
export interface ParsedFeed {
  podcastName: string;
  episodes: RssEpisode[];
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
});

const EMPTY: ParsedFeed = { podcastName: "", episodes: [] };

/** Wraps a possibly-single fast-xml-parser node into an array. */
function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

/** Reads the text of a node that may be a bare string or an attributed object. */
function textOf(node: unknown): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (node && typeof node === "object" && "#text" in node) {
    return String((node as Record<string, unknown>)["#text"]);
  }
  return "";
}

/** Reads the first `<enclosure url>` attribute, or null when absent. */
function enclosureUrlOf(item: Record<string, unknown>): string | null {
  const enclosure = asArray(item.enclosure as unknown)[0] as
    | Record<string, unknown>
    | undefined;
  const url = enclosure?.["@_url"];
  return typeof url === "string" ? url : null;
}

/**
 * Parses an RSS feed XML string into a show name and its clippable episodes.
 * Episodes without an `<enclosure>` are excluded (they have no audio to clip).
 * Malformed or non-RSS input yields an empty feed rather than throwing — the
 * caller treats "no episodes" and "bad feed" identically.
 */
export function parseRssFeed(xml: string): ParsedFeed {
  let parsed: Record<string, unknown>;
  try {
    parsed = parser.parse(xml) as Record<string, unknown>;
  } catch {
    return EMPTY;
  }

  const rss = parsed.rss as Record<string, unknown> | undefined;
  const channel = rss?.channel as Record<string, unknown> | undefined;
  if (!channel) return EMPTY;

  const podcastName = textOf(channel.title);
  const episodes = asArray(channel.item as unknown)
    .map((raw): RssEpisode => {
      const item = raw as Record<string, unknown>;
      return {
        guid: textOf(item.guid) || null,
        title: textOf(item.title),
        pubDate: textOf(item.pubDate),
        enclosureUrl: enclosureUrlOf(item),
      };
    })
    .filter((episode) => episode.enclosureUrl !== null);

  return { podcastName, episodes };
}
