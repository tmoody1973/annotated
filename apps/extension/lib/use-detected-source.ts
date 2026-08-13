/**
 * What is on the active tab, as one answer.
 *
 * The panel used to run three independent detection hooks and rank their
 * results in JSX. Each resolved on its own schedule, so a news article that
 * also advertises a site RSS feed would paint as a podcast for a frame and then
 * switch — the article-vs-RSS first-paint flicker (debt m). Worse, `null` meant
 * both "still looking" and "nothing here", so the panel could never tell the
 * difference between the two.
 *
 * One hook, one refresh, one state update carrying the final answer. The
 * ranking lives in `resolveDetection`, which is pure and tested.
 */
import { useEffect, useState } from "react";
import { extractYoutubeVideoId, parsePodcastUrl } from "@annotated/shared";
import { GET_ARTICLE_PAGE, GET_PODCAST_PAGE } from "./messages";
import type { GetArticlePageResponse, GetPodcastPageResponse } from "./messages";
import { detectArticleInPage, detectPodcastPageInfo } from "./page-detect";
import type { ArticleDetection } from "./use-active-tab-article";
import type { PodcastDetection } from "./use-active-tab-podcast";

export type DetectedSource =
  | { kind: "detecting" }
  | { kind: "youtube"; videoId: string; url: string }
  | { kind: "podcast"; podcast: PodcastDetection }
  | { kind: "article"; article: ArticleDetection }
  | { kind: "unsupported" };

/**
 * Rank the page's signals. Order matters and each rung is load-bearing:
 *
 * 1. A YouTube watch URL is unambiguous.
 * 2. An Apple or Spotify URL names an episode outright.
 * 3. An in-page audio enclosure means this page IS an episode — NPR and Snap
 *    Judgment publish episodes tagged as articles, so this beats both the
 *    article body and a site RSS link.
 * 4. `og:type=article` beats a mere site-wide RSS link; most news sites
 *    advertise a feed on every page.
 * 5. A site RSS link with no article body is a podcast show page.
 */
export function resolveDetection(
  url: string | null,
  feed: GetPodcastPageResponse | null,
  article: GetArticlePageResponse | null,
): DetectedSource {
  if (!url) return { kind: "unsupported" };

  const videoId = extractYoutubeVideoId(url);
  if (videoId) return { kind: "youtube", videoId, url };

  const ref = parsePodcastUrl(url);
  if (ref?.platform === "apple") {
    return {
      kind: "podcast",
      podcast: {
        kind: "apple",
        canonicalUrl: url,
        podcastId: ref.podcastId,
        episodeId: ref.episodeId,
      },
    };
  }
  if (ref?.platform === "spotify") {
    return { kind: "podcast", podcast: { kind: "spotify", canonicalUrl: url } };
  }

  if (feed?.enclosureUrl) {
    return {
      kind: "podcast",
      podcast: {
        kind: "enclosure",
        canonicalUrl: url,
        enclosureUrl: feed.enclosureUrl,
        pageTitle: feed.pageTitle ?? "",
        showName: feed.showName ?? "",
      },
    };
  }

  if (article?.html != null) {
    return {
      kind: "article",
      article: { url: article.url, title: article.title ?? "", html: article.html },
    };
  }

  if (feed?.rssUrl) {
    return {
      kind: "podcast",
      podcast: {
        kind: "generic",
        canonicalUrl: url,
        rssUrl: feed.rssUrl,
        pageTitle: feed.pageTitle ?? "",
      },
    };
  }

  return { kind: "unsupported" };
}

/**
 * Ask a tab a question by injecting the detector into it, on demand.
 *
 * There used to be declarative content scripts matching `https://*` that
 * answered this by message instead. They were removed: they ran on every page
 * the user visited whether or not they ever opened the panel, which is a lot of
 * standing access for something only needed at the moment someone decides to
 * clip. The message attempt is kept first because a tab may still have a
 * narrower content script (YouTube does), and it costs one failed call.
 *
 * Never throws — a page we cannot reach is a page with no signal.
 */
async function askTab<T>(
  tabId: number,
  messageType: string,
  injected: () => T | null,
): Promise<T | null> {
  try {
    const response = await chrome.tabs.sendMessage<unknown, T>(tabId, { type: messageType });
    if (response) return response;
  } catch {
    // No content script in this tab yet — fall through to programmatic injection.
  }

  try {
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId },
      func: injected,
    });
    return (injection?.result as T | undefined) ?? null;
  } catch {
    return null;
  }
}

async function detectActiveTab(): Promise<DetectedSource> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab?.url ?? null;
  const tabId = tab?.id ?? null;

  // YouTube and the two podcast platforms are decided by URL alone, so skip the
  // content-script round trip entirely for them.
  const fromUrl = resolveDetection(url, null, null);
  if (fromUrl.kind === "youtube" || fromUrl.kind === "podcast") return fromUrl;
  if (tabId === null) return { kind: "unsupported" };

  const [feed, article] = await Promise.all([
    askTab<GetPodcastPageResponse>(tabId, GET_PODCAST_PAGE, detectPodcastPageInfo),
    askTab<GetArticlePageResponse>(tabId, GET_ARTICLE_PAGE, detectArticleInPage),
  ]);

  return resolveDetection(url, feed, article);
}

export function useDetectedSource(): DetectedSource {
  const [detected, setDetected] = useState<DetectedSource>({ kind: "detecting" });

  useEffect(() => {
    let cancelled = false;
    // Only the newest refresh may set state: the content-script round trip means
    // a slow detect for a previous tab can resolve after a newer one.
    let latestRun = 0;

    // "detecting" is the first-paint state only. A re-detect keeps showing the
    // last answer until the new one lands — otherwise every tab switch flashes
    // "Looking at this page…" over a screen the user is working in.
    const refresh = async (): Promise<void> => {
      const runId = ++latestRun;
      const result = await detectActiveTab();
      if (!cancelled && runId === latestRun) setDetected(result);
    };

    void refresh();

    const onActivated = (): void => {
      void refresh();
    };
    const onUpdated = (_tabId: number, changeInfo: chrome.tabs.TabChangeInfo): void => {
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

  return detected;
}

/** A stable identity for the current source, so the flow resets when it changes. */
export function detectionKey(detected: DetectedSource): string | null {
  switch (detected.kind) {
    case "youtube":
      return `youtube:${detected.videoId}`;
    case "podcast":
      return `podcast:${detected.podcast.canonicalUrl}`;
    case "article":
      return `article:${detected.article.url}`;
    case "detecting":
    case "unsupported":
      return null;
  }
}
