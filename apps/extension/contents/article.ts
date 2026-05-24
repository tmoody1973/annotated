import type { PlasmoCSConfig } from "plasmo";
import {
  GET_ARTICLE_PAGE,
  type GetArticlePageResponse,
} from "../lib/messages";

// Runs on any page so the sidepanel can detect news articles. YouTube and the
// podcast platforms have their own paths and are excluded.
export const config: PlasmoCSConfig = {
  matches: ["https://*/*", "http://*/*"],
  exclude_matches: [
    "*://*.youtube.com/*",
    "*://podcasts.apple.com/*",
    "*://open.spotify.com/*",
  ],
};

/**
 * Whether the page looks like a news article — an `<article>` element or an
 * `og:type=article` declaration. Deliberately conservative so the article panel
 * doesn't hijack home pages, search results, or app shells.
 */
function looksLikeArticle(): boolean {
  if (document.querySelector("article")) return true;
  const ogType = document
    .querySelector<HTMLMetaElement>('meta[property="og:type"]')
    ?.content?.toLowerCase();
  return ogType === "article";
}

/**
 * Replies to the sidepanel's article-detection request. When the page looks like
 * an article it returns the live outerHTML so the worker can run Readability on
 * exactly what the user sees (paywalls/JS already resolved). Otherwise html is
 * null and the panel stays out of the way.
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== GET_ARTICLE_PAGE) return undefined;

  const response: GetArticlePageResponse = {
    html: looksLikeArticle() ? document.documentElement.outerHTML : null,
    title: document.title || null,
    url: location.href,
  };
  sendResponse(response);
  return undefined;
});
