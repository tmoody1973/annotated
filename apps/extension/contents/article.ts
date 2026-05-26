import type { PlasmoCSConfig } from "plasmo";
import { GET_ARTICLE_PAGE } from "../lib/messages";
import { detectArticleInPage } from "../lib/page-detect";

// Runs on any page so the sidepanel can detect news articles. YouTube and the
// podcast platforms have their own paths and are excluded. The same detection
// also runs on-demand via executeScript when a tab predates the extension
// (see lib/use-active-tab-article.ts) — both call detectArticleInPage().
export const config: PlasmoCSConfig = {
  matches: ["https://*/*", "http://*/*"],
  exclude_matches: [
    "*://*.youtube.com/*",
    "*://podcasts.apple.com/*",
    "*://open.spotify.com/*",
  ],
};

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== GET_ARTICLE_PAGE) return undefined;
  sendResponse(detectArticleInPage());
  return undefined;
});
