/** Message contract between the sidepanel and the YouTube content script. */

export const GET_PLAYER_TIME = "GET_PLAYER_TIME" as const;

export interface GetPlayerTimeRequest {
  type: typeof GET_PLAYER_TIME;
}

export interface GetPlayerTimeResponse {
  /** Current playback position in ms, or null if no player was found. */
  currentTimeMs: number | null;
}

export const GET_PODCAST_PAGE = "GET_PODCAST_PAGE" as const;

export interface GetPodcastPageRequest {
  type: typeof GET_PODCAST_PAGE;
}

export interface GetPodcastPageResponse {
  /** First `<link rel="alternate" type="application/rss+xml">` href, or null. */
  rssUrl: string | null;
  /** The page's document title, used to match the specific episode. */
  pageTitle: string | null;
}

export const GET_ARTICLE_PAGE = "GET_ARTICLE_PAGE" as const;

export interface GetArticlePageRequest {
  type: typeof GET_ARTICLE_PAGE;
}

export interface GetArticlePageResponse {
  /**
   * The page's full outerHTML when it looks like an article (so the worker runs
   * Readability on exactly what the user sees — paywalls/JS resolved), else null.
   */
  html: string | null;
  /** The page's document title. */
  title: string | null;
  /** The page's canonical/current URL. */
  url: string;
}
