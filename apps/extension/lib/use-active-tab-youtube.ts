import { useEffect, useState } from "react";
import { extractYoutubeVideoId } from "@annotated/shared";

async function readActiveTabUrl(): Promise<string | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.url ?? null;
}

/**
 * Tracks the active tab and returns the YouTube video ID for the current page,
 * or null when it is not a YouTube video. Re-reads on tab switch (`onActivated`)
 * and on in-page navigation (`onUpdated` with a URL change) so YouTube's SPA
 * video→video navigation is picked up without a reload.
 */
export function useActiveTabYoutubeId(): string | null {
  const [videoId, setVideoId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const refresh = async (): Promise<void> => {
      const url = await readActiveTabUrl();
      if (!cancelled) {
        setVideoId(url ? extractYoutubeVideoId(url) : null);
      }
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

  return videoId;
}
