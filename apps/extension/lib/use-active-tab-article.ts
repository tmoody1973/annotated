import { useEffect, useState } from "react";
import {
  GET_ARTICLE_PAGE,
  type GetArticlePageResponse,
} from "./messages";

/** An article detected on the active tab: the page HTML, title, and URL. */
export interface ArticleDetection {
  url: string;
  title: string;
  html: string;
}

interface ActiveTab {
  id: number | null;
}

async function readActiveTabId(): Promise<number | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id ?? null;
}

/** Asks the page's content script whether it's an article; null if not / unreachable. */
async function readArticlePage(
  tabId: number
): Promise<GetArticlePageResponse | null> {
  try {
    return await chrome.tabs.sendMessage<unknown, GetArticlePageResponse>(tabId, {
      type: GET_ARTICLE_PAGE,
    });
  } catch {
    return null;
  }
}

/**
 * Tracks the active tab and returns the article detected on it, or null. The
 * content script decides whether the page is an article and, if so, hands back
 * its live HTML. Re-runs on tab switch and in-page navigation, with a per-refresh
 * sequence guard so a slow detect for a previous tab can't clobber a newer one.
 */
export function useActiveTabArticle(): ArticleDetection | null {
  const [detection, setDetection] = useState<ArticleDetection | null>(null);

  useEffect(() => {
    let cancelled = false;
    let latestRun = 0;

    const refresh = async (): Promise<void> => {
      const runId = ++latestRun;
      const tabId = await readActiveTabId();
      const page = tabId === null ? null : await readArticlePage(tabId);
      const next: ArticleDetection | null =
        page?.html != null
          ? { url: page.url, title: page.title ?? "", html: page.html }
          : null;
      if (!cancelled && runId === latestRun) setDetection(next);
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
