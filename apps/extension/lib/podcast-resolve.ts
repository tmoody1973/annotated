/**
 * Turning a detected podcast page into the resolver's arguments.
 *
 * Lifted out of `podcast-panel.tsx` so the clip screen can resolve an episode
 * without pulling in the old panel — and so the mapping is testable on its own.
 * Spotify never reaches the resolver: it has no enclosure, and the source
 * screen already explains why.
 */
import type { PodcastDetection } from "./use-active-tab-podcast";

/** Convex function references need an index signature on their argument type. */
export type ResolveArgs = {
  [key: string]: unknown;
  platform: "apple" | "spotify" | "generic" | "enclosure";
  canonicalUrl: string;
  podcastId?: string;
  episodeId?: string;
  rssUrl?: string;
  pageTitle?: string;
  enclosureUrl?: string;
  showName?: string;
};

export type ResolveResult =
  | {
      status: "resolved";
      sourceId: string;
      podcastName: string;
      episodeTitle: string;
      mp3Url: string;
    }
  | { status: "unsupported"; reason: string }
  | { status: "not_found"; reason: string };

export type ResolvablePodcast = Exclude<PodcastDetection, { kind: "spotify" }>;

export function resolveArgs(detection: ResolvablePodcast): ResolveArgs {
  if (detection.kind === "apple") {
    return {
      platform: "apple",
      canonicalUrl: detection.canonicalUrl,
      podcastId: detection.podcastId,
      ...(detection.episodeId ? { episodeId: detection.episodeId } : {}),
    };
  }
  if (detection.kind === "enclosure") {
    return {
      platform: "enclosure",
      canonicalUrl: detection.canonicalUrl,
      enclosureUrl: detection.enclosureUrl,
      pageTitle: detection.pageTitle,
      showName: detection.showName,
    };
  }
  return {
    platform: "generic",
    canonicalUrl: detection.canonicalUrl,
    rssUrl: detection.rssUrl,
    pageTitle: detection.pageTitle,
  };
}
