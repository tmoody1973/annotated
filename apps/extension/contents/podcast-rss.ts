import type { PlasmoCSConfig } from "plasmo";
import { GET_PODCAST_PAGE } from "../lib/messages";
import { detectPodcastPageInfo } from "../lib/page-detect";

// Runs on any page so the sidepanel can detect podcast feeds on generic sites
// (NPR, show homepages). Apple/Spotify are detected from the URL alone and
// never reach here. YouTube has its own content script. The same detection also
// runs on-demand via executeScript when a tab predates the extension (see
// lib/use-active-tab-podcast.ts) — both call detectPodcastPageInfo().
export const config: PlasmoCSConfig = {
  matches: ["https://*/*", "http://*/*"],
  exclude_matches: [
    "*://*.youtube.com/*",
    "*://podcasts.apple.com/*",
    "*://open.spotify.com/*",
  ],
};

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== GET_PODCAST_PAGE) return undefined;
  sendResponse(detectPodcastPageInfo());
  return undefined;
});
