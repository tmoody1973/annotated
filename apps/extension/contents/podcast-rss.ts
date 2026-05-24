import type { PlasmoCSConfig } from "plasmo";
import {
  GET_PODCAST_PAGE,
  type GetPodcastPageResponse,
} from "../lib/messages";

// Runs on any page so the sidepanel can detect podcast feeds on generic sites
// (NPR, show homepages). Apple/Spotify are detected from the URL alone and
// never reach here. YouTube has its own content script.
export const config: PlasmoCSConfig = {
  matches: ["https://*/*", "http://*/*"],
  exclude_matches: [
    "*://*.youtube.com/*",
    "*://podcasts.apple.com/*",
    "*://open.spotify.com/*",
  ],
};

/** The first RSS feed link the page advertises, or null. */
function findRssLink(): string | null {
  const link = document.querySelector<HTMLLinkElement>(
    'link[rel="alternate"][type="application/rss+xml"]'
  );
  return link?.href ?? null;
}

/**
 * Replies to the sidepanel's podcast-detection request with the page's RSS
 * feed link and title, so the panel can resolve a generic show page to a
 * clippable episode without the sidepanel reaching into the page's DOM.
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== GET_PODCAST_PAGE) return undefined;

  const response: GetPodcastPageResponse = {
    rssUrl: findRssLink(),
    pageTitle: document.title || null,
  };
  sendResponse(response);
  return undefined;
});
