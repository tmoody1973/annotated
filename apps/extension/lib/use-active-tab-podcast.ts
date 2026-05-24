import { useEffect, useState } from "react";
import { parsePodcastUrl } from "@annotated/shared";
import {
  GET_PODCAST_PAGE,
  type GetPodcastPageResponse,
} from "./messages";

/** A podcast detected on the active tab, shaped as resolver arguments. */
export type PodcastDetection =
  | { kind: "apple"; canonicalUrl: string; podcastId: string; episodeId: string | null }
  | { kind: "spotify"; canonicalUrl: string }
  | { kind: "generic"; canonicalUrl: string; rssUrl: string; pageTitle: string };

interface ActiveTab {
  id: number | null;
  url: string | null;
}

async function readActiveTab(): Promise<ActiveTab> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return { id: tab?.id ?? null, url: tab?.url ?? null };
}

/** Asks the page's content script for its RSS link; null if none / unreachable. */
async function readPageFeed(tabId: number): Promise<GetPodcastPageResponse | null> {
  try {
    return await chrome.tabs.sendMessage<unknown, GetPodcastPageResponse>(tabId, {
      type: GET_PODCAST_PAGE,
    });
  } catch {
    return null;
  }
}

async function detect(tab: ActiveTab): Promise<PodcastDetection | null> {
  if (!tab.url) return null;

  const ref = parsePodcastUrl(tab.url);
  if (ref?.platform === "apple") {
    return {
      kind: "apple",
      canonicalUrl: tab.url,
      podcastId: ref.podcastId,
      episodeId: ref.episodeId,
    };
  }
  if (ref?.platform === "spotify") {
    return { kind: "spotify", canonicalUrl: tab.url };
  }

  if (tab.id === null) return null;
  const feed = await readPageFeed(tab.id);
  if (feed?.rssUrl) {
    return {
      kind: "generic",
      canonicalUrl: tab.url,
      rssUrl: feed.rssUrl,
      pageTitle: feed.pageTitle ?? "",
    };
  }

  return null;
}

/**
 * Tracks the active tab and returns the podcast detected on it, or null.
 * Apple/Spotify are read from the URL; generic show pages are detected by
 * asking the content script for the page's RSS link. Re-runs on tab switch
 * and in-page navigation so SPA route changes are picked up without a reload.
 */
export function useActiveTabPodcast(): PodcastDetection | null {
  const [detection, setDetection] = useState<PodcastDetection | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Each refresh takes a sequence number; only the latest may set state. The
    // generic path awaits a content-script round-trip, so a slow detect for a
    // previous tab can resolve after a newer one — without this guard it would
    // clobber state and the panel would show the wrong tab's podcast.
    let latestRun = 0;

    const refresh = async (): Promise<void> => {
      const runId = ++latestRun;
      const tab = await readActiveTab();
      const result = await detect(tab);
      if (!cancelled && runId === latestRun) setDetection(result);
    };

    void refresh();

    const onActivated = (): void => {
      void refresh();
    };
    const onUpdated = (
      _tabId: number,
      changeInfo: chrome.tabs.TabChangeInfo
    ): void => {
      if (changeInfo.url) void refresh();
    };

    chrome.tabs.onActivated.addListener(onActivated);
    chrome.tabs.onUpdated.addListener(onUpdated);

    return () => {
      cancelled = true;
      chrome.tabs.onActivated.removeListener(onActivated);
      chrome.tabs.onUpdated.removeListener(onUpdated);
    };
  }, []);

  return detection;
}
